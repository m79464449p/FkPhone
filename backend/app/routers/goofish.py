import json
import re
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.config import settings
from app.database import get_connection

router = APIRouter(prefix="/goofish", tags=["goofish"])


class GoofishListing(BaseModel):
    item_id: str
    title: str
    price: int | None = None
    location: str | None = None
    want_count: int | None = None
    browse_count: int | None = None
    seller_credit: str | None = None
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

    try:
        result = subprocess.run(
            command,
            cwd=Path(__file__).resolve().parents[2],
            capture_output=True,
            text=True,
            timeout=settings.crawler_timeout_seconds + (payload.login_timeout_seconds or settings.goofish_login_timeout_seconds),
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="goofish search timed out") from exc

    output = f"{result.stdout}\n{result.stderr}"
    response_payload = parse_json_tail(output)
    if result.returncode != 0:
        detail = response_payload or {"message": output[-2000:]}
        raise HTTPException(status_code=500, detail=detail)

    if not response_payload:
        raise HTTPException(status_code=500, detail=output[-2000:])

    return GoofishSearchResponse(**response_payload)


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
