import argparse
import hashlib
import json
import re
import ssl
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.error import URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

from app.config import settings
from app.database import get_connection, init_database


@dataclass
class Listing:
    item_id: str
    title: str
    price: int | None
    location: str | None
    want_count: int | None
    browse_count: int | None
    seller_credit: str | None
    source_url: str
    raw_text: str
    keyword: str
    position: int


def main() -> int:
    args = parse_args()
    keywords = normalize_keywords(args.keyword)
    if not keywords:
        print(json.dumps({"status": "error", "message": "keywords are required"}), flush=True)
        return 2

    init_database()
    profile_dir = resolve_path(settings.goofish_profile_dir)
    profile_dir.mkdir(parents=True, exist_ok=True)

    try:
        stats = run_search(profile_dir, keywords, args.max_results, args.login_timeout)
    except PlaywrightError as exc:
        print(
            json.dumps(
                {
                    "status": "error",
                    "keywords": keywords,
                    "inserted": 0,
                    "updated": 0,
                    "matched": 0,
                    "message": (
                        "Playwright failed. If this is the first run, install the browser with: "
                        "python -m playwright install chromium. "
                        f"Original error: {exc}"
                    ),
                },
                ensure_ascii=False,
            ),
            flush=True,
        )
        return 1

    print(json.dumps({"status": "ok", "keywords": keywords, **stats}, ensure_ascii=False), flush=True)
    return 0


def run_search(profile_dir: Path, keywords: list[str], max_results: int, login_timeout: int) -> dict[str, int | bool | str | None]:
    with sync_playwright() as p:
        stats = try_mtop_existing_session(p, profile_dir, keywords, max_results)
        if stats:
            return stats

        if settings.goofish_headless:
            return {
                "inserted": 0,
                "updated": 0,
                "matched": 0,
                "login_required": True,
                "message": "login is required, but visible login browser is disabled",
            }

        login_required = perform_visible_login(p, profile_dir, login_timeout)
        if login_required:
            return {
                "inserted": 0,
                "updated": 0,
                "matched": 0,
                "login_required": True,
                "message": "login was not completed before timeout",
            }

        stats = try_mtop_existing_session(p, profile_dir, keywords, max_results)
        if stats:
            return stats

        return {
            "inserted": 0,
            "updated": 0,
            "matched": 0,
            "login_required": True,
            "message": "login completed, but saved session could not be verified",
        }


def launch_context(playwright, profile_dir: Path, headless: bool):
    return playwright.chromium.launch_persistent_context(
        user_data_dir=str(profile_dir),
        headless=headless,
        viewport={"width": 1440, "height": 1000},
        args=["--disable-dev-shm-usage"],
    )


def get_live_page(context):
    for page in context.pages:
        if not page.is_closed():
            return page
    return context.new_page()


def try_mtop_existing_session(playwright, profile_dir: Path, keywords: list[str], max_results: int) -> dict[str, int | bool | str | None] | None:
    cookie_jar = read_cookie_file() or read_cookie_jar(playwright, profile_dir)
    if not has_mtop_login_cookies(cookie_jar):
        return None

    all_listings: list[Listing] = []
    try:
        for keyword in keywords:
            all_listings.extend(mtop_search_keyword(cookie_jar, keyword, max_results))
    except (URLError, TimeoutError, ValueError) as exc:
        print(f"Goofish mtop search failed: {exc}", file=sys.stderr, flush=True)
        return None

    inserted, updated, matched = save_listings(all_listings)
    return {
        "inserted": inserted,
        "updated": updated,
        "matched": matched,
        "login_required": False,
        "message": None,
    }


def read_cookie_jar(playwright, profile_dir: Path) -> dict[str, str]:
    context = launch_context(playwright, profile_dir, headless=True)
    try:
        cookies = context.cookies(["https://www.goofish.com", "https://h5api.m.goofish.com"])
        return {cookie["name"]: cookie["value"] for cookie in cookies}
    finally:
        context.close()


def read_cookie_file() -> dict[str, str]:
    cookie_file = resolve_path(settings.goofish_cookie_file)
    if not cookie_file.exists():
        return {}

    try:
        payload = json.loads(cookie_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Goofish cookie file could not be read: {exc}", file=sys.stderr, flush=True)
        return {}

    if isinstance(payload, dict):
        return {str(name): str(value) for name, value in payload.items() if value is not None}

    if isinstance(payload, list):
        cookie_jar: dict[str, str] = {}
        for cookie in payload:
            if not isinstance(cookie, dict):
                continue
            name = cookie.get("name")
            value = cookie.get("value")
            if name and value is not None:
                cookie_jar[str(name)] = str(value)
        return cookie_jar

    return {}


def has_mtop_login_cookies(cookie_jar: dict[str, str]) -> bool:
    return bool(cookie_jar.get("_m_h5_tk") and cookie_jar.get("unb"))


def mtop_search_keyword(cookie_jar: dict[str, str], keyword: str, max_results: int) -> list[Listing]:
    response = request_mtop_search(cookie_jar, keyword, max_results)
    ret = response.get("ret") or []
    if ret and not str(ret[0]).startswith("SUCCESS"):
        raise ValueError(str(ret[0]))

    result_list = (((response.get("data") or {}).get("resultList")) or [])[:max_results]
    listings: list[Listing] = []
    for row in result_list:
        listing = parse_mtop_listing(row, keyword, len(listings) + 1)
        if listing:
            enrich_listing_counts(cookie_jar, listing)
            listings.append(listing)
    return listings


def request_mtop_search(cookie_jar: dict[str, str], keyword: str, max_results: int) -> dict:
    data = {
        "pageNumber": 1,
        "keyword": keyword,
        "fromFilter": False,
        "rowsPerPage": max_results,
        "sortValue": "",
        "sortField": "",
        "customDistance": "",
        "gps": "",
        "propValueStr": {},
        "customGps": "",
        "searchReqFromPage": "pcSearch",
    }
    return request_mtop_api(cookie_jar, "mtop.taobao.idlemtopsearch.pc.search", data, f"https://www.goofish.com/search?q={keyword}")


def request_mtop_detail(cookie_jar: dict[str, str], item_id: str) -> dict:
    return request_mtop_api(cookie_jar, "mtop.taobao.idle.pc.detail", {"itemId": item_id}, f"https://www.goofish.com/item?id={item_id}")


def request_mtop_api(cookie_jar: dict[str, str], api: str, data: dict, referer: str) -> dict:
    app_key = "34839810"
    token = cookie_jar.get("_m_h5_tk", "").split("_")[0]
    if not token:
        raise ValueError("missing _m_h5_tk")

    data_json = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    timestamp = str(int(time.time() * 1000))
    sign = hashlib.md5(f"{token}&{timestamp}&{app_key}&{data_json}".encode()).hexdigest()
    params = {
        "jsv": "2.7.3",
        "appKey": app_key,
        "t": timestamp,
        "sign": sign,
        "api": api,
        "v": "1.0",
        "type": "originaljson",
        "dataType": "json",
        "accountSite": "xianyu",
        "timeout": "20000",
        "data": data_json,
    }
    url = f"https://h5api.m.goofish.com/h5/{api}/1.0/?" + urlencode(params)
    request = Request(
        url,
        headers={
            "Cookie": "; ".join(f"{name}={value}" for name, value in cookie_jar.items()),
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
            ),
            "Referer": referer,
            "Origin": "https://www.goofish.com",
            "Accept": "application/json,text/plain,*/*",
        },
        method="GET",
    )
    with urlopen(request, timeout=20, context=ssl._create_unverified_context()) as response:
        payload = response.read().decode("utf-8", "replace")
    return json.loads(payload)


def enrich_listing_counts(cookie_jar: dict[str, str], listing: Listing) -> None:
    try:
        response = request_mtop_detail(cookie_jar, listing.item_id)
    except (URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        print(f"Goofish detail count fetch failed for {listing.item_id}: {exc}", file=sys.stderr, flush=True)
        return

    ret = response.get("ret") or []
    if ret and not str(ret[0]).startswith("SUCCESS"):
        return
    item_do = (response.get("data") or {}).get("itemDO") or {}
    detail_want_count = parse_int(item_do.get("wantCnt"))
    detail_browse_count = parse_int(item_do.get("browseCnt"))
    if detail_want_count is not None:
        listing.want_count = detail_want_count
    if detail_browse_count is not None:
        listing.browse_count = detail_browse_count
    listing.raw_text = clean_text(" ".join(
        part for part in [
            listing.raw_text,
            f"{listing.want_count}人想要" if listing.want_count is not None else "",
            f"{listing.browse_count}浏览" if listing.browse_count is not None else "",
        ]
        if part
    ))


def parse_mtop_listing(row: dict, keyword: str, position: int) -> Listing | None:
    main = (((row.get("data") or {}).get("item") or {}).get("main")) or {}
    ex_content = main.get("exContent") or {}
    args = ((main.get("clickParam") or {}).get("args")) or {}
    detail_params = ex_content.get("detailParams") or {}

    item_id = str(ex_content.get("itemId") or detail_params.get("itemId") or args.get("item_id") or args.get("id") or "")
    if not item_id:
        return None

    title = clean_text(str(detail_params.get("title") or ex_content.get("title") or ""))
    price = parse_int(detail_params.get("soldPrice") or args.get("displayPrice") or args.get("price") or ex_content.get("price"))
    location = clean_text(str(ex_content.get("area") or args.get("p_city") or "")) or None
    tag_text = json.dumps(ex_content.get("fishTags") or {}, ensure_ascii=False)
    want_count = parse_count_from_text(tag_text, r"(\d+)\s*人想要") or parse_int(ex_content.get("want") or args.get("wantNum"))
    browse_count = parse_count_from_text(tag_text, r"(\d+)\s*浏览")
    seller_credit = extract_mtop_credit(ex_content)
    category_id = str(args.get("cCatId") or args.get("catId") or "")
    raw_text = clean_text(" ".join(
        part for part in [
            title,
            f"¥ {price}" if price is not None else "",
            f"{want_count}人想要" if want_count is not None else "",
            f"{browse_count}浏览" if browse_count is not None else "",
            location or "",
            seller_credit or "",
        ]
        if part
    ))

    return Listing(
        item_id=item_id,
        title=title or item_id,
        price=price,
        location=location,
        want_count=want_count,
        browse_count=browse_count,
        seller_credit=seller_credit,
        source_url=build_item_url(item_id, category_id),
        raw_text=raw_text or title or item_id,
        keyword=keyword,
        position=position,
    )


def extract_mtop_credit(ex_content: dict) -> str | None:
    text = json.dumps(ex_content.get("fishTags") or {}, ensure_ascii=False)
    for label in ["卖家信用极好", "卖家信用优秀", "百分百好评", "回复超快"]:
        if label in text:
            return label
    return None


def try_search_existing_session(playwright, profile_dir: Path, keywords: list[str], max_results: int) -> dict[str, int | bool | str | None] | None:
    context = launch_context(playwright, profile_dir, settings.goofish_search_headless)
    page = get_live_page(context)
    try:
        page.goto("https://www.goofish.com/search?q=turbo5max", wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        if not is_logged_in(page):
            return None

        all_listings: list[Listing] = []
        for keyword in keywords:
            all_listings.extend(search_keyword(page, keyword, max_results))

        inserted, updated, matched = save_listings(all_listings)
        return {
            "inserted": inserted,
            "updated": updated,
            "matched": matched,
            "login_required": False,
            "message": None,
        }
    except PlaywrightError as exc:
        print(f"Existing Goofish session check failed: {exc}", file=sys.stderr, flush=True)
        return None
    finally:
        context.close()


def perform_visible_login(playwright, profile_dir: Path, login_timeout: int) -> bool:
    context = launch_context(playwright, profile_dir, headless=False)
    page = get_live_page(context)
    try:
        return ensure_logged_in(page, login_timeout)
    finally:
        context.close()


def ensure_logged_in(page, login_timeout: int) -> bool:
    page.goto("https://www.goofish.com/search?q=turbo5max", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    if is_logged_in(page):
        return False

    print("Goofish login is required. Scan the QR code in the opened browser window.", file=sys.stderr, flush=True)
    page.goto("https://www.goofish.com/login", wait_until="domcontentloaded")
    deadline = time.monotonic() + login_timeout
    redirected_at: float | None = None
    probed_after_redirect = False
    while time.monotonic() < deadline:
        page.wait_for_timeout(2000)
        if is_logged_in(page):
            return False

        # Do not refresh the login page while the QR code flow is active. After a
        # successful scan, the page may briefly redirect while cookies settle.
        if not is_login_url(page.url):
            redirected_at = redirected_at or time.monotonic()
        if redirected_at and not probed_after_redirect and time.monotonic() - redirected_at >= 8:
            probed_after_redirect = True
            page.goto("https://www.goofish.com/search?q=turbo5max", wait_until="domcontentloaded")
            page.wait_for_timeout(4000)
            if is_logged_in(page):
                return False

    page.goto("https://www.goofish.com/search?q=turbo5max", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    if is_logged_in(page):
        return False
    return True


def is_logged_in(page) -> bool:
    text = safe_inner_text(page)
    hrefs = safe_href_text(page)
    return bool(re.search(r"订单|网页版发闲置|Y\d{3,}|/personal", f"{text} {hrefs} {page.url}"))


def is_login_url(url: str) -> bool:
    return bool(re.search(r"passport\.goofish\.com|/login|mini_login|login", url))


def search_keyword(page, keyword: str, max_results: int) -> list[Listing]:
    url = "https://www.goofish.com/search?" + urlencode({"q": keyword, "spm": "a21ybx.home.searchInput.0"})
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    listings = extract_listings(page, keyword)
    return listings[:max_results]


def extract_listings(page, keyword: str) -> list[Listing]:
    rows = page.evaluate(
        """
        () => Array.from(document.querySelectorAll('a'))
          .map((a) => ({
            href: a.href || '',
            text: (a.innerText || a.textContent || '').replace(/\\s+/g, ' ').trim()
          }))
          .filter((x) => /\\/item\\?id=/.test(x.href) && x.text)
        """
    )
    listings = []
    seen = set()
    for row in rows:
        item_id = extract_item_id(row["href"])
        if not item_id or item_id in seen:
            continue
        seen.add(item_id)
        raw_text = row["text"]
        listings.append(
            Listing(
                item_id=item_id,
                title=parse_title(raw_text),
                price=parse_price(raw_text),
                location=parse_location(raw_text),
                want_count=parse_want_count(raw_text),
                browse_count=parse_browse_count(raw_text),
                seller_credit=parse_seller_credit(raw_text),
                source_url=normalize_item_url(row["href"]),
                raw_text=raw_text,
                keyword=keyword,
                position=len(listings) + 1,
            )
        )
    return listings


def save_listings(listings: list[Listing]) -> tuple[int, int, int]:
    inserted = 0
    updated = 0
    matched = 0
    with get_connection() as conn:
        for listing in listings:
            existing = conn.execute(
                """
                SELECT title, price, location, want_count, browse_count, seller_credit, source_url, raw_text
                FROM goofish_listings
                WHERE item_id = %s
                """,
                (listing.item_id,),
            ).fetchone()
            incoming = {
                "title": listing.title,
                "price": listing.price,
                "location": listing.location,
                "want_count": listing.want_count,
                "browse_count": listing.browse_count,
                "seller_credit": listing.seller_credit,
                "source_url": listing.source_url,
                "raw_text": listing.raw_text,
            }
            effective_incoming = incoming
            if existing:
                effective_incoming = {
                    **incoming,
                    "browse_count": incoming["browse_count"] if incoming["browse_count"] is not None else existing["browse_count"],
                    "seller_credit": incoming["seller_credit"] or existing["seller_credit"],
                    "raw_text": (
                        existing["raw_text"]
                        if incoming["browse_count"] is None and existing["browse_count"] is not None
                        else incoming["raw_text"]
                    ),
                }
            changed = not existing or dict(existing) != effective_incoming
            conn.execute(
                """
                INSERT INTO goofish_listings (
                    item_id, title, price, location, want_count, browse_count, seller_credit, source_url, raw_text,
                    first_seen_at, last_seen_at, updated_at
                )
                VALUES (
                    %(item_id)s, %(title)s, %(price)s, %(location)s, %(want_count)s, %(browse_count)s, %(seller_credit)s,
                    %(source_url)s, %(raw_text)s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                ON CONFLICT (item_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    price = EXCLUDED.price,
                    location = EXCLUDED.location,
                    want_count = EXCLUDED.want_count,
                    browse_count = COALESCE(EXCLUDED.browse_count, goofish_listings.browse_count),
                    seller_credit = COALESCE(EXCLUDED.seller_credit, goofish_listings.seller_credit),
                    source_url = EXCLUDED.source_url,
                    raw_text = CASE
                        WHEN EXCLUDED.browse_count IS NULL AND goofish_listings.browse_count IS NOT NULL
                        THEN goofish_listings.raw_text
                        ELSE EXCLUDED.raw_text
                    END,
                    last_seen_at = CURRENT_TIMESTAMP,
                    updated_at = CASE
                        WHEN goofish_listings.title IS DISTINCT FROM EXCLUDED.title
                            OR goofish_listings.price IS DISTINCT FROM EXCLUDED.price
                            OR goofish_listings.location IS DISTINCT FROM EXCLUDED.location
                            OR goofish_listings.want_count IS DISTINCT FROM EXCLUDED.want_count
                            OR goofish_listings.browse_count IS DISTINCT FROM COALESCE(EXCLUDED.browse_count, goofish_listings.browse_count)
                            OR goofish_listings.seller_credit IS DISTINCT FROM COALESCE(EXCLUDED.seller_credit, goofish_listings.seller_credit)
                            OR goofish_listings.source_url IS DISTINCT FROM EXCLUDED.source_url
                            OR goofish_listings.raw_text IS DISTINCT FROM CASE
                                WHEN EXCLUDED.browse_count IS NULL AND goofish_listings.browse_count IS NOT NULL
                                THEN goofish_listings.raw_text
                                ELSE EXCLUDED.raw_text
                            END
                        THEN CURRENT_TIMESTAMP
                        ELSE goofish_listings.updated_at
                    END
                """,
                {**incoming, "item_id": listing.item_id},
            )
            conn.execute(
                """
                INSERT INTO goofish_listing_matches (
                    item_id, keyword, result_position, first_seen_at, last_seen_at
                )
                VALUES (%s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (item_id, keyword) DO UPDATE SET
                    result_position = EXCLUDED.result_position,
                    last_seen_at = CURRENT_TIMESTAMP
                """,
                (listing.item_id, listing.keyword, listing.position),
            )
            inserted += 1 if not existing else 0
            updated += 1 if existing and changed else 0
            matched += 1
        conn.commit()
    return inserted, updated, matched


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--keyword", action="append", default=[])
    parser.add_argument("--max-results", type=int, default=30)
    parser.add_argument("--login-timeout", type=int, default=settings.goofish_login_timeout_seconds)
    return parser.parse_args()


def normalize_keywords(keywords: list[str]) -> list[str]:
    normalized = []
    seen = set()
    for keyword in keywords:
        value = re.sub(r"\s+", " ", keyword).strip()
        if value and value not in seen:
            seen.add(value)
            normalized.append(value)
    return normalized


def resolve_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return (Path.cwd() / path).resolve()


def safe_inner_text(page) -> str:
    try:
        return page.locator("body").inner_text(timeout=5000)
    except PlaywrightError:
        return ""


def safe_href_text(page) -> str:
    try:
        return " ".join(page.evaluate("() => Array.from(document.querySelectorAll('a')).map((a) => a.href).slice(0, 80)"))
    except PlaywrightError:
        return ""


def extract_item_id(url: str) -> str | None:
    query = parse_qs(urlparse(url).query)
    values = query.get("id") or []
    return values[0] if values else None


def normalize_item_url(url: str) -> str:
    parsed = urlparse(url)
    item_id = extract_item_id(url)
    category_id = (parse_qs(parsed.query).get("categoryId") or [""])[0]
    query = {"id": item_id}
    if category_id:
        query["categoryId"] = category_id
    return f"https://www.goofish.com/item?{urlencode(query)}"


def build_item_url(item_id: str, category_id: str = "") -> str:
    query = {"id": item_id}
    if category_id:
        query["categoryId"] = category_id
    return f"https://www.goofish.com/item?{urlencode(query)}"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def parse_int(value) -> int | None:
    if value is None:
        return None
    match = re.search(r"\d+(?:\.\d+)?", str(value).replace(",", ""))
    return round(float(match.group(0))) if match else None


def parse_title(text: str) -> str:
    cleaned = re.split(r"\s*[¥￥]\s*\d+", text, maxsplit=1)[0].strip()
    return cleaned[:300] if cleaned else text[:300]


def parse_price(text: str) -> int | None:
    match = re.search(r"[¥￥]\s*([0-9]+(?:\.[0-9]+)?)", text)
    return round(float(match.group(1))) if match else None


def parse_want_count(text: str) -> int | None:
    match = re.search(r"(\d+)\s*人想要", text)
    return int(match.group(1)) if match else None


def parse_browse_count(text: str) -> int | None:
    return parse_count_from_text(text, r"(\d+)\s*浏览")


def parse_count_from_text(text: str, pattern: str) -> int | None:
    match = re.search(pattern, text)
    return int(match.group(1)) if match else None


def parse_seller_credit(text: str) -> str | None:
    match = re.search(r"(卖家信用[^\s]+|百分百好评|回复超快)", text)
    return match.group(1) if match else None


def parse_location(text: str) -> str | None:
    provinces = (
        "北京|上海|天津|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|"
        "海南|四川|贵州|云南|陕西|甘肃|青海|台湾|内蒙古|广西|西藏|宁夏|新疆|香港|澳门"
    )
    matches = re.findall(provinces, text)
    return matches[-1] if matches else None


if __name__ == "__main__":
    raise SystemExit(main())
