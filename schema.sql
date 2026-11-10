CREATE TABLE IF NOT EXISTS commissions (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE,
  artist_name TEXT,
  client_name TEXT,
  title TEXT,
  brief TEXT,
  deposit REAL,
  deposit_status TEXT,
  delivery_status TEXT,
  status TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  commission_id TEXT,
  vnum INTEGER,
  image_base64 TEXT,
  note TEXT,
  type TEXT,
  status TEXT,
  client_comment TEXT,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_versions_commission ON versions(commission_id);
