-- Migration 012: Document Retention Tracking
-- GoBD requires 10-year retention for accounting docs, preventing premature deletion.

-- Add retention fields to attachments
ALTER TABLE attachments ADD COLUMN retention_type TEXT DEFAULT 'receipt';
-- 'receipt' = 8 years, 'accounting' = 10 years, 'correspondence' = 6 years

ALTER TABLE attachments ADD COLUMN retention_until TEXT;
-- Auto-calculated: upload_date + retention years

ALTER TABLE attachments ADD COLUMN deletion_blocked INTEGER DEFAULT 1;

-- Backfill: all existing attachments get 10-year retention (conservative default)
UPDATE attachments 
SET retention_until = datetime(uploaded_at, '+10 years'),
    retention_type = 'accounting'
WHERE retention_until IS NULL;
