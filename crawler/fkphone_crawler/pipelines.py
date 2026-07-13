from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from dotenv import dotenv_values

from fkphone_crawler.items import PhoneItem, PhoneVersionItem


class PostgresPhonePipeline:
    def open_spider(self, spider):
        env = dotenv_values(Path(__file__).resolve().parents[2] / ".env")
        database_url = env.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL is required in project .env")

        self.conn = psycopg.connect(database_url, row_factory=dict_row)
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS phones (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                brand TEXT NOT NULL,
                score INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE phones ADD COLUMN IF NOT EXISTS source TEXT;
            ALTER TABLE phones ADD COLUMN IF NOT EXISTS source_product_id TEXT;
            ALTER TABLE phones ADD COLUMN IF NOT EXISTS series TEXT;
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
            """
        )
        self.conn.commit()
        self.stats = spider.crawler.stats

    def close_spider(self, spider):
        self.conn.close()

    def process_item(self, item, spider):
        if isinstance(item, PhoneVersionItem):
            return self.process_phone_version(item)
        if not isinstance(item, PhoneItem):
            return item

        existing = self.conn.execute(
            """
            SELECT source, source_product_id, name, brand, series, score, price, specs, image_url, source_url
            FROM phones
            WHERE id = %s
            """,
            (item["id"],),
        ).fetchone()
        incoming = {
            "source": item.get("source"),
            "source_product_id": item.get("source_product_id"),
            "name": item.get("name"),
            "brand": item.get("brand"),
            "series": item.get("series"),
            "score": item.get("score"),
            "price": item.get("price"),
            "specs": item.get("specs"),
            "image_url": item.get("image_url"),
            "source_url": item.get("source_url"),
        }

        if existing and dict(existing) == incoming:
            self.stats.inc_value("phone/skipped_unchanged")
            return item

        self.conn.execute(
            """
            INSERT INTO phones (
                id, source, source_product_id, name, brand, series, score, price, specs, image_url, source_url, updated_at
            )
            VALUES (
                %(id)s, %(source)s, %(source_product_id)s, %(name)s, %(brand)s, %(series)s, %(score)s,
                %(price)s, %(specs)s, %(image_url)s, %(source_url)s, CURRENT_TIMESTAMP
            )
            ON CONFLICT (id) DO UPDATE SET
                source = EXCLUDED.source,
                source_product_id = EXCLUDED.source_product_id,
                name = EXCLUDED.name,
                brand = EXCLUDED.brand,
                series = EXCLUDED.series,
                score = EXCLUDED.score,
                price = EXCLUDED.price,
                specs = EXCLUDED.specs,
                image_url = EXCLUDED.image_url,
                source_url = EXCLUDED.source_url,
                updated_at = CURRENT_TIMESTAMP
            """,
            dict(item),
        )
        self.conn.commit()
        self.stats.inc_value("phone/updated" if existing else "phone/inserted")
        return item

    def process_phone_version(self, item):
        existing = self.conn.execute(
            """
            SELECT phone_id, source, source_product_id, title, price, specs, source_url
            FROM phone_versions
            WHERE config_id = %s
            """,
            (item["config_id"],),
        ).fetchone()
        incoming = {
            "phone_id": item.get("phone_id"),
            "source": item.get("source"),
            "source_product_id": item.get("source_product_id"),
            "title": item.get("title"),
            "price": item.get("price"),
            "specs": item.get("specs") or [],
            "source_url": item.get("source_url"),
        }

        if existing:
            existing_data = dict(existing)
            if existing_data == incoming:
                self.stats.inc_value("phone_version/skipped_unchanged")
                return item

        self.conn.execute(
            """
            INSERT INTO phone_versions (
                config_id, phone_id, source, source_product_id, title, price, specs, source_url, updated_at
            )
            VALUES (
                %(config_id)s, %(phone_id)s, %(source)s, %(source_product_id)s, %(title)s,
                %(price)s, %(specs)s, %(source_url)s, CURRENT_TIMESTAMP
            )
            ON CONFLICT (config_id) DO UPDATE SET
                phone_id = EXCLUDED.phone_id,
                source = EXCLUDED.source,
                source_product_id = EXCLUDED.source_product_id,
                title = EXCLUDED.title,
                price = EXCLUDED.price,
                specs = EXCLUDED.specs,
                source_url = EXCLUDED.source_url,
                updated_at = CURRENT_TIMESTAMP
            """,
            {**dict(item), "specs": Jsonb(item["specs"] or [])},
        )
        self.conn.commit()
        self.stats.inc_value("phone_version/updated" if existing else "phone_version/inserted")
        return item
