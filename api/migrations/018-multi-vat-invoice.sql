-- Migration 018: Multi-VAT Invoice Support
-- Adds per-line-item VAT rates to invoice_items table.
-- Allows invoices with mixed VAT rates (e.g., 19% + 7% items).

-- Add per-item VAT columns to invoice_items
ALTER TABLE invoice_items ADD COLUMN vat_rate REAL;
-- Per-item VAT rate (e.g., 19, 7, 0). NULL = use invoice-level vat_rate

ALTER TABLE invoice_items ADD COLUMN vat_amount REAL;
-- Calculated: amount * (vat_rate / 100)

ALTER TABLE invoice_items ADD COLUMN net_amount REAL;
-- Same as 'amount' column, kept for clarity (quantity * unit_price)

-- Backfill existing items: copy VAT rate from parent invoice
UPDATE invoice_items
SET vat_rate = (SELECT vat_rate FROM invoices WHERE invoices.id = invoice_items.invoice_id),
    net_amount = amount,
    vat_amount = ROUND(amount * (SELECT vat_rate FROM invoices WHERE invoices.id = invoice_items.invoice_id) / 100.0, 2);
