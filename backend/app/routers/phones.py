from fastapi import APIRouter, HTTPException, Query
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


class CompareColumn(BaseModel):
    config_id: str
    phone_id: str
    phone_name: str
    title: str
    price: int | None = None
    source_url: str | None = None


class CompareRow(BaseModel):
    group: str
    subgroup: str
    name: str
    values: dict[str, str | None]


class PhoneCompare(BaseModel):
    columns: list[CompareColumn]
    rows: list[CompareRow]


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


@router.get("/compare", response_model=PhoneCompare)
def compare_phone_versions(
    config_ids: list[str] = Query(..., min_length=1),
) -> PhoneCompare:
    normalized_config_ids = normalize_config_ids(config_ids)
    if len(normalized_config_ids) < 2:
        raise HTTPException(status_code=400, detail="at least two config_ids are required")
    if len(normalized_config_ids) > 6:
        raise HTTPException(status_code=400, detail="at most six config_ids can be compared")

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                v.config_id,
                v.phone_id,
                p.name AS phone_name,
                v.title,
                v.price,
                v.specs,
                v.source_url
            FROM phone_versions v
            JOIN phones p ON p.id = v.phone_id
            WHERE v.config_id = ANY(%s)
            """,
            (normalized_config_ids,),
        ).fetchall()

    by_config_id = {row["config_id"]: row for row in rows}
    missing_ids = [config_id for config_id in normalized_config_ids if config_id not in by_config_id]
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"config_ids not found: {', '.join(missing_ids)}")

    ordered_rows = [by_config_id[config_id] for config_id in normalized_config_ids]
    columns = [
        CompareColumn(
            config_id=row["config_id"],
            phone_id=row["phone_id"],
            phone_name=row["phone_name"],
            title=row["title"],
            price=row["price"],
            source_url=row["source_url"],
        )
        for row in ordered_rows
    ]

    return PhoneCompare(
        columns=columns,
        rows=build_compare_rows(ordered_rows, normalized_config_ids),
    )


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


def normalize_config_ids(config_ids: list[str]) -> list[str]:
    seen = set()
    normalized = []
    for raw_config_id in config_ids:
        for config_id in raw_config_id.split(","):
            config_id = config_id.strip()
            if config_id and config_id not in seen:
                seen.add(config_id)
                normalized.append(config_id)
    return normalized


def normalize_spec_name(name: str) -> str:
    return " ".join(name.strip().casefold().split())


def build_compare_rows(
    version_rows: list[dict], config_ids: list[str]
) -> list[CompareRow]:
    spec_order: list[str] = []
    spec_labels: dict[str, tuple[str, str, str]] = {}
    spec_values: dict[str, dict[str, str | None]] = {}

    for row in version_rows:
        for spec in row["specs"] or []:
            name = str(spec.get("name") or "").strip()
            if not name:
                continue
            group = str(spec.get("group") or "").strip()
            subgroup = str(spec.get("subgroup") or "").strip()
            key = normalize_spec_name(name)
            if key not in spec_values:
                spec_order.append(key)
                spec_labels[key] = (group, subgroup, name)
                spec_values[key] = {config_id: None for config_id in config_ids}
            spec_values[key][row["config_id"]] = str(spec.get("value") or "")

    return [
        CompareRow(group=group, subgroup=subgroup, name=name, values=spec_values[key])
        for key in spec_order
        for group, subgroup, name in [spec_labels[key]]
    ]
