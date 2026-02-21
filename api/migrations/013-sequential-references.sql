-- Migration 013: Sequential Reference Numbers
-- GoBD requires sequential numbering for all financial records.

ALTER TABLE income ADD COLUMN reference_number TEXT;
ALTER TABLE expenses ADD COLUMN reference_number TEXT;

-- Create sequence tracking table
CREATE TABLE IF NOT EXISTS sequence_counters (
  prefix TEXT PRIMARY KEY,          -- 'EI-2025', 'EA-2025', 'RE-2025'
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create indexes for reference number lookups
CREATE INDEX IF NOT EXISTS idx_income_reference ON income(reference_number);
CREATE INDEX IF NOT EXISTS idx_expenses_reference ON expenses(reference_number);

-- Soft-delete support: mark records as deleted instead of removing them
ALTER TABLE income ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE expenses ADD COLUMN is_deleted INTEGER DEFAULT 0;
