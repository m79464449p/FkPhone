import ssl

from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query, Response

router = APIRouter(prefix="/images", tags=["images"])

ALLOWED_IMAGE_HOSTS = {"image.coolapk.com"}
COOLAPK_REFERER = "https://www.coolapk.com/"
DEFAULT_CONTENT_TYPE = "application/octet-stream"


@router.get("/proxy")
def proxy_image(url: str = Query(..., min_length=1)) -> Response:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_IMAGE_HOSTS:
        raise HTTPException(status_code=400, detail="不支持的图片地址")

    request = Request(
        url,
        headers={
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
            "Referer": COOLAPK_REFERER,
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        },
    )

    try:
        with urlopen(request, timeout=15, context=ssl._create_unverified_context()) as upstream:
            content_type = upstream.headers.get_content_type() or DEFAULT_CONTENT_TYPE
            if not content_type.startswith("image/"):
                raise HTTPException(status_code=502, detail="上游没有返回图片")

            return Response(
                content=upstream.read(),
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=86400"},
            )
    except HTTPException:
        raise
    except HTTPError as err:
        raise HTTPException(status_code=err.code, detail="图片加载失败") from err
    except URLError as err:
        raise HTTPException(status_code=502, detail="图片加载失败") from err
