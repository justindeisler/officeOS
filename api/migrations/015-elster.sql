-- Migration 015: ELSTER Integration
-- Electronic tax filing is mandatory in Germany.
-- This stores submission history, certificates, and status.

CREATE TABLE IF NOT EXISTS elster_submissions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                -- 'ust_va', 'zm', 'euer'
  period TEXT NOT NULL,              -- '2025-01', '2025-Q1', '2025'
  status TEXT DEFAULT 'draft',       -- 'draft', 'validated', 'submitted', 'accepted', 'rejected', 'error'
  xml_content TEXT,                  -- Submitted XML (ELSTER format)
  response_xml TEXT,                 -- ELSTER response
  transfer_ticket TEXT,              -- ELSTER transfer ticket (proof of submission)
  error_message TEXT,                -- Error details if rejected
  tax_data TEXT,                     -- JSON: the tax calculation data used
  submitted_at TEXT,
  accepted_at TEXT,
  submitted_by TEXT DEFAULT 'system',
  test_mode INTEGER DEFAULT 0,      -- 1 = submitted to ELSTER test environment
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_elster_type ON elster_submissions(type);
CREATE INDEX IF NOT EXISTS idx_elster_period ON elster_submissions(period);
CREATE INDEX IF NOT EXISTS idx_elster_status ON elster_submissions(status);

CREATE TABLE IF NOT EXISTS elster_certificates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                -- 'software', 'personal'
  name TEXT NOT NULL,
  certificate_data TEXT,             -- Base64-encoded certificate (encrypted at rest)
  fingerprint TEXT,                  -- SHA-256 fingerprint for identification
  valid_from TEXT,
  valid_until TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
