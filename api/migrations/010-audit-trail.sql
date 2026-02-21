-- Migration 010: GoBD Audit Trail (Änderungshistorie)
-- Every change to any financial record must be logged immutably.
-- Required by GoBD for ordnungsmäßige Buchführung.

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,         -- 'income', 'expense', 'invoice', 'asset', 'period_lock'
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,              -- 'create', 'update', 'delete', 'lock', 'unlock'
  field_name TEXT,                   -- Which field changed (null for create/delete)
  old_value TEXT,                    -- Previous value (JSON-encoded for complex types)
  new_value TEXT,                    -- New value (JSON-encoded)
  user_id TEXT DEFAULT 'system',     -- Who made the change
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,                   -- For correlating multiple changes in one request
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_log(session_id);

-- GoBD: Protect audit_log from tampering via application-level triggers
-- SQLite doesn't support disabling DELETE/UPDATE on tables natively,
-- so we enforce immutability at the application layer.
-- The trigger below prevents accidental DELETE from the audit_log:
CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
  BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'GoBD: Audit log entries cannot be deleted');
END;

-- Prevent UPDATE on audit_log (immutability)
CREATE TRIGGER IF NOT EXISTS prevent_audit_update
  BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'GoBD: Audit log entries cannot be modified');
END;
