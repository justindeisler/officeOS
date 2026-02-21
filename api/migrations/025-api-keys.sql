-- Sprint 7: API Key Authentication & Rate Limiting

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash of the key
  key_prefix TEXT NOT NULL,       -- First 12 chars for display (e.g., "pk_test_abc1")
  name TEXT NOT NULL,              -- Human-readable name
  scopes TEXT NOT NULL,            -- JSON array: ["read", "write", "admin"]
  rate_limit INTEGER DEFAULT 100,  -- Requests per minute
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Request log for rate limiting
CREATE TABLE api_requests (
  id TEXT PRIMARY KEY,
  api_key_id TEXT REFERENCES api_keys(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_api_requests_key_time ON api_requests(api_key_id, created_at);
