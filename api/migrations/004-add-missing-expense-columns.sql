-- Migration: Add missing expense columns for VAT and accounting
-- Date: 2026-02-09
-- Description: Add deductible_percent, vorsteuer_claimed, is_recurring,
--              recurring_frequency, is_gwg, and asset_id columns to expenses table.
--              These are required by the reports/EÜR calculations and match the
--              Tauri frontend schema definition.

-- Deductible percentage (100 = fully deductible, 50 = half deductible for mixed-use)
ALTER TABLE expenses ADD COLUMN deductible_percent INTEGER DEFAULT 100;

-- Whether input VAT (Vorsteuer) has been claimed for this expense
ALTER TABLE expenses ADD COLUMN vorsteuer_claimed INTEGER DEFAULT 0;

-- Recurring expense tracking
ALTER TABLE expenses ADD COLUMN is_recurring INTEGER DEFAULT 0;
ALTER TABLE expenses ADD COLUMN recurring_frequency TEXT;

-- GWG (Geringwertiges Wirtschaftsgut) - low-value asset, immediately deductible
ALTER TABLE expenses ADD COLUMN is_gwg INTEGER DEFAULT 0;

-- Link to assets table for depreciation tracking
ALTER TABLE expenses ADD COLUMN asset_id TEXT REFERENCES assets(id);
