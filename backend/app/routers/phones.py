from fastapi import APIRouter
from pydantic import BaseModel

from app.database import get_connection

router = APIRouter(prefix="/phones", tags=["phones"])


class PhoneSummary(BaseModel):
    id: str
    name: str
    brand: str
    score: int
    source: str | None = None
    source_product_id: str | None = None
    price: int | None = None
    specs: str | None = None
    image_url: str | None = None
    source_url: str | None = None
    version_count: int = 0


class PhoneVersion(BaseModel):
    config_id: str
    phone_id: str
    title: str
    price: int | None = None
    specs: list[dict[str, str]]
    source_url: str | None = None


@router.get("", response_model=list[PhoneSummary])
def list_phones() -> list[PhoneSummary]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                p.id,
                p.name,
                p.brand,
                p.score,
                p.source,
                p.source_product_id,
                p.price,
                p.specs,
                p.image_url,
                p.source_url,
                COUNT(v.config_id)::int AS version_count
            FROM phones p
            LEFT JOIN phone_versions v ON v.phone_id = p.id
            GROUP BY p.id
            ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC, p.id ASC
            """
        ).fetchall()

    return [PhoneSummary(**row) for row in rows]


@router.get("/{phone_id}/versions", response_model=list[PhoneVersion])
def list_phone_versions(phone_id: str) -> list[PhoneVersion]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT config_id, phone_id, title, price, specs, source_url
            FROM phone_versions
            WHERE phone_id = %s
            ORDER BY price NULLS LAST, title ASC
            """,
            (phone_id,),
        ).fetchall()

    return [PhoneVersion(**row) for row in rows]
