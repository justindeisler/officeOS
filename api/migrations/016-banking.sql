-- Migration 016: Banking Integration
-- Bank accounts and transactions for FinAPI bank feed integration.
-- Supports PSD2-compliant bank connections and transaction matching.

-- Bank accounts connected via FinAPI
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'finapi',   -- 'finapi', 'manual'
  provider_account_id TEXT,                   -- FinAPI account ID
  bank_name TEXT,                             -- Name of the bank
  iban TEXT,                                  -- IBAN
  bic TEXT,                                   -- BIC/SWIFT
  account_name TEXT,                          -- User-given name for the account
  account_type TEXT DEFAULT 'checking',       -- 'checking', 'savings', 'credit_card'
  balance REAL DEFAULT 0,                     -- Current balance
  balance_date TEXT,                          -- Date of last balance update
  currency TEXT DEFAULT 'EUR',
  sync_status TEXT DEFAULT 'pending',         -- 'pending', 'syncing', 'synced', 'error'
  last_sync_at TEXT,                          -- Last successful sync timestamp
  last_sync_error TEXT,                       -- Error message from last sync
  connection_id TEXT,                         -- FinAPI bank connection ID
  is_active INTEGER DEFAULT 1,               -- Whether account is actively synced
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_iban ON bank_accounts(iban);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_provider ON bank_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(is_active);

-- Bank transactions imported from bank feed
CREATE TABLE IF NOT EXISTS bank_transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  provider_transaction_id TEXT,               -- FinAPI transaction ID
  amount REAL NOT NULL,                       -- Positive = credit, Negative = debit
  currency TEXT DEFAULT 'EUR',
  booking_date TEXT NOT NULL,                 -- Buchungsdatum
  value_date TEXT,                            -- Wertstellungsdatum
  counterpart_name TEXT,                      -- Name of sender/receiver
  counterpart_iban TEXT,                      -- IBAN of sender/receiver
  counterpart_bic TEXT,
  purpose TEXT,                               -- Verwendungszweck
  bank_reference TEXT,                        -- Bank's own reference
  type TEXT,                                  -- 'transfer', 'direct_debit', 'standing_order', etc.
  
  -- Matching status
  match_status TEXT DEFAULT 'unmatched',      -- 'unmatched', 'auto_matched', 'manual_matched', 'ignored', 'booked'
  match_confidence REAL,                      -- 0.0-1.0 confidence of auto-match
  matched_invoice_id TEXT REFERENCES invoices(id),
  matched_expense_id TEXT REFERENCES expenses(id),
  matched_income_id TEXT REFERENCES income(id),
  match_rule_id TEXT,                         -- ID of booking rule that matched
  
  -- Category assignment (from rules or manual)
  category TEXT,                              -- Expense/income category
  vat_rate REAL,                              -- VAT rate for booking
  booking_description TEXT,                   -- Description for the booking
  
  is_duplicate INTEGER DEFAULT 0,            -- Flagged as duplicate
  notes TEXT,                                 -- User notes
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_account ON bank_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_bank_tx_date ON bank_transactions(booking_date);
CREATE INDEX IF NOT EXISTS idx_bank_tx_match_status ON bank_transactions(match_status);
CREATE INDEX IF NOT EXISTS idx_bank_tx_counterpart ON bank_transactions(counterpart_name);
CREATE INDEX IF NOT EXISTS idx_bank_tx_amount ON bank_transactions(amount);
CREATE INDEX IF NOT EXISTS idx_bank_tx_provider_id ON bank_transactions(provider_transaction_id);

-- Bank sync log for tracking sync operations
CREATE TABLE IF NOT EXISTS bank_sync_log (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'running',              -- 'running', 'completed', 'failed'
  transactions_imported INTEGER DEFAULT 0,
  transactions_updated INTEGER DEFAULT 0,
  duplicates_skipped INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_bank_sync_account ON bank_sync_log(account_id);
