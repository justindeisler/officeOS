-- Migration 011: Period Locking (Festschreibung)
-- GoBD requires that after a tax period is filed, records cannot be modified.

CREATE TABLE IF NOT EXISTS period_locks (
  id TEXT PRIMARY KEY,
  period_type TEXT NOT NULL,          -- 'month', 'quarter', 'year'
  period_key TEXT NOT NULL UNIQUE,    -- '2025-01', '2025-Q1', '2025'
  locked_at TEXT NOT NULL,
  locked_by TEXT DEFAULT 'system',
  reason TEXT,                        -- 'USt-VA filed', 'Year-end closing', etc.
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_period_locks_key ON period_locks(period_key);
CREATE INDEX IF NOT EXISTS idx_period_locks_type ON period_locks(period_type);
