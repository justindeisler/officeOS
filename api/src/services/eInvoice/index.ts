/**
 * E-Rechnung Service
 * 
 * Orchestrates E-Invoice generation, validation, and parsing.
 * Supports ZUGFeRD 2.1 (CII) and X-Rechnung 3.0 (UBL).
 * 
 * E-Rechnung is mandatory for B2B in Germany since January 2025.
 */

import type Database from 'better-sqlite3';
import { createLogger } from '../../logger.js';
import { generateZugferdXml } from './zugferd-generator.js';
import { generateXRechnungXml } from './xrechnung-generator.js';
import { validateEInvoice, type ValidationResult } from './validator.js';
import {
  type EInvoiceData,
  type EInvoiceFormat,
  type EInvoiceLineItem,
  type EInvoiceParty,
  getUnitCode,
  getVatCategoryCode,
} from './types.js';

export { type EInvoiceData, type EInvoiceFormat, type ValidationResult };
export { validateEInvoice } from './validator.js';

const log = createLogger('einvoice');

// ============================================================================
// Types (from DB)
// ============================================================================

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  client_id: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  notes: string | null;
  einvoice_format: string | null;
  buyer_reference: string | null;
  leitweg_id: string | null;
}

interface InvoiceItemRow {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
}

interface ClientRow {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  address_country: string | null;
  vat_id: string | null;
  country_code: string | null;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Generate E-Invoice XML for a given invoice.
 * Returns the XML string and validation result.
 */
export function generateEInvoice(
  db: Database.Database,
  invoiceId: string,
  format: EInvoiceFormat = 'zugferd'
): { xml: string; validation: ValidationResult; data: EInvoiceData } {
  // Get invoice data
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as InvoiceRow | undefined;
  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId) as InvoiceItemRow[];
  const client = invoice.client_id
    ? db.prepare('SELECT * FROM clients WHERE id = ?').get(invoice.client_id) as ClientRow | undefined
    : undefined;

  // Build seller from settings
  const seller = getSellerFromSettings(db);

  // Build buyer from client
  const buyer = getBuyerFromClient(client);

  // Build payment info from settings
  const payment = getPaymentFromSettings(db);

  // Build E-Invoice data
  const einvoiceData = buildEInvoiceData(invoice, items, seller, buyer, payment);

  // Validate
  const validation = validateEInvoice(einvoiceData);

  // Generate XML
  let xml: string;
  switch (format) {
    case 'xrechnung-ubl':
    case 'xrechnung-cii':
      xml = generateXRechnungXml(einvoiceData);
      break;
    case 'zugferd':
    default:
      xml = generateZugferdXml(einvoiceData);
      break;
  }

  // Store XML in database
  db.prepare(
    'UPDATE invoices SET einvoice_format = ?, einvoice_xml = ?, einvoice_valid = ? WHERE id = ?'
  ).run(
    format,
    xml,
    validation.valid ? 1 : 0,
    invoiceId
  );

  log.info(
    { invoiceId, format, valid: validation.valid, errors: validation.errors.length },
    'E-Invoice generated'
  );

  return { xml, validation, data: einvoiceData };
}

/**
 * Get stored E-Invoice XML for a given invoice.
 */
export function getEInvoiceXml(
  db: Database.Database,
  invoiceId: string
): { xml: string | null; format: string | null; valid: boolean | null } {
  const row = db.prepare(
    'SELECT einvoice_xml, einvoice_format, einvoice_valid FROM invoices WHERE id = ?'
  ).get(invoiceId) as { einvoice_xml: string | null; einvoice_format: string | null; einvoice_valid: number | null } | undefined;

  if (!row) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }

  return {
    xml: row.einvoice_xml,
    format: row.einvoice_format,
    valid: row.einvoice_valid !== null ? row.einvoice_valid === 1 : null,
  };
}

/**
 * Parse an incoming E-Rechnung XML and extract invoice data.
 * Basic CII/UBL parser for common fields.
 */
export function parseEInvoiceXml(xml: string): Partial<EInvoiceData> & { format: EInvoiceFormat } {
  // Detect format from XML namespace
  let format: EInvoiceFormat;
  if (xml.includes('CrossIndustryInvoice')) {
    format = 'zugferd';
  } else if (xml.includes('ubl:Invoice')) {
    format = 'xrechnung-ubl';
  } else {
    format = 'zugferd'; // Default
  }

  // Basic extraction using regex (production would use proper XML parser)
  const extract = (pattern: RegExp): string | undefined => {
    const match = xml.match(pattern);
    return match ? match[1]?.trim() : undefined;
  };

  const data: Partial<EInvoiceData> & { format: EInvoiceFormat } = {
    format,
    // ZUGFeRD: invoice number is inside <rsm:ExchangedDocument><ram:ID>
    // X-Rechnung UBL: invoice number is the first <cbc:ID> after <ubl:Invoice>
    invoiceNumber: format === 'zugferd'
      ? extract(/<rsm:ExchangedDocument>\s*<ram:ID>([^<]+)<\/ram:ID>/)
      : extract(/<cbc:ID>([^<]+)<\/cbc:ID>/),
    currencyCode: format === 'zugferd'
      ? extract(/<ram:InvoiceCurrencyCode>([^<]+)</)
      : extract(/<cbc:DocumentCurrencyCode>([^<]+)</),
    invoiceTypeCode: format === 'zugferd'
      ? extract(/<ram:TypeCode>([^<]+)</)
      : extract(/<cbc:InvoiceTypeCode>([^<]+)</),
  };

  // Extract totals
  if (format === 'zugferd') {
    const grandTotal = extract(/<ram:GrandTotalAmount>([^<]+)</);
    const taxBasis = extract(/<ram:TaxBasisTotalAmount>([^<]+)</);
    const taxTotal = extract(/<ram:TaxTotalAmount[^>]*>([^<]+)</);
    if (grandTotal) data.total = parseFloat(grandTotal);
    if (taxBasis) data.subtotal = parseFloat(taxBasis);
    if (taxTotal) data.vatTotal = parseFloat(taxTotal);
  } else {
    const payable = extract(/<cbc:PayableAmount[^>]*>([^<]+)</);
    const taxExclusive = extract(/<cbc:TaxExclusiveAmount[^>]*>([^<]+)</);
    const taxAmount = extract(/<cbc:TaxAmount[^>]*>([^<]+)</);
    if (payable) data.total = parseFloat(payable);
    if (taxExclusive) data.subtotal = parseFloat(taxExclusive);
    if (taxAmount) data.vatTotal = parseFloat(taxAmount);
  }

  // Extract dates
  if (format === 'zugferd') {
    const dateStr = extract(/<udt:DateTimeString[^>]*>(\d{8})</);
    if (dateStr) {
      data.invoiceDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
  } else {
    data.invoiceDate = extract(/<cbc:IssueDate>([^<]+)</);
    data.dueDate = extract(/<cbc:DueDate>([^<]+)</);
  }

  log.info({ format, invoiceNumber: data.invoiceNumber }, 'E-Invoice parsed');

  return data;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSellerFromSettings(db: Database.Database): EInvoiceParty {
  const getSetting = (key: string): string | null => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value || null;
  };

  return {
    name: getSetting('company_name') || 'Company Name',
    street: getSetting('company_street') || '',
    city: getSetting('company_city') || '',
    postalCode: getSetting('company_zip') || '',
    countryCode: getSetting('company_country') || 'DE',
    vatId: getSetting('vat_id') || undefined,
    taxNumber: getSetting('tax_number') || undefined,
    email: getSetting('company_email') || undefined,
    phone: getSetting('company_phone') || undefined,
  };
}

function getBuyerFromClient(client?: ClientRow): EInvoiceParty {
  return {
    name: client?.company || client?.name || 'Unknown Buyer',
    street: client?.address_street || '',
    city: client?.address_city || '',
    postalCode: client?.address_zip || '',
    countryCode: client?.country_code || 'DE',
    vatId: client?.vat_id || undefined,
    email: client?.email || undefined,
  };
}

function getPaymentFromSettings(db: Database.Database): { iban?: string; bic?: string; bankName?: string } {
  const getSetting = (key: string): string | null => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value || null;
  };

  return {
    iban: getSetting('bank_iban') || undefined,
    bic: getSetting('bank_bic') || undefined,
    bankName: getSetting('bank_name') || undefined,
  };
}

function buildEInvoiceData(
  invoice: InvoiceRow,
  items: InvoiceItemRow[],
  seller: EInvoiceParty,
  buyer: EInvoiceParty,
  payment: { iban?: string; bic?: string; bankName?: string }
): EInvoiceData {
  // Build line items
  const lineItems: EInvoiceLineItem[] = items.map((item, i) => ({
    id: String(i + 1),
    description: item.description,
    quantity: item.quantity,
    unitCode: getUnitCode(item.unit),
    unitPrice: item.unit_price,
    lineTotal: item.amount,
    vatRate: invoice.vat_rate, // Currently single VAT rate per invoice
    vatCategoryCode: getVatCategoryCode(invoice.vat_rate),
  }));

  // VAT breakdown (single rate for now, multi-VAT in Phase 2)
  const vatBreakdown = [
    {
      categoryCode: getVatCategoryCode(invoice.vat_rate),
      rate: invoice.vat_rate,
      taxableAmount: invoice.subtotal,
      taxAmount: invoice.vat_amount,
    },
  ];

  return {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date,
    invoiceTypeCode: '380', // Standard invoice
    currencyCode: 'EUR',
    buyerReference: invoice.buyer_reference || undefined,
    seller,
    buyer,
    payment: payment.iban ? {
      iban: payment.iban,
      bic: payment.bic,
      bankName: payment.bankName,
      paymentReference: invoice.invoice_number,
      paymentMeansCode: '58', // SEPA credit transfer
    } : undefined,
    items: lineItems,
    subtotal: invoice.subtotal,
    vatTotal: invoice.vat_amount,
    total: invoice.total,
    amountDue: invoice.total, // Assuming not partially paid
    vatBreakdown,
    notes: invoice.notes || undefined,
    leitwegId: invoice.leitweg_id || undefined,
  };
}
