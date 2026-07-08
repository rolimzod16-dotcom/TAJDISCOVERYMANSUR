-- TajDiscovery CMS schema

CREATE TABLE IF NOT EXISTS cms_store (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cms_store_updated_at_idx ON cms_store (updated_at);

CREATE TABLE IF NOT EXISTS file_uploads (
  filename TEXT PRIMARY KEY,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);