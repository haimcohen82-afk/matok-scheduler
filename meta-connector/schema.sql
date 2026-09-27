CREATE TABLE IF NOT EXISTS scheduled_posts (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK(channel IN ('facebook','instagram')),
  kind TEXT NOT NULL CHECK(kind IN ('text','image','reel')),
  caption TEXT NOT NULL DEFAULT '',
  asset_url TEXT,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','processing','published','cancelled','failed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_id TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due
ON scheduled_posts(status, scheduled_at);
