-- Migration 008: Add extended fields to assets table
-- Frontend Asset type defines fields that don't exist in the database.
-- This migration adds them and backfills reasonable defaults.

ALTER TABLE assets ADD COLUMN vendor TEXT;
ALTER TABLE assets ADD COLUMN vat_paid REAL DEFAULT 0;
ALTER TABLE assets ADD COLUMN gross_price REAL;
ALTER TABLE assets ADD COLUMN inventory_number TEXT;
ALTER TABLE assets ADD COLUMN location TEXT;
ALTER TABLE assets ADD COLUMN bill_path TEXT;
ALTER TABLE assets ADD COLUMN euer_line INTEGER DEFAULT 30;
ALTER TABLE assets ADD COLUMN euer_category TEXT DEFAULT 'depreciation';
ALTER TABLE assets ADD COLUMN afa_start_date TEXT;

-- Backfill gross_price from purchase_price (assuming 19% VAT)
UPDATE assets SET
  gross_price = ROUND(purchase_price * 1.19, 2),
  vat_paid = ROUND(purchase_price * 0.19, 2)
WHERE gross_price IS NULL;

-- Backfill afa_start_date from purchase_date
UPDATE assets SET afa_start_date = purchase_date WHERE afa_start_date IS NULL;
