-- Migration 020: Mahnwesen (Dunning System)
-- Tracks payment reminders and dunning levels for overdue invoices.

CREATE TABLE IF NOT EXISTS dunning_entries (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,           -- 1 = Zahlungserinnerung, 2 = 1. Mahnung, 3 = 2. Mahnung
  sent_date TEXT,                              -- Date reminder was sent
  due_date TEXT,                               -- New payment deadline set in reminder
  fee REAL DEFAULT 0,                          -- Mahngebühr (dunning fee)
  interest_rate REAL DEFAULT 0,                -- Verzugszinsen rate (%)
  interest_amount REAL DEFAULT 0,              -- Calculated interest amount
  notes TEXT,                                  -- Additional notes
  delivery_method TEXT DEFAULT 'email',        -- 'email', 'post', 'manual'
  status TEXT DEFAULT 'draft',                 -- 'draft', 'sent', 'acknowledged'
  pdf_path TEXT,                               -- Path to generated dunning letter PDF
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dunning_invoice ON dunning_entries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_dunning_level ON dunning_entries(level);
CREATE INDEX IF NOT EXISTS idx_dunning_status ON dunning_entries(status);

-- Add dunning tracking to invoices
ALTER TABLE invoices ADD COLUMN dunning_level INTEGER DEFAULT 0;
-- 0 = no dunning, 1 = Zahlungserinnerung sent, 2 = 1. Mahnung, 3 = 2. Mahnung

ALTER TABLE invoices ADD COLUMN last_reminded_at TEXT;
-- Date of last reminder/dunning letter
