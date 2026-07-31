import json
import re
import shutil
import subprocess
import sys
import threading
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_connection
from app.services.goofish_browser_search import has_mtop_login_cookies, write_cookie_file
from app.services.goofish_login_session import GoofishLoginSession

router = APIRouter(prefix="/goofish", tags=["goofish"])
goofish_process_lock = threading.Lock()
goofish_process: subprocess.Popen[str] | None = None
goofish_login_session: GoofishLoginSession | None = None


class GoofishListing(BaseModel):
    item_id: str
    title: str
    price: int | None = None
    location: str | None = None
    want_count: int | None = None
    browse_count: int | None = None
    seller_credit: str | None = None
    image_url: str | None = None
    image_urls: list[str] = Field(default_factory=list)
    source_url: str
    raw_text: str
    keywords: list[str] = Field(default_factory=list)
    last_seen_at: str | None = None


class GoofishSearchRequest(BaseModel):
    keywords: list[str] = Field(default_factory=lambda: ["turbo5max", "tubro5max"], min_length=1, max_length=10)
    max_results_per_keyword: int = Field(default=30, ge=1, le=100)
    login_timeout_seconds: int | None = Field(default=None, ge=30, le=600)


class GoofishSearchResponse(BaseModel):
    status: str
    keywords: list[str]
    inserted: int
    updated: int
    matched: int
    login_required: bool = False
    message: str | None = None


class GoofishSessionResetResponse(BaseModel):
    status: str
    cookie_file_removed: bool
    profile_removed: bool
    search_cancelled: bool
    message: str


class GoofishCookieImportRequest(BaseModel):
    cookie: str = Field(min_length=1, max_length=20000)


class GoofishCookieImportResponse(BaseModel):
    status: str
    cookie_names: list[str]
    message: str


class GoofishLoginRequest(BaseModel):
    login_timeout_seconds: int | None = Field(default=None, ge=30, le=600)


class GoofishLoginStatusResponse(BaseModel):
    status: str
    active: bool
    message: str
    screenshot_available: bool
    screenshot_version: int


class GoofishLoginSmsRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=20)


class GoofishLoginVerifyRequest(BaseModel):
    code: str = Field(min_length=4, max_length=8)


class GoofishLoginPointerRequest(BaseModel):
    x: float = Field(ge=0, le=1440)
    y: float = Field(ge=0, le=1000)


class GoofishLoginDragRequest(BaseModel):
    start_x: float = Field(ge=0, le=1440)
    start_y: float = Field(ge=0, le=1000)
    end_x: float = Field(ge=0, le=1440)
    end_y: float = Field(ge=0, le=1000)


@router.post("/cookie", response_model=GoofishCookieImportResponse)
def import_goofish_cookie(payload: GoofishCookieImportRequest) -> GoofishCookieImportResponse:
    stop_goofish_login()
    cookie_jar = parse_cookie_input(payload.cookie)
    if not has_mtop_login_cookies(cookie_jar):
        raise HTTPException(status_code=400, detail="Cookie 必须包含 _m_h5_tk 和 unb")
    write_cookie_file(cookie_jar)
    return GoofishCookieImportResponse(
        status="ok",
        cookie_names=sorted(cookie_jar),
        message="闲鱼 Cookie 已导入，请重新搜索验证登录态。",
    )


@router.get("/listings", response_model=list[GoofishListing])
def list_goofish_listings(
    keyword: str | None = Query(default=None, min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[GoofishListing]:
    params: list[object] = []
    where = ""
    if keyword:
        where = "WHERE EXISTS (SELECT 1 FROM goofish_listing_matches m WHERE m.item_id = l.item_id AND m.keyword = %s)"
        params.append(keyword)
    params.append(limit)

    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                l.item_id,
                l.title,
                l.price,
                l.location,
                l.want_count,
                l.browse_count,
                l.seller_credit,
                l.image_url,
                l.image_urls,
                l.source_url,
                l.raw_text,
                l.last_seen_at::text AS last_seen_at,
                COALESCE(
                    ARRAY_AGG(m.keyword ORDER BY m.keyword) FILTER (WHERE m.keyword IS NOT NULL),
                    ARRAY[]::text[]
                ) AS keywords
            FROM goofish_listings l
            LEFT JOIN goofish_listing_matches m ON m.item_id = l.item_id
            {where}
            GROUP BY l.item_id
            ORDER BY l.last_seen_at DESC, l.updated_at DESC
            LIMIT %s
            """,
            params,
        ).fetchall()

    return [GoofishListing(**row) for row in rows]


@router.post("/search", response_model=GoofishSearchResponse)
def search_goofish(payload: GoofishSearchRequest) -> GoofishSearchResponse:
    global goofish_process

    keywords = normalize_keywords(payload.keywords)
    if not keywords:
        raise HTTPException(status_code=400, detail="keywords are required")
    if is_goofish_login_active():
        raise HTTPException(status_code=409, detail="goofish login is already running")

    command = [
        sys.executable,
        "-m",
        "app.services.goofish_browser_search",
        "--max-results",
        str(payload.max_results_per_keyword),
        "--login-timeout",
        str(payload.login_timeout_seconds or settings.goofish_login_timeout_seconds),
    ]
    for keyword in keywords:
        command.extend(["--keyword", keyword])

    timeout = settings.crawler_timeout_seconds + (payload.login_timeout_seconds or settings.goofish_login_timeout_seconds)
    with goofish_process_lock:
        if goofish_process and goofish_process.poll() is None:
            raise HTTPException(status_code=409, detail="goofish search is already running")
        goofish_process = subprocess.Popen(
            command,
            cwd=Path(__file__).resolve().parents[2],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        active_process = goofish_process

    try:
        stdout, stderr = active_process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        terminate_goofish_process()
        raise HTTPException(status_code=504, detail="goofish search timed out") from exc
    finally:
        with goofish_process_lock:
            if goofish_process is active_process and active_process.poll() is not None:
                goofish_process = None

    output = f"{stdout}\n{stderr}"
    response_payload = parse_json_tail(output)
    if active_process.returncode != 0:
        raise HTTPException(status_code=500, detail=format_process_error_detail(response_payload, output))

    if not response_payload:
        raise HTTPException(status_code=500, detail=output[-2000:])

    return GoofishSearchResponse(**response_payload)


@router.post("/login", response_model=GoofishLoginStatusResponse)
def login_goofish(payload: GoofishLoginRequest) -> GoofishLoginStatusResponse:
    with goofish_process_lock:
        if goofish_process and goofish_process.poll() is None:
            raise HTTPException(status_code=409, detail="goofish search is already running")
    status = get_goofish_login_session().start(
        payload.login_timeout_seconds or settings.goofish_login_timeout_seconds
    )
    return GoofishLoginStatusResponse(**status)


@router.get("/login", response_model=GoofishLoginStatusResponse)
def get_goofish_login_status() -> GoofishLoginStatusResponse:
    return GoofishLoginStatusResponse(**get_goofish_login_session().status())


@router.post("/login/sms", response_model=GoofishLoginStatusResponse)
def send_goofish_login_sms(payload: GoofishLoginSmsRequest) -> GoofishLoginStatusResponse:
    try:
        status = get_goofish_login_session().send_sms(payload.phone)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=409 if isinstance(exc, RuntimeError) else 400, detail=str(exc)) from exc
    return GoofishLoginStatusResponse(**status)


@router.post("/login/verify", response_model=GoofishLoginStatusResponse)
def verify_goofish_login(payload: GoofishLoginVerifyRequest) -> GoofishLoginStatusResponse:
    try:
        status = get_goofish_login_session().verify(payload.code)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=409 if isinstance(exc, RuntimeError) else 400, detail=str(exc)) from exc
    return GoofishLoginStatusResponse(**status)


@router.post("/login/click", response_model=GoofishLoginStatusResponse)
def click_goofish_login(payload: GoofishLoginPointerRequest) -> GoofishLoginStatusResponse:
    try:
        status = get_goofish_login_session().click(payload.x, payload.y)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return GoofishLoginStatusResponse(**status)


@router.post("/login/drag", response_model=GoofishLoginStatusResponse)
def drag_goofish_login(payload: GoofishLoginDragRequest) -> GoofishLoginStatusResponse:
    try:
        status = get_goofish_login_session().drag(payload.start_x, payload.start_y, payload.end_x, payload.end_y)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return GoofishLoginStatusResponse(**status)


@router.get("/login/screenshot")
def get_goofish_login_screenshot() -> FileResponse:
    screenshot_path = get_goofish_login_session().screenshot_path
    if not screenshot_path.exists():
        raise HTTPException(status_code=404, detail="login screenshot is not ready")
    return FileResponse(
        screenshot_path,
        media_type="image/png",
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@router.delete("/login")
def cancel_goofish_login() -> dict[str, bool]:
    return {"cancelled": stop_goofish_login()}


@router.delete("/search")
def cancel_goofish_search() -> dict[str, bool]:
    search_cancelled = terminate_goofish_process()
    login_cancelled = stop_goofish_login()
    return {"cancelled": search_cancelled or login_cancelled}


@router.delete("/session", response_model=GoofishSessionResetResponse)
def reset_goofish_session() -> GoofishSessionResetResponse:
    process_cancelled = terminate_goofish_process()
    login_cancelled = stop_goofish_login()
    cookie_file_removed = remove_path(resolve_app_path(settings.goofish_cookie_file))
    remove_path(resolve_app_path(settings.goofish_cookie_file).with_name("login-screenshot.png"))
    profile_removed = remove_path(resolve_app_path(settings.goofish_profile_dir))
    return GoofishSessionResetResponse(
        status="ok",
        cookie_file_removed=cookie_file_removed,
        profile_removed=profile_removed,
        search_cancelled=process_cancelled or login_cancelled,
        message="已清空服务器端闲鱼登录态。请重新完成手机号验证码登录或导入有效 Cookie。",
    )


def terminate_goofish_process() -> bool:
    global goofish_process

    with goofish_process_lock:
        process = goofish_process
        if not process or process.poll() is not None:
            goofish_process = None
            return False

        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)

        goofish_process = None
        return True


def resolve_app_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else Path(__file__).resolve().parents[2] / path


def get_goofish_login_session() -> GoofishLoginSession:
    global goofish_login_session

    profile_dir = resolve_app_path(settings.goofish_profile_dir)
    cookie_file = resolve_app_path(settings.goofish_cookie_file)
    screenshot_path = cookie_file.with_name("login-screenshot.png")
    if goofish_login_session and not goofish_login_session.matches(
        profile_dir, screenshot_path, settings.goofish_headless
    ):
        goofish_login_session.stop()
        goofish_login_session = None
    if not goofish_login_session:
        goofish_login_session = GoofishLoginSession(
            profile_dir=profile_dir,
            screenshot_path=screenshot_path,
            headless=settings.goofish_headless,
        )
    return goofish_login_session


def is_goofish_login_active() -> bool:
    return bool(goofish_login_session and goofish_login_session.status()["active"])


def stop_goofish_login() -> bool:
    return bool(goofish_login_session and goofish_login_session.stop())


def remove_path(path: Path) -> bool:
    try:
        if path.is_dir():
            shutil.rmtree(path)
            return True
        if path.exists():
            path.unlink()
            return True
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"failed to remove {path}: {exc}") from exc
    return False


def parse_cookie_input(raw_cookie: str) -> dict[str, str]:
    value = raw_cookie.strip()
    try:
        payload = json.loads(value)
    except json.JSONDecodeError:
        payload = None

    if isinstance(payload, dict):
        return {str(name): str(cookie_value) for name, cookie_value in payload.items() if cookie_value is not None}
    if isinstance(payload, list):
        return {
            str(cookie.get("name")): str(cookie.get("value"))
            for cookie in payload
            if isinstance(cookie, dict) and cookie.get("name") and cookie.get("value") is not None
        }

    cookie_jar: dict[str, str] = {}
    for part in re.split(r"[;\n\r]+", value):
        name, separator, cookie_value = part.partition("=")
        if separator and name.strip() and cookie_value.strip():
            cookie_jar[name.strip()] = cookie_value.strip().strip('"')
    return cookie_jar


def normalize_keywords(keywords: list[str]) -> list[str]:
    seen = set()
    normalized = []
    for keyword in keywords:
        value = re.sub(r"\s+", " ", keyword).strip()
        if value and value not in seen:
            seen.add(value)
            normalized.append(value)
    return normalized


def parse_json_tail(output: str) -> dict | None:
    for line in reversed(output.splitlines()):
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue
    return None


def format_process_error_detail(response_payload: dict | None, output: str) -> str | dict:
    if response_payload:
        message = response_payload.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()
        return response_payload
    return output[-2000:] or "goofish process failed"
