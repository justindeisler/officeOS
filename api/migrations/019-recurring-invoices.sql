-- Migration 019: Recurring Invoices
-- Templates for automatically generating invoices on a schedule.

CREATE TABLE IF NOT EXISTS recurring_invoices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                         -- Template name (e.g., "Monthly Hosting for Acme")
  client_id TEXT REFERENCES clients(id),
  project_id TEXT REFERENCES projects(id),
  
  -- Schedule
  frequency TEXT NOT NULL DEFAULT 'monthly',  -- 'monthly', 'quarterly', 'yearly'
  next_date TEXT NOT NULL,                    -- Next generation date (YYYY-MM-DD)
  last_generated_at TEXT,                     -- Last successful generation
  end_date TEXT,                              -- Optional: stop generating after this date
  
  -- Invoice template
  vat_rate REAL DEFAULT 19,                   -- Default VAT rate
  notes TEXT,                                 -- Notes template
  payment_terms_days INTEGER DEFAULT 14,      -- Days until due
  items_json TEXT NOT NULL,                   -- JSON array of line items
  
  -- Behavior
  auto_send INTEGER DEFAULT 0,               -- Auto-mark as 'sent' after generation
  auto_generate INTEGER DEFAULT 1,           -- Auto-generate on schedule (vs manual trigger)
  is_active INTEGER DEFAULT 1,               -- Whether schedule is active
  
  -- Stats
  generated_count INTEGER DEFAULT 0,         -- Number of invoices generated
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recurring_invoices_next ON recurring_invoices(next_date);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_active ON recurring_invoices(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_client ON recurring_invoices(client_id);

-- Track which invoices were generated from recurring templates
ALTER TABLE invoices ADD COLUMN recurring_invoice_id TEXT REFERENCES recurring_invoices(id);
