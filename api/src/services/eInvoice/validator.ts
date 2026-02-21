/**
 * E-Rechnung XML Validator
 * 
 * Validates E-Invoice XML against EN 16931 business rules.
 * Note: Full schema validation (XSD) would require an XML parser library.
 * This implements key business rule checks from the EN 16931 standard.
 */

import type { EInvoiceData } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  code: string;
  field: string;
  message: string;
  severity: 'warning';
}

/**
 * Validate an E-Invoice data object against EN 16931 business rules.
 */
export function validateEInvoice(data: EInvoiceData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // BR-01: An Invoice shall have a Specification identifier
  // (handled by generator)

  // BR-02: An Invoice shall have an Invoice number
  if (!data.invoiceNumber || data.invoiceNumber.trim().length === 0) {
    errors.push({
      code: 'BR-02',
      field: 'invoiceNumber',
      message: 'Invoice must have an invoice number (BT-1)',
      severity: 'error',
    });
  }

  // BR-03: An Invoice shall have an Invoice issue date
  if (!data.invoiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.invoiceDate)) {
    errors.push({
      code: 'BR-03',
      field: 'invoiceDate',
      message: 'Invoice must have a valid issue date in YYYY-MM-DD format (BT-2)',
      severity: 'error',
    });
  }

  // BR-04: An Invoice shall have an Invoice type code
  if (!data.invoiceTypeCode || !['380', '381', '384', '389'].includes(data.invoiceTypeCode)) {
    errors.push({
      code: 'BR-04',
      field: 'invoiceTypeCode',
      message: 'Invoice must have a valid type code (380=invoice, 381=credit note) (BT-3)',
      severity: 'error',
    });
  }

  // BR-05: An Invoice shall have an Invoice currency code
  if (!data.currencyCode || data.currencyCode.length !== 3) {
    errors.push({
      code: 'BR-05',
      field: 'currencyCode',
      message: 'Invoice must have a valid ISO 4217 currency code (BT-5)',
      severity: 'error',
    });
  }

  // BR-06: Seller name
  if (!data.seller?.name) {
    errors.push({
      code: 'BR-06',
      field: 'seller.name',
      message: 'Seller must have a name (BT-27)',
      severity: 'error',
    });
  }

  // BR-07: Buyer name
  if (!data.buyer?.name) {
    errors.push({
      code: 'BR-07',
      field: 'buyer.name',
      message: 'Buyer must have a name (BT-44)',
      severity: 'error',
    });
  }

  // BR-08: Seller postal address
  if (!data.seller?.street || !data.seller?.city || !data.seller?.postalCode || !data.seller?.countryCode) {
    errors.push({
      code: 'BR-08',
      field: 'seller.address',
      message: 'Seller must have a complete postal address (BG-5)',
      severity: 'error',
    });
  }

  // BR-10: Buyer postal address
  if (!data.buyer?.street || !data.buyer?.city || !data.buyer?.postalCode || !data.buyer?.countryCode) {
    errors.push({
      code: 'BR-10',
      field: 'buyer.address',
      message: 'Buyer must have a complete postal address (BG-8)',
      severity: 'error',
    });
  }

  // BR-11: Seller VAT identifier or tax registration
  if (!data.seller?.vatId && !data.seller?.taxNumber) {
    errors.push({
      code: 'BR-11',
      field: 'seller.vatId',
      message: 'Seller must have a VAT identifier (BT-31) or tax number (BT-32)',
      severity: 'error',
    });
  }

  // BR-13: At least one line item
  if (!data.items || data.items.length === 0) {
    errors.push({
      code: 'BR-13',
      field: 'items',
      message: 'Invoice must have at least one line item (BG-25)',
      severity: 'error',
    });
  }

  // BR-CO-10: Sum of line amounts = invoice subtotal
  if (data.items && data.items.length > 0) {
    const lineSum = data.items.reduce((sum, item) => sum + item.lineTotal, 0);
    const lineSumRounded = Math.round(lineSum * 100) / 100;
    if (Math.abs(lineSumRounded - data.subtotal) > 0.01) {
      errors.push({
        code: 'BR-CO-10',
        field: 'subtotal',
        message: `Sum of line totals (${lineSumRounded}) must equal invoice subtotal (${data.subtotal})`,
        severity: 'error',
      });
    }
  }

  // BR-CO-13: Tax amount = Sum of tax subtotals
  if (data.vatBreakdown && data.vatBreakdown.length > 0) {
    const vatSum = data.vatBreakdown.reduce((sum, vat) => sum + vat.taxAmount, 0);
    const vatSumRounded = Math.round(vatSum * 100) / 100;
    if (Math.abs(vatSumRounded - data.vatTotal) > 0.01) {
      errors.push({
        code: 'BR-CO-13',
        field: 'vatTotal',
        message: `Sum of VAT breakdown amounts (${vatSumRounded}) must equal invoice VAT total (${data.vatTotal})`,
        severity: 'error',
      });
    }
  }

  // BR-CO-15: Invoice total = subtotal + VAT total
  const expectedTotal = Math.round((data.subtotal + data.vatTotal) * 100) / 100;
  if (Math.abs(expectedTotal - data.total) > 0.01) {
    errors.push({
      code: 'BR-CO-15',
      field: 'total',
      message: `Invoice total (${data.total}) must equal subtotal (${data.subtotal}) + VAT (${data.vatTotal}) = ${expectedTotal}`,
      severity: 'error',
    });
  }

  // Line item validations
  for (let i = 0; i < (data.items?.length || 0); i++) {
    const item = data.items[i];

    // BR-25: Line item description
    if (!item.description || item.description.trim().length === 0) {
      errors.push({
        code: 'BR-25',
        field: `items[${i}].description`,
        message: `Line item ${i + 1} must have a description (BT-153)`,
        severity: 'error',
      });
    }

    // BR-27: Line item quantity
    if (!item.quantity || item.quantity <= 0) {
      errors.push({
        code: 'BR-27',
        field: `items[${i}].quantity`,
        message: `Line item ${i + 1} must have a positive quantity (BT-129)`,
        severity: 'error',
      });
    }

    // BR-CO-04: Line total = quantity * unit price (allowing rounding)
    const expectedLineTotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
    if (Math.abs(expectedLineTotal - item.lineTotal) > 0.01) {
      warnings.push({
        code: 'BR-CO-04',
        field: `items[${i}].lineTotal`,
        message: `Line item ${i + 1}: total (${item.lineTotal}) differs from quantity * price (${expectedLineTotal})`,
        severity: 'warning',
      });
    }
  }

  // X-Rechnung specific: BT-10 (Buyer Reference) or Leitweg-ID
  if (data.leitwegId && !/^\d{2,12}-\d{4,12}-\d{2}$/.test(data.leitwegId)) {
    warnings.push({
      code: 'XR-01',
      field: 'leitwegId',
      message: 'Leitweg-ID format should be XX-XXXX-XX (digits with dashes)',
      severity: 'warning',
    });
  }

  // Payment warnings
  if (!data.payment?.iban) {
    warnings.push({
      code: 'W-PAY',
      field: 'payment.iban',
      message: 'No IBAN provided — payment information recommended for faster payment',
      severity: 'warning',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
