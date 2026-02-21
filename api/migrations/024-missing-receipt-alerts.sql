-- Migration 024: Missing Receipt Alerts
-- Tracks expenses without receipts for GoBD compliance

CREATE TABLE IF NOT EXISTS missing_receipt_alerts (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  reason TEXT NOT NULL,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TEXT,
  dismissed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_missing_receipt_alerts_expense ON missing_receipt_alerts(expense_id);
CREATE INDEX IF NOT EXISTS idx_missing_receipt_alerts_severity ON missing_receipt_alerts(severity, dismissed);

-- Auto-populate: scan existing expenses without receipts
INSERT INTO missing_receipt_alerts (id, expense_id, created_at, severity, reason, dismissed)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))) AS id,
  e.id AS expense_id,
  datetime('now') AS created_at,
  CASE
    WHEN e.gross_amount > 1000 THEN 'high'
    WHEN julianday('now') - julianday(e.date) > 60 THEN 'high'
    WHEN e.gross_amount >= 150 THEN 'medium'
    WHEN julianday('now') - julianday(e.date) > 30 THEN 'medium'
    ELSE 'low'
  END AS severity,
  'Expense €' || printf('%.2f', e.gross_amount) || COALESCE(' to ' || e.vendor, '') || ' has no receipt (' || CAST(CAST(julianday('now') - julianday(e.date) AS INTEGER) AS TEXT) || ' days old)' AS reason,
  FALSE AS dismissed
FROM expenses e
WHERE (e.is_deleted IS NULL OR e.is_deleted = 0)
  AND (e.is_duplicate IS NULL OR e.is_duplicate = 0)
  AND (e.receipt_path IS NULL OR e.receipt_path = '')
  AND NOT EXISTS (
    SELECT 1 FROM missing_receipt_alerts mra WHERE mra.expense_id = e.id
  );
