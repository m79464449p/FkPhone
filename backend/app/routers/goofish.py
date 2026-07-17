import json
import re
import shutil
import subprocess
import sys
import threading
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_connection

router = APIRouter(prefix="/goofish", tags=["goofish"])
goofish_process_lock = threading.Lock()
goofish_process: subprocess.Popen[str] | None = None


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
        detail = response_payload or {"message": output[-2000:]}
        raise HTTPException(status_code=500, detail=detail)

    if not response_payload:
        raise HTTPException(status_code=500, detail=output[-2000:])

    return GoofishSearchResponse(**response_payload)


@router.post("/login", response_model=GoofishSearchResponse)
def login_goofish(payload: GoofishSearchRequest) -> GoofishSearchResponse:
    global goofish_process

    command = [
        sys.executable,
        "-m",
        "app.services.goofish_browser_search",
        "--login-only",
        "--login-timeout",
        str(payload.login_timeout_seconds or settings.goofish_login_timeout_seconds),
    ]

    timeout = payload.login_timeout_seconds or settings.goofish_login_timeout_seconds
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
        stdout, stderr = active_process.communicate(timeout=timeout + 30)
    except subprocess.TimeoutExpired as exc:
        terminate_goofish_process()
        raise HTTPException(status_code=504, detail="goofish login timed out") from exc
    finally:
        with goofish_process_lock:
            if goofish_process is active_process and active_process.poll() is not None:
                goofish_process = None

    output = f"{stdout}\n{stderr}"
    response_payload = parse_json_tail(output)
    if active_process.returncode != 0:
        detail = response_payload or {"message": output[-2000:]}
        raise HTTPException(status_code=500, detail=detail)

    if not response_payload:
        raise HTTPException(status_code=500, detail=output[-2000:])

    return GoofishSearchResponse(**response_payload)


@router.delete("/search")
def cancel_goofish_search() -> dict[str, bool]:
    return {"cancelled": terminate_goofish_process()}


@router.delete("/session", response_model=GoofishSessionResetResponse)
def reset_goofish_session() -> GoofishSessionResetResponse:
    search_cancelled = terminate_goofish_process()
    cookie_file_removed = remove_path(resolve_app_path(settings.goofish_cookie_file))
    profile_removed = remove_path(resolve_app_path(settings.goofish_profile_dir))
    return GoofishSessionResetResponse(
        status="ok",
        cookie_file_removed=cookie_file_removed,
        profile_removed=profile_removed,
        search_cancelled=search_cancelled,
        message="已清空服务器端闲鱼登录态。线上禁用了可视化登录窗口，重新登录需要导入有效 Cookie 或临时开启 GOOFISH_HEADLESS=false。",
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
