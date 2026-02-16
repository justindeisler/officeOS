-- Migration: Invoice OCR & Auto-Expense
-- Date: 2026-02-15
-- Description: Create tables for file attachments, OCR extractions,
--              and vendor mappings. Add attachment_id to expenses.

-- Attachments table: stores metadata for uploaded invoice files
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  expense_id TEXT REFERENCES expenses(id) ON DELETE SET NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  thumbnail_path TEXT,
  checksum TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attachments_expense_id ON attachments(expense_id);
CREATE INDEX IF NOT EXISTS idx_attachments_checksum ON attachments(checksum);

-- OCR extractions table: stores extracted data and metadata from OCR processing
CREATE TABLE IF NOT EXISTS ocr_extractions (
  id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  expense_id TEXT REFERENCES expenses(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',

  vendor_name TEXT,
  vendor_confidence REAL,
  invoice_number TEXT,
  invoice_number_confidence REAL,
  invoice_date TEXT,
  invoice_date_confidence REAL,
  net_amount REAL,
  net_amount_confidence REAL,
  vat_rate REAL,
  vat_rate_confidence REAL,
  vat_amount REAL,
  vat_amount_confidence REAL,
  gross_amount REAL,
  gross_amount_confidence REAL,
  currency TEXT DEFAULT 'EUR',
  currency_confidence REAL,

  raw_text TEXT,
  raw_response TEXT,
  line_items TEXT,

  processing_time_ms INTEGER,
  error_message TEXT,
  is_credit_note INTEGER DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ocr_extractions_attachment_id ON ocr_extractions(attachment_id);
CREATE INDEX IF NOT EXISTS idx_ocr_extractions_expense_id ON ocr_extractions(expense_id);

-- Vendor mappings table: stores normalized vendor names and category suggestions
CREATE TABLE IF NOT EXISTS vendor_mappings (
  id TEXT PRIMARY KEY,
  ocr_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  default_category TEXT,
  default_vat_rate INTEGER,
  use_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vendor_mappings_ocr_name ON vendor_mappings(ocr_name);

-- Add attachment_id to expenses table
ALTER TABLE expenses ADD COLUMN attachment_id TEXT REFERENCES attachments(id) ON DELETE SET NULL;
