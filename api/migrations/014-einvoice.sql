-- Migration 014: E-Rechnung Support
-- E-Rechnung (electronic invoicing) is mandatory for B2B in Germany since Jan 2025.
-- Supports ZUGFeRD 2.1 (PDF+XML hybrid) and X-Rechnung (pure XML/UBL/CII).

ALTER TABLE invoices ADD COLUMN einvoice_format TEXT;
-- 'zugferd' = ZUGFeRD 2.1 (PDF with embedded XML)
-- 'xrechnung' = X-Rechnung 3.0 (pure XML, UBL or CII syntax)
-- NULL = traditional PDF invoice

ALTER TABLE invoices ADD COLUMN einvoice_xml TEXT;
-- Stored XML content (for both ZUGFeRD and X-Rechnung)

ALTER TABLE invoices ADD COLUMN einvoice_valid INTEGER;
-- 1 = validated successfully, 0 = validation failed, NULL = not validated

ALTER TABLE invoices ADD COLUMN leitweg_id TEXT;
-- Leitweg-ID for public sector invoices (required by X-Rechnung)

ALTER TABLE invoices ADD COLUMN buyer_reference TEXT;
-- Buyer reference / Bestellreferenz (BT-10)

-- Add VAT ID and country to clients for E-Rechnung compliance
ALTER TABLE clients ADD COLUMN vat_id TEXT;
-- USt-IdNr. (e.g., DE123456789)

ALTER TABLE clients ADD COLUMN country_code TEXT DEFAULT 'DE';
-- ISO 3166-1 alpha-2 country code

ALTER TABLE clients ADD COLUMN is_eu_business INTEGER DEFAULT 0;
-- Flag for EU B2B transactions (needed for ZM and reverse charge)
