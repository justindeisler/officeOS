-- Migration 017: Auto-Booking Rules
-- Automated rules for categorizing and booking bank transactions.
-- Supports conditions (vendor, amount, text) and actions (category, VAT, description).

CREATE TABLE IF NOT EXISTS booking_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                         -- User-friendly rule name
  description TEXT,                           -- Optional description
  priority INTEGER DEFAULT 100,              -- Lower = higher priority (evaluated first)
  is_active INTEGER DEFAULT 1,               -- Whether rule is enabled
  
  -- Conditions (all non-null conditions must match = AND logic)
  condition_direction TEXT,                   -- 'credit', 'debit', or NULL for both
  condition_counterpart_pattern TEXT,         -- Fuzzy match on counterpart name
  condition_purpose_pattern TEXT,             -- Pattern match on purpose/Verwendungszweck
  condition_amount_min REAL,                  -- Minimum amount (absolute)
  condition_amount_max REAL,                  -- Maximum amount (absolute)
  condition_iban_pattern TEXT,                -- IBAN pattern match
  
  -- Actions (what to do when rule matches)
  action_category TEXT,                       -- Expense/income category to assign
  action_vat_rate REAL,                       -- VAT rate to assign
  action_description_template TEXT,           -- Description template (supports {counterpart}, {purpose}, {amount})
  action_auto_confirm INTEGER DEFAULT 0,      -- Auto-book without review
  action_match_type TEXT,                     -- 'expense', 'income', 'ignore'
  
  -- Stats
  match_count INTEGER DEFAULT 0,             -- Number of times this rule matched
  last_matched_at TEXT,                       -- Last match timestamp
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_booking_rules_priority ON booking_rules(priority);
CREATE INDEX IF NOT EXISTS idx_booking_rules_active ON booking_rules(is_active);

-- Vendor name mappings for fuzzy matching
-- Tracks historical matches to improve future matching
CREATE TABLE IF NOT EXISTS vendor_bank_mappings (
  id TEXT PRIMARY KEY,
  bank_counterpart_name TEXT NOT NULL,        -- Name as it appears in bank feed
  mapped_vendor_name TEXT NOT NULL,           -- Normalized vendor name
  confidence REAL DEFAULT 1.0,               -- Mapping confidence
  match_count INTEGER DEFAULT 1,             -- How many times this mapping was used
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vendor_bank_name ON vendor_bank_mappings(bank_counterpart_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_bank_unique ON vendor_bank_mappings(bank_counterpart_name, mapped_vendor_name);
