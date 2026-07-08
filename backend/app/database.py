from collections.abc import Generator
from contextlib import contextmanager

import psycopg
from psycopg import Connection
from psycopg.rows import dict_row

from app.config import settings


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS phones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE phones ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS source_product_id TEXT;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS price INTEGER;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS specs TEXT;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE phones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_phones_source_product
ON phones (source, source_product_id)
WHERE source IS NOT NULL AND source_product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS phone_versions (
    config_id TEXT PRIMARY KEY,
    phone_id TEXT NOT NULL REFERENCES phones(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_product_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price INTEGER,
    specs JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_url TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phone_versions_phone_id
ON phone_versions (phone_id);

INSERT INTO phones (id, name, brand, score)
VALUES
    ('demo-iphone', 'iPhone Demo', 'Apple', 88),
    ('demo-android', 'Android Demo', 'Demo', 82)
ON CONFLICT (id) DO NOTHING;
"""


@contextmanager
def get_connection() -> Generator[Connection, None, None]:
    with psycopg.connect(settings.database_url, row_factory=dict_row) as conn:
        yield conn


def init_database() -> None:
    with get_connection() as conn:
        conn.execute(SCHEMA_SQL)
        conn.commit()
