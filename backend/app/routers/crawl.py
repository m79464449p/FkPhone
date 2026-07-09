import re
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import settings

router = APIRouter(prefix="/crawl", tags=["crawl"])


class CrawlRequest(BaseModel):
    max_pages: int = Field(default=1, ge=1, le=5)
    fetch_versions: bool = True


class CrawlResponse(BaseModel):
    status: str
    max_pages: int
    fetch_versions: bool
    inserted: int
    updated: int
    skipped_unchanged: int
    version_inserted: int
    version_updated: int
    version_skipped_unchanged: int


@router.post("/coolapk", response_model=CrawlResponse)
def crawl_coolapk(payload: CrawlRequest) -> CrawlResponse:
    workdir = Path(__file__).resolve().parents[3] / "crawler"
    if settings.crawler_workdir:
        configured_workdir = Path(settings.crawler_workdir)
        workdir = configured_workdir if configured_workdir.is_absolute() else Path(__file__).resolve().parents[2] / configured_workdir

    command = [
        settings.crawler_command,
        "crawl",
        "coolapk_phone",
        "-s",
        f"COOLAPK_MAX_PAGES={payload.max_pages}",
        "-s",
        f"COOLAPK_FETCH_VERSIONS={'true' if payload.fetch_versions else 'false'}",
        "-s",
        "LOG_LEVEL=INFO",
    ]

    try:
        result = subprocess.run(
            command,
            cwd=workdir,
            capture_output=True,
            text=True,
            timeout=settings.crawler_timeout_seconds,
            check=False,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=f"crawler command not found: {settings.crawler_command}") from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="crawler timed out") from exc

    output = f"{result.stdout}\n{result.stderr}"
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=output[-2000:])

    return CrawlResponse(
        status="ok",
        max_pages=payload.max_pages,
        fetch_versions=payload.fetch_versions,
        inserted=parse_stat(output, "phone/inserted"),
        updated=parse_stat(output, "phone/updated"),
        skipped_unchanged=parse_stat(output, "phone/skipped_unchanged"),
        version_inserted=parse_stat(output, "phone_version/inserted"),
        version_updated=parse_stat(output, "phone_version/updated"),
        version_skipped_unchanged=parse_stat(output, "phone_version/skipped_unchanged"),
    )


def parse_stat(output: str, key: str) -> int:
    match = re.search(rf"'{re.escape(key)}':\s*(\d+)", output)
    return int(match.group(1)) if match else 0
