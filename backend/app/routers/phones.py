import json

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.database import get_connection

router = APIRouter(prefix="/phones", tags=["phones"])


class PhoneSummary(BaseModel):
    id: str
    name: str
    brand: str
    series: str | None = None
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


class PhoneSpecFilterValue(BaseModel):
    value: str
    phone_count: int
    version_count: int


class PhoneSpecFilter(BaseModel):
    key: str
    group: str
    subgroup: str
    name: str
    label: str
    phone_count: int
    values: list[PhoneSpecFilterValue]


@router.get("", response_model=list[PhoneSummary])
def list_phones(
    spec_filter: list[str] = Query(default=[]),
    performance_floor: str = "",
) -> list[PhoneSummary]:
    spec_filters = parse_spec_filters(spec_filter)
    min_performance_rank = performance_floor_rank(performance_floor)
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                p.id,
                p.name,
                p.brand,
                p.series,
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
            WHERE (
                %(spec_filters)s::jsonb = '[]'::jsonb
                OR NOT EXISTS (
                    SELECT 1
                    FROM jsonb_to_recordset(%(spec_filters)s::jsonb) AS selected_filter(key text, value text)
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM phone_versions filter_version
                        CROSS JOIN LATERAL jsonb_array_elements(filter_version.specs) AS spec
                        WHERE filter_version.phone_id = p.id
                          AND CONCAT(
                              COALESCE(spec->>'group', ''),
                              CHR(31),
                              COALESCE(spec->>'subgroup', ''),
                              CHR(31),
                              COALESCE(spec->>'name', '')
                          ) = selected_filter.key
                          AND COALESCE(spec->>'value', '') = selected_filter.value
                    )
                )
            )
            AND (
                %(min_performance_rank)s = 0
                OR rank_chip_text(COALESCE(p.specs, '')) >= %(min_performance_rank)s
                OR EXISTS (
                    SELECT 1
                    FROM phone_versions performance_version
                    CROSS JOIN LATERAL jsonb_array_elements(performance_version.specs) AS performance_spec
                    WHERE performance_version.phone_id = p.id
                      AND COALESCE(performance_spec->>'name', '') IN ('芯片', 'SoC型号', 'SoC 型号', '处理器', 'CPU型号')
                      AND rank_chip_text(COALESCE(performance_spec->>'value', '')) >= %(min_performance_rank)s
                )
            )
            GROUP BY p.id
            ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC, p.id ASC
            """,
            {
                "spec_filters": json.dumps(spec_filters, ensure_ascii=False),
                "min_performance_rank": min_performance_rank,
            },
        ).fetchall()

    return [PhoneSummary(**row) for row in rows]


@router.get("/spec-filters", response_model=list[PhoneSpecFilter])
def list_phone_spec_filters() -> list[PhoneSpecFilter]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                COALESCE(spec->>'group', '') AS group_name,
                COALESCE(spec->>'subgroup', '') AS subgroup_name,
                COALESCE(spec->>'name', '') AS spec_name,
                COALESCE(spec->>'value', '') AS spec_value,
                COUNT(DISTINCT v.phone_id)::int AS phone_count,
                COUNT(DISTINCT v.config_id)::int AS version_count
            FROM phone_versions v
            CROSS JOIN LATERAL jsonb_array_elements(v.specs) AS spec
            WHERE COALESCE(spec->>'name', '') <> ''
              AND COALESCE(spec->>'value', '') <> ''
            GROUP BY group_name, subgroup_name, spec_name, spec_value
            ORDER BY spec_name ASC, phone_count DESC, spec_value ASC
            """
        ).fetchall()

    filters_by_key: dict[str, PhoneSpecFilter] = {}
    for row in rows:
        group = row["group_name"]
        subgroup = row["subgroup_name"]
        name = row["spec_name"]
        key = make_spec_key(group, subgroup, name)
        if key not in filters_by_key:
            filters_by_key[key] = PhoneSpecFilter(
                key=key,
                group=group,
                subgroup=subgroup,
                name=name,
                label=make_spec_label(group, subgroup, name),
                phone_count=0,
                values=[],
            )
        spec_filter_item = filters_by_key[key]
        spec_filter_item.phone_count += row["phone_count"]
        spec_filter_item.values.append(
            PhoneSpecFilterValue(
                value=row["spec_value"],
                phone_count=row["phone_count"],
                version_count=row["version_count"],
            )
        )

    return sorted(
        filters_by_key.values(),
        key=lambda item: (-sum(value.phone_count for value in item.values), item.label),
    )


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


def make_spec_key(group: str, subgroup: str, name: str) -> str:
    return "\x1f".join([group.strip(), subgroup.strip(), name.strip()])


def make_spec_label(group: str, subgroup: str, name: str) -> str:
    parts = [part.strip() for part in [group, subgroup, name] if part.strip()]
    return " / ".join(parts) if parts else name.strip()


def parse_spec_filters(raw_filters: list[str]) -> list[dict[str, str]]:
    parsed_filters: list[dict[str, str]] = []
    seen = set()
    for raw_filter in raw_filters:
        key, separator, value = raw_filter.partition("=")
        key = key.strip()
        value = value.strip()
        if not separator or not key or not value:
            continue
        identity = (key, value)
        if identity in seen:
            continue
        seen.add(identity)
        parsed_filters.append({"key": key, "value": value})
    return parsed_filters


def performance_floor_rank(performance_floor: str) -> int:
    ranks = {
        "snapdragon_8_gen3": 100,
        "snapdragon_8_elite": 110,
        "snapdragon_8_elite_gen5": 120,
    }
    return ranks.get(performance_floor, 0)


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
