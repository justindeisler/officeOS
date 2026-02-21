/**
 * E-Rechnung Tests
 * 
 * Tests ZUGFeRD 2.1 and X-Rechnung 3.0 generation, validation, and parsing.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, resetTestDb, closeTestDb, resetIdCounter, insertTestClient, insertTestInvoice, testId } from '../../../src/test/setup.js';
import { generateZugferdXml } from '../../services/eInvoice/zugferd-generator.js';
import { generateXRechnungXml } from '../../services/eInvoice/xrechnung-generator.js';
import { validateEInvoice } from '../../services/eInvoice/validator.js';
import { parseEInvoiceXml } from '../../services/eInvoice/index.js';
import { getUnitCode, getVatCategoryCode } from '../../services/eInvoice/types.js';
import type { EInvoiceData } from '../../services/eInvoice/types.js';

// Mock database module
vi.mock('../../database.js', () => ({
  generateId: () => crypto.randomUUID(),
  getCurrentTimestamp: () => new Date().toISOString(),
  getDb: () => { throw new Error('Use db directly'); },
  closeDb: () => {},
}));

let db: Database.Database;

beforeEach(() => {
  db = resetTestDb();
  resetIdCounter();
});

afterAll(() => {
  closeTestDb();
});

// ============================================================================
// Test Data
// ============================================================================

function createSampleInvoiceData(overrides: Partial<EInvoiceData> = {}): EInvoiceData {
  return {
    invoiceNumber: 'RE-2025-001',
    invoiceDate: '2025-01-15',
    dueDate: '2025-01-29',
    invoiceTypeCode: '380',
    currencyCode: 'EUR',
    seller: {
      name: 'Justin Deisler',
      tradingName: 'JD Web Development',
      street: 'Musterstraße 1',
      city: 'München',
      postalCode: '80331',
      countryCode: 'DE',
      vatId: 'DE123456789',
      taxNumber: '143/123/12345',
      email: 'justin@example.com',
    },
    buyer: {
      name: 'Test Client GmbH',
      street: 'Kundenweg 42',
      city: 'Berlin',
      postalCode: '10115',
      countryCode: 'DE',
      vatId: 'DE987654321',
      email: 'client@example.com',
    },
    payment: {
      iban: 'DE89370400440532013000',
      bic: 'COBADEFFXXX',
      bankName: 'Commerzbank',
      paymentReference: 'RE-2025-001',
      paymentMeansCode: '58',
    },
    items: [
      {
        id: '1',
        description: 'Web Development',
        quantity: 40,
        unitCode: 'HUR',
        unitPrice: 100,
        lineTotal: 4000,
        vatRate: 19,
        vatCategoryCode: 'S',
      },
      {
        id: '2',
        description: 'Design Consultation',
        quantity: 5,
        unitCode: 'HUR',
        unitPrice: 120,
        lineTotal: 600,
        vatRate: 19,
        vatCategoryCode: 'S',
      },
    ],
    subtotal: 4600,
    vatTotal: 874,
    total: 5474,
    amountDue: 5474,
    vatBreakdown: [
      {
        categoryCode: 'S',
        rate: 19,
        taxableAmount: 4600,
        taxAmount: 874,
      },
    ],
    notes: 'Thank you for your business!',
    ...overrides,
  };
}

// ============================================================================
// ZUGFeRD Generation Tests
// ============================================================================

describe('ZUGFeRD 2.1 Generation', () => {
  it('should generate valid CII XML', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('CrossIndustryInvoice');
    expect(xml).toContain('urn:factur-x.eu:1p0:comfort');
  });

  it('should include invoice number and dates', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);

    expect(xml).toContain('<ram:ID>RE-2025-001</ram:ID>');
    expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>');
    expect(xml).toContain('20250115'); // Date format 102
    expect(xml).toContain('20250129'); // Due date
  });

  it('should include seller and buyer information', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);

    expect(xml).toContain('JD Web Development');
    expect(xml).toContain('Musterstraße 1');
    expect(xml).toContain('80331');
    expect(xml).toContain('Test Client GmbH');
    expect(xml).toContain('DE123456789');
  });

  it('should include line items', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);

    expect(xml).toContain('Web Development');
    expect(xml).toContain('Design Consultation');
    expect(xml).toContain('unitCode="HUR"');
    expect(xml).toContain('<ram:ChargeAmount>100.00</ram:ChargeAmount>');
    expect(xml).toContain('<ram:BilledQuantity unitCode="HUR">40.00</ram:BilledQuantity>');
  });

  it('should include monetary totals', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);

    expect(xml).toContain('<ram:LineTotalAmount>4600.00</ram:LineTotalAmount>');
    expect(xml).toContain('<ram:TaxBasisTotalAmount>4600.00</ram:TaxBasisTotalAmount>');
    expect(xml).toContain('<ram:GrandTotalAmount>5474.00</ram:GrandTotalAmount>');
    expect(xml).toContain('<ram:DuePayableAmount>5474.00</ram:DuePayableAmount>');
  });

  it('should include VAT breakdown', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);

    expect(xml).toContain('<ram:CategoryCode>S</ram:CategoryCode>');
    expect(xml).toContain('<ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>');
    expect(xml).toContain('<ram:CalculatedAmount>874.00</ram:CalculatedAmount>');
  });

  it('should include payment information', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);

    expect(xml).toContain('DE89370400440532013000');
    expect(xml).toContain('COBADEFFXXX');
    expect(xml).toContain('Commerzbank');
  });

  it('should include notes', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);

    expect(xml).toContain('Thank you for your business!');
  });

  it('should escape XML special characters', () => {
    const data = createSampleInvoiceData({
      notes: 'Price < €100 & >= €50 for "special" items',
    });
    const xml = generateZugferdXml(data);

    expect(xml).toContain('&lt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;');
    expect(xml).not.toContain('< €100');
  });
});

// ============================================================================
// X-Rechnung Generation Tests
// ============================================================================

describe('X-Rechnung 3.0 Generation', () => {
  it('should generate valid UBL XML', () => {
    const data = createSampleInvoiceData();
    const xml = generateXRechnungXml(data);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('ubl:Invoice');
    expect(xml).toContain('urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0');
  });

  it('should include invoice number and dates in UBL format', () => {
    const data = createSampleInvoiceData();
    const xml = generateXRechnungXml(data);

    expect(xml).toContain('<cbc:ID>RE-2025-001</cbc:ID>');
    expect(xml).toContain('<cbc:IssueDate>2025-01-15</cbc:IssueDate>');
    expect(xml).toContain('<cbc:DueDate>2025-01-29</cbc:DueDate>');
    expect(xml).toContain('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>');
  });

  it('should include seller and buyer in UBL format', () => {
    const data = createSampleInvoiceData();
    const xml = generateXRechnungXml(data);

    expect(xml).toContain('AccountingSupplierParty');
    expect(xml).toContain('AccountingCustomerParty');
    expect(xml).toContain('JD Web Development');
    expect(xml).toContain('Test Client GmbH');
  });

  it('should include monetary totals in UBL format', () => {
    const data = createSampleInvoiceData();
    const xml = generateXRechnungXml(data);

    expect(xml).toContain('LegalMonetaryTotal');
    expect(xml).toContain('currencyID="EUR"');
    expect(xml).toContain('>5474.00<');
  });

  it('should include line items in UBL format', () => {
    const data = createSampleInvoiceData();
    const xml = generateXRechnungXml(data);

    expect(xml).toContain('InvoiceLine');
    expect(xml).toContain('InvoicedQuantity');
    expect(xml).toContain('Web Development');
  });

  it('should include buyer reference for X-Rechnung compliance', () => {
    const data = createSampleInvoiceData({ buyerReference: 'PO-12345' });
    const xml = generateXRechnungXml(data);

    expect(xml).toContain('<cbc:BuyerReference>PO-12345</cbc:BuyerReference>');
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('E-Invoice Validation', () => {
  it('should validate a complete invoice successfully', () => {
    const data = createSampleInvoiceData();
    const result = validateEInvoice(data);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail without invoice number', () => {
    const data = createSampleInvoiceData({ invoiceNumber: '' });
    const result = validateEInvoice(data);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'BR-02')).toBe(true);
  });

  it('should fail without invoice date', () => {
    const data = createSampleInvoiceData({ invoiceDate: '' });
    const result = validateEInvoice(data);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'BR-03')).toBe(true);
  });

  it('should fail without seller name', () => {
    const data = createSampleInvoiceData();
    data.seller.name = '';
    const result = validateEInvoice(data);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'BR-06')).toBe(true);
  });

  it('should fail without buyer name', () => {
    const data = createSampleInvoiceData();
    data.buyer.name = '';
    const result = validateEInvoice(data);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'BR-07')).toBe(true);
  });

  it('should fail without seller address', () => {
    const data = createSampleInvoiceData();
    data.seller.street = '';
    const result = validateEInvoice(data);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'BR-08')).toBe(true);
  });

  it('should fail without line items', () => {
    const data = createSampleInvoiceData({ items: [] });
    const result = validateEInvoice(data);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'BR-13')).toBe(true);
  });

  it('should fail when line sum does not match subtotal', () => {
    const data = createSampleInvoiceData({ subtotal: 9999 });
    const result = validateEInvoice(data);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'BR-CO-10')).toBe(true);
  });

  it('should fail when total does not match subtotal + VAT', () => {
    const data = createSampleInvoiceData({ total: 9999 });
    const result = validateEInvoice(data);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'BR-CO-15')).toBe(true);
  });

  it('should warn about missing IBAN', () => {
    const data = createSampleInvoiceData({ payment: undefined });
    const result = validateEInvoice(data);

    expect(result.warnings.some(w => w.code === 'W-PAY')).toBe(true);
  });

  it('should fail without seller VAT ID or tax number', () => {
    const data = createSampleInvoiceData();
    data.seller.vatId = undefined;
    data.seller.taxNumber = undefined;
    const result = validateEInvoice(data);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.code === 'BR-11')).toBe(true);
  });
});

// ============================================================================
// Parsing Tests
// ============================================================================

describe('E-Invoice Parsing', () => {
  it('should detect ZUGFeRD format from XML', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);
    const parsed = parseEInvoiceXml(xml);

    expect(parsed.format).toBe('zugferd');
  });

  it('should detect X-Rechnung UBL format from XML', () => {
    const data = createSampleInvoiceData();
    const xml = generateXRechnungXml(data);
    const parsed = parseEInvoiceXml(xml);

    expect(parsed.format).toBe('xrechnung-ubl');
  });

  it('should extract invoice number from ZUGFeRD XML', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);
    const parsed = parseEInvoiceXml(xml);

    expect(parsed.invoiceNumber).toBe('RE-2025-001');
  });

  it('should extract totals from ZUGFeRD XML', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);
    const parsed = parseEInvoiceXml(xml);

    expect(parsed.total).toBe(5474.00);
    expect(parsed.subtotal).toBe(4600.00);
  });

  it('should extract dates from ZUGFeRD XML', () => {
    const data = createSampleInvoiceData();
    const xml = generateZugferdXml(data);
    const parsed = parseEInvoiceXml(xml);

    expect(parsed.invoiceDate).toBe('2025-01-15');
  });

  it('should extract data from X-Rechnung UBL XML', () => {
    const data = createSampleInvoiceData();
    const xml = generateXRechnungXml(data);
    const parsed = parseEInvoiceXml(xml);

    expect(parsed.invoiceNumber).toBe('RE-2025-001');
    expect(parsed.invoiceDate).toBe('2025-01-15');
    expect(parsed.dueDate).toBe('2025-01-29');
  });
});

// ============================================================================
// Unit Code & VAT Category Tests
// ============================================================================

describe('Unit Codes & VAT Categories', () => {
  it('should map common units to UN/ECE codes', () => {
    expect(getUnitCode('hours')).toBe('HUR');
    expect(getUnitCode('hour')).toBe('HUR');
    expect(getUnitCode('days')).toBe('DAY');
    expect(getUnitCode('pieces')).toBe('C62');
    expect(getUnitCode('months')).toBe('MON');
    expect(getUnitCode('Stunden')).toBe('HUR');
    expect(getUnitCode('pauschal')).toBe('C62');
  });

  it('should default to C62 for unknown units', () => {
    expect(getUnitCode('widgets')).toBe('C62');
  });

  it('should map VAT rates to category codes', () => {
    expect(getVatCategoryCode(19)).toBe('S');
    expect(getVatCategoryCode(7)).toBe('S');
    expect(getVatCategoryCode(0)).toBe('Z');
  });
});
