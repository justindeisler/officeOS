-- Migration 007: Normalize expense categories
-- Aligns backend and frontend expense category IDs
-- Maps legacy backend-only categories to shared constants

-- Legacy mappings:
-- 'communication' → 'telecom'
-- 'education' → 'training'
-- 'office' → 'office_supplies'

UPDATE expenses SET category = 'telecom' WHERE category = 'communication';
UPDATE expenses SET category = 'training' WHERE category = 'education';
UPDATE expenses SET category = 'office_supplies' WHERE category = 'office';

-- Fix euer_line: all categories default to line 34 (Sonstige) except special ones
UPDATE expenses SET euer_line = 34 WHERE category IN (
  'software', 'hosting', 'telecom', 'hardware', 'office_supplies',
  'travel', 'training', 'books', 'insurance', 'bank_fees',
  'legal', 'marketing', 'other'
);
UPDATE expenses SET euer_line = 25 WHERE category = 'fremdleistungen';
UPDATE expenses SET euer_line = 30 WHERE category = 'depreciation';
UPDATE expenses SET euer_line = 33 WHERE category = 'homeoffice';
