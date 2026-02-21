-- Migration 021: Reverse Charge / §13b Support
-- Supports EU B2B invoices with reverse charge mechanism.
-- Required for Zusammenfassende Meldung (ZM) and USt-VA Kennzahl 46/47.

-- Add reverse charge fields to invoices
ALTER TABLE invoices ADD COLUMN is_reverse_charge INTEGER DEFAULT 0;
-- 1 = reverse charge applies (§13b UStG)

ALTER TABLE invoices ADD COLUMN reverse_charge_note TEXT;
-- E.g., "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, §13b UStG)"

-- Add reverse charge fields to income
ALTER TABLE income ADD COLUMN is_reverse_charge INTEGER DEFAULT 0;
ALTER TABLE income ADD COLUMN reverse_charge_note TEXT;

-- Add reverse charge fields to expenses  
ALTER TABLE expenses ADD COLUMN is_reverse_charge INTEGER DEFAULT 0;
ALTER TABLE expenses ADD COLUMN reverse_charge_note TEXT;

-- Add client type to clients for automatic reverse charge detection
ALTER TABLE clients ADD COLUMN client_type TEXT DEFAULT 'domestic';
-- 'domestic' = German client
-- 'eu_b2b' = EU business with VAT ID (reverse charge)
-- 'eu_b2c' = EU private consumer (no reverse charge, normal VAT)
-- 'third_country' = Non-EU (no VAT)
