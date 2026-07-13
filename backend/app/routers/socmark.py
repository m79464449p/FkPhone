from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.socmark_api import (
    BASE_URLS,
    HEADER_NOTES,
    SocmarkAPIError,
    build_header_status,
    build_reversed_headers,
    call_socmark_endpoint,
    list_endpoint_catalog,
)

router = APIRouter(prefix="/socmark", tags=["socmark"])


class SocmarkCallRequest(BaseModel):
    endpoint: str
    base_url: str | None = None
    payload: dict[str, Any] | None = None
    datastr: str | None = Field(default="abcde")
    uniid: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    apk_options: dict[str, Any] = Field(default_factory=dict)


@router.get("/endpoints")
def list_socmark_endpoints() -> dict[str, Any]:
    return {
        "base_urls": BASE_URLS,
        "endpoints": list_endpoint_catalog(),
        "header_notes": HEADER_NOTES,
    }


@router.post("/call")
def call_socmark(request: SocmarkCallRequest) -> dict[str, Any]:
    try:
        return call_socmark_endpoint(
            endpoint_key=request.endpoint,
            payload=request.payload,
            base_url=request.base_url,
            datastr=request.datastr,
            uniid=request.uniid,
            extra_headers=request.headers,
            apk_options=request.apk_options,
        )
    except SocmarkAPIError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@router.post("/headers")
def preview_socmark_headers(request: SocmarkCallRequest) -> dict[str, Any]:
    headers = build_reversed_headers(
        datastr=request.datastr,
        uniid=request.uniid,
        extra_headers=request.headers,
        interceptor_a=request.apk_options.get("interceptor_a"),
        interceptor_b=request.apk_options.get("interceptor_b"),
        interceptor_c=request.apk_options.get("interceptor_c"),
        battery_value=request.apk_options.get("battery_value"),
        board_value=request.apk_options.get("board_value"),
        dynamic_dex_value=request.apk_options.get("dynamic_dex_value"),
        time_offset_ms=int(request.apk_options.get("time_offset_ms") or 0),
    )
    return {
        "request_headers": headers,
        "header_status": build_header_status(headers),
    }
