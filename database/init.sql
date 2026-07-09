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

CREATE TABLE IF NOT EXISTS goofish_listings (
    item_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price INTEGER,
    location TEXT,
    want_count INTEGER,
    browse_count INTEGER,
    seller_credit TEXT,
    source_url TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE goofish_listings ADD COLUMN IF NOT EXISTS browse_count INTEGER;

CREATE TABLE IF NOT EXISTS goofish_listing_matches (
    item_id TEXT NOT NULL REFERENCES goofish_listings(item_id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    result_position INTEGER,
    first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (item_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_goofish_listing_matches_keyword
ON goofish_listing_matches (keyword, last_seen_at DESC);

INSERT INTO phones (id, name, brand, score)
VALUES
    ('demo-iphone', 'iPhone Demo', 'Apple', 88),
    ('demo-android', 'Android Demo', 'Demo', 82)
ON CONFLICT (id) DO NOTHING;
