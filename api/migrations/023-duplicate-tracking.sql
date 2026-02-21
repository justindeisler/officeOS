-- Migration 023: Duplicate Detection Tracking
-- Adds duplicate marking columns to expenses and income tables.

ALTER TABLE expenses ADD COLUMN is_duplicate BOOLEAN DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN duplicate_of_id TEXT REFERENCES expenses(id);

ALTER TABLE income ADD COLUMN is_duplicate BOOLEAN DEFAULT FALSE;
ALTER TABLE income ADD COLUMN duplicate_of_id TEXT REFERENCES income(id);

CREATE INDEX idx_expenses_duplicate ON expenses(is_duplicate, duplicate_of_id);
CREATE INDEX idx_income_duplicate ON income(is_duplicate, duplicate_of_id);
