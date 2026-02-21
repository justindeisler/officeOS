/**
 * Smart Suggestions Service — Tests
 *
 * Covers:
 * ✅ Returns top 10 recent vendors sorted by frequency
 * ✅ Excludes soft-deleted and duplicate records
 * ✅ Suggests next invoice number (sequential pattern)
 * ✅ Suggests next invoice number (year-based pattern)
 * ✅ Handles year rollover (RE-2024-999 → RE-2025-001)
 * ✅ Falls back to date-based number when no pattern
 * ✅ Suggests most common VAT rate for vendor
 * ✅ Suggests payment terms based on client history
 * ✅ Returns empty suggestions for new user with no data
 * ✅ Limits to last 90 days only
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  getSuggestionsForExpense,
  getSuggestionsForIncome,
  getSuggestionsForInvoice,
  getNextInvoiceNumber,
  detectInvoiceNumberPattern,
} from '../smartSuggestionsService.js';
import { resetModel } from '../autoCategorizeService.js';

// ============================================================================
// Test Helpers
// ============================================================================

let db: Database.Database;

function freshDb(): Database.Database {
  const d = new Database(':memory:');
  d.pragma('foreign_keys = ON');

  d.exec(`
    CREATE TABLE expenses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      vendor TEXT,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'software',
      net_amount REAL NOT NULL,
      vat_rate REAL DEFAULT 19,
      vat_amount REAL NOT NULL,
      gross_amount REAL NOT NULL,
      euer_line INTEGER DEFAULT 27,
      euer_category TEXT,
      payment_method TEXT,
      receipt_path TEXT,
      ust_period TEXT,
      ust_reported INTEGER DEFAULT 0,
      deductible_percent INTEGER DEFAULT 100,
      vorsteuer_claimed INTEGER DEFAULT 0,
      is_recurring INTEGER DEFAULT 0,
      recurring_frequency TEXT,
      is_gwg INTEGER DEFAULT 0,
      asset_id TEXT,
      reference_number TEXT,
      is_deleted INTEGER DEFAULT 0,
      is_duplicate BOOLEAN DEFAULT FALSE,
      duplicate_of_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_reverse_charge INTEGER DEFAULT 0,
      reverse_charge_note TEXT,
      is_business_meal INTEGER DEFAULT 0,
      meal_participants TEXT,
      meal_purpose TEXT,
      meal_location TEXT,
      attachment_id TEXT
    );

    CREATE TABLE clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      company TEXT,
      contact_info TEXT,
      notes TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      password_hash TEXT,
      role TEXT DEFAULT 'client',
      last_login_at TEXT,
      assigned_projects TEXT,
      address_street TEXT,
      address_zip TEXT,
      address_city TEXT,
      address_country TEXT DEFAULT 'Deutschland',
      vat_id TEXT,
      country_code TEXT DEFAULT 'DE',
      is_eu_business INTEGER DEFAULT 0,
      client_type TEXT DEFAULT 'domestic'
    );

    CREATE TABLE invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT UNIQUE NOT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'draft',
      client_id TEXT REFERENCES clients(id),
      project_id TEXT,
      subtotal DECIMAL(10,2) NOT NULL,
      vat_rate INTEGER DEFAULT 19,
      vat_amount DECIMAL(10,2) NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      payment_date DATE,
      payment_method TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      pdf_path TEXT,
      einvoice_format TEXT,
      einvoice_xml TEXT,
      einvoice_valid INTEGER,
      leitweg_id TEXT,
      buyer_reference TEXT,
      recurring_invoice_id TEXT,
      dunning_level INTEGER DEFAULT 0,
      last_reminded_at TEXT,
      is_reverse_charge INTEGER DEFAULT 0,
      reverse_charge_note TEXT
    );

    CREATE TABLE income (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      client_id TEXT REFERENCES clients(id),
      invoice_id TEXT,
      description TEXT NOT NULL,
      net_amount REAL NOT NULL,
      vat_rate REAL DEFAULT 19,
      vat_amount REAL NOT NULL,
      gross_amount REAL NOT NULL,
      euer_line INTEGER DEFAULT 14,
      euer_category TEXT DEFAULT 'services',
      payment_method TEXT,
      bank_reference TEXT,
      ust_period TEXT,
      ust_reported INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reference_number TEXT,
      is_deleted INTEGER DEFAULT 0,
      is_reverse_charge INTEGER DEFAULT 0,
      reverse_charge_note TEXT,
      is_duplicate BOOLEAN DEFAULT FALSE,
      duplicate_of_id TEXT
    );
  `);

  return d;
}

function recentDate(daysAgo: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function oldDate(daysAgo: number = 100): string {
  return recentDate(daysAgo);
}

let idCounter = 0;
function nextId(): string {
  return `test-${++idCounter}`;
}

function insertExpense(
  d: Database.Database,
  overrides: Partial<{
    vendor: string;
    description: string;
    category: string;
    net_amount: number;
    vat_rate: number;
    gross_amount: number;
    payment_method: string;
    date: string;
    is_deleted: number;
    is_duplicate: number;
  }> = {}
): void {
  const {
    vendor = 'Test Vendor',
    description = 'Test expense',
    category = 'software',
    net_amount = 100,
    vat_rate = 19,
    gross_amount = 119,
    payment_method = 'bank_transfer',
    date = recentDate(10),
    is_deleted = 0,
    is_duplicate = 0,
  } = overrides;

  d.prepare(`
    INSERT INTO expenses (id, date, vendor, description, category, net_amount, vat_rate,
      vat_amount, gross_amount, payment_method, is_deleted, is_duplicate, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(nextId(), date, vendor, description, category, net_amount, vat_rate,
    net_amount * vat_rate / 100, gross_amount, payment_method, is_deleted, is_duplicate);
}

function insertInvoice(
  d: Database.Database,
  invoiceNumber: string,
  overrides: Partial<{
    invoice_date: string;
    due_date: string;
    client_id: string;
    created_at: string;
  }> = {}
): void {
  const {
    invoice_date = recentDate(10),
    due_date = recentDate(-20),
    client_id = null,
    created_at = new Date().toISOString(),
  } = overrides;

  d.prepare(`
    INSERT INTO invoices (id, invoice_number, invoice_date, due_date, client_id,
      subtotal, vat_rate, vat_amount, total, created_at)
    VALUES (?, ?, ?, ?, ?, 1000, 19, 190, 1190, ?)
  `).run(nextId(), invoiceNumber, invoice_date, due_date, client_id, created_at);
}

function insertClient(d: Database.Database, name: string, status = 'active'): string {
  const id = nextId();
  d.prepare(`
    INSERT INTO clients (id, name, status) VALUES (?, ?, ?)
  `).run(id, name, status);
  return id;
}

function insertIncome(
  d: Database.Database,
  clientId: string,
  overrides: Partial<{
    date: string;
    description: string;
    gross_amount: number;
    is_deleted: number;
    is_duplicate: number;
  }> = {}
): void {
  const {
    date = recentDate(10),
    description = 'Payment received',
    gross_amount = 1190,
    is_deleted = 0,
    is_duplicate = 0,
  } = overrides;

  d.prepare(`
    INSERT INTO income (id, date, client_id, description, net_amount, vat_rate,
      vat_amount, gross_amount, is_deleted, is_duplicate, created_at)
    VALUES (?, ?, ?, ?, ?, 19, ?, ?, ?, ?, datetime('now'))
  `).run(nextId(), date, clientId, description, gross_amount / 1.19,
    gross_amount - gross_amount / 1.19, gross_amount, is_deleted, is_duplicate);
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  idCounter = 0;
  db = freshDb();
  resetModel(); // Reset auto-categorization model
});

// ─── Invoice Number Pattern Detection ─────────────────────────────

describe('detectInvoiceNumberPattern', () => {
  it('detects year-based pattern (RE-2024-001)', () => {
    const result = detectInvoiceNumberPattern(['RE-2024-003', 'RE-2024-002', 'RE-2024-001']);
    expect(result.pattern).toBe('year-based');
    expect(result.prefix).toBe('RE');
    expect(result.year).toBe(2024);
    expect(result.lastNumber).toBe(3);
  });

  it('detects sequential pattern with prefix (INV-042)', () => {
    const result = detectInvoiceNumberPattern(['INV-042', 'INV-041', 'INV-040']);
    expect(result.pattern).toBe('sequential');
    expect(result.prefix).toBe('INV');
    expect(result.lastNumber).toBe(42);
  });

  it('detects pure sequential pattern (003)', () => {
    const result = detectInvoiceNumberPattern(['003', '002', '001']);
    expect(result.pattern).toBe('sequential');
    expect(result.prefix).toBeUndefined();
    expect(result.lastNumber).toBe(3);
  });

  it('detects date-based pattern (INV-20240115-01)', () => {
    const result = detectInvoiceNumberPattern(['INV-20240115-01']);
    expect(result.pattern).toBe('date-based');
    expect(result.prefix).toBe('INV');
    expect(result.year).toBe(2024);
    expect(result.lastNumber).toBe(1);
  });

  it('returns unknown for empty array', () => {
    const result = detectInvoiceNumberPattern([]);
    expect(result.pattern).toBe('unknown');
  });

  it('returns unknown for unrecognizable patterns', () => {
    const result = detectInvoiceNumberPattern(['abc-xyz']);
    expect(result.pattern).toBe('unknown');
  });
});

// ─── Next Invoice Number ──────────────────────────────────────────

describe('getNextInvoiceNumber', () => {
  it('suggests next sequential number', () => {
    insertInvoice(db, 'INV-003');
    insertInvoice(db, 'INV-002');
    const next = getNextInvoiceNumber(db);
    expect(next).toBe('INV-004');
  });

  it('suggests next year-based number', () => {
    const year = new Date().getFullYear();
    insertInvoice(db, `RE-${year}-005`);
    insertInvoice(db, `RE-${year}-004`);
    const next = getNextInvoiceNumber(db);
    expect(next).toBe(`RE-${year}-006`);
  });

  it('handles year rollover (previous year → new year)', () => {
    const lastYear = new Date().getFullYear() - 1;
    insertInvoice(db, `RE-${lastYear}-999`);
    const next = getNextInvoiceNumber(db);
    const currentYear = new Date().getFullYear();
    expect(next).toBe(`RE-${currentYear}-001`);
  });

  it('pads numbers correctly', () => {
    insertInvoice(db, 'INV-001');
    const next = getNextInvoiceNumber(db);
    expect(next).toBe('INV-002');
  });

  it('falls back to date-based number when no invoices exist', () => {
    const next = getNextInvoiceNumber(db);
    const today = new Date();
    const expectedDate = [
      String(today.getFullYear()),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('');
    expect(next).toBe(`INV-${expectedDate}-001`);
  });

  it('generates date-based number for date-based pattern', () => {
    insertInvoice(db, 'INV-20240115-01');
    const next = getNextInvoiceNumber(db);
    const today = new Date();
    const expectedDate = [
      String(today.getFullYear()),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('');
    expect(next).toBe(`INV-${expectedDate}-01`);
  });
});

// ─── Expense Suggestions ──────────────────────────────────────────

describe('getSuggestionsForExpense', () => {
  it('returns top 10 recent vendors sorted by frequency', () => {
    // Insert 12 vendors with varying frequencies
    for (let i = 0; i < 15; i++) insertExpense(db, { vendor: 'Vendor A' });
    for (let i = 0; i < 10; i++) insertExpense(db, { vendor: 'Vendor B' });
    for (let i = 0; i < 8; i++) insertExpense(db, { vendor: 'Vendor C' });
    for (let i = 0; i < 6; i++) insertExpense(db, { vendor: 'Vendor D' });
    for (let i = 0; i < 5; i++) insertExpense(db, { vendor: 'Vendor E' });
    for (let i = 0; i < 4; i++) insertExpense(db, { vendor: 'Vendor F' });
    for (let i = 0; i < 3; i++) insertExpense(db, { vendor: 'Vendor G' });
    for (let i = 0; i < 2; i++) insertExpense(db, { vendor: 'Vendor H' });
    insertExpense(db, { vendor: 'Vendor I' });
    insertExpense(db, { vendor: 'Vendor J' });
    insertExpense(db, { vendor: 'Vendor K' });
    insertExpense(db, { vendor: 'Vendor L' });

    const result = getSuggestionsForExpense(db);

    expect(result.recentVendors).toBeDefined();
    expect(result.recentVendors!.length).toBe(10);
    expect(result.recentVendors![0].vendor).toBe('Vendor A');
    expect(result.recentVendors![0].count).toBe(15);
    expect(result.recentVendors![1].vendor).toBe('Vendor B');
    expect(result.recentVendors![1].count).toBe(10);
  });

  it('excludes soft-deleted records', () => {
    for (let i = 0; i < 5; i++) insertExpense(db, { vendor: 'Active Vendor' });
    for (let i = 0; i < 10; i++) insertExpense(db, { vendor: 'Deleted Vendor', is_deleted: 1 });

    const result = getSuggestionsForExpense(db);

    expect(result.recentVendors).toBeDefined();
    expect(result.recentVendors!.length).toBe(1);
    expect(result.recentVendors![0].vendor).toBe('Active Vendor');
    expect(result.recentVendors![0].count).toBe(5);
  });

  it('excludes duplicate records', () => {
    for (let i = 0; i < 5; i++) insertExpense(db, { vendor: 'Real Vendor' });
    for (let i = 0; i < 10; i++) insertExpense(db, { vendor: 'Dup Vendor', is_duplicate: 1 });

    const result = getSuggestionsForExpense(db);

    expect(result.recentVendors).toBeDefined();
    expect(result.recentVendors!.length).toBe(1);
    expect(result.recentVendors![0].vendor).toBe('Real Vendor');
  });

  it('limits to last 90 days only', () => {
    // Recent expenses (within 90 days)
    for (let i = 0; i < 3; i++) insertExpense(db, { vendor: 'Recent Vendor', date: recentDate(30) });
    // Old expenses (more than 90 days ago)
    for (let i = 0; i < 10; i++) insertExpense(db, { vendor: 'Old Vendor', date: oldDate(100) });

    const result = getSuggestionsForExpense(db);

    expect(result.recentVendors).toBeDefined();
    expect(result.recentVendors!.length).toBe(1);
    expect(result.recentVendors![0].vendor).toBe('Recent Vendor');
  });

  it('suggests most common VAT rate for vendor', () => {
    for (let i = 0; i < 5; i++) insertExpense(db, { vendor: 'Telekom', vat_rate: 19 });
    for (let i = 0; i < 2; i++) insertExpense(db, { vendor: 'Telekom', vat_rate: 7 });

    const result = getSuggestionsForExpense(db, 'Telekom');

    expect(result.suggestedVatRate).toBe(19);
  });

  it('suggests most common payment method for vendor', () => {
    for (let i = 0; i < 5; i++) insertExpense(db, { vendor: 'AWS', payment_method: 'credit_card' });
    for (let i = 0; i < 2; i++) insertExpense(db, { vendor: 'AWS', payment_method: 'bank_transfer' });

    const result = getSuggestionsForExpense(db, 'AWS');

    expect(result.suggestedPaymentMethod).toBe('credit_card');
  });

  it('returns empty suggestions for new user with no data', () => {
    const result = getSuggestionsForExpense(db);

    expect(result.recentVendors).toBeDefined();
    expect(result.recentVendors!.length).toBe(0);
    expect(result.suggestedVatRate).toBeUndefined();
    expect(result.suggestedPaymentMethod).toBeUndefined();
  });

  it('returns correct lastAmount (most recent transaction)', () => {
    insertExpense(db, { vendor: 'GitHub', gross_amount: 7.00, date: recentDate(30) });
    insertExpense(db, { vendor: 'GitHub', gross_amount: 14.00, date: recentDate(10) });
    insertExpense(db, { vendor: 'GitHub', gross_amount: 21.00, date: recentDate(5) });

    const result = getSuggestionsForExpense(db);

    expect(result.recentVendors![0].vendor).toBe('GitHub');
    expect(result.recentVendors![0].lastAmount).toBe(21.00);
  });

  it('falls back to global VAT rate when no vendor specified', () => {
    for (let i = 0; i < 8; i++) insertExpense(db, { vendor: 'Various', vat_rate: 19 });
    for (let i = 0; i < 3; i++) insertExpense(db, { vendor: 'Other', vat_rate: 7 });

    const result = getSuggestionsForExpense(db);

    expect(result.suggestedVatRate).toBe(19);
  });
});

// ─── Income Suggestions ───────────────────────────────────────────

describe('getSuggestionsForIncome', () => {
  it('returns recent clients sorted by frequency', () => {
    const clientA = insertClient(db, 'Client A');
    const clientB = insertClient(db, 'Client B');

    for (let i = 0; i < 5; i++) insertIncome(db, clientA);
    for (let i = 0; i < 3; i++) insertIncome(db, clientB);

    const result = getSuggestionsForIncome(db);

    expect(result.recentClients).toBeDefined();
    expect(result.recentClients!.length).toBe(2);
    expect(result.recentClients![0].client).toBe('Client A');
    expect(result.recentClients![0].count).toBe(5);
    expect(result.recentClients![1].client).toBe('Client B');
    expect(result.recentClients![1].count).toBe(3);
  });

  it('excludes soft-deleted income records', () => {
    const clientA = insertClient(db, 'Active Client');
    const clientB = insertClient(db, 'Deleted Client');

    for (let i = 0; i < 3; i++) insertIncome(db, clientA);
    for (let i = 0; i < 5; i++) insertIncome(db, clientB, { is_deleted: 1 });

    const result = getSuggestionsForIncome(db);

    expect(result.recentClients!.length).toBe(1);
    expect(result.recentClients![0].client).toBe('Active Client');
  });

  it('excludes duplicate income records', () => {
    const clientA = insertClient(db, 'Real Client');
    const clientB = insertClient(db, 'Dup Client');

    for (let i = 0; i < 3; i++) insertIncome(db, clientA);
    for (let i = 0; i < 5; i++) insertIncome(db, clientB, { is_duplicate: 1 });

    const result = getSuggestionsForIncome(db);

    expect(result.recentClients!.length).toBe(1);
    expect(result.recentClients![0].client).toBe('Real Client');
  });

  it('limits to last 90 days only', () => {
    const recentClient = insertClient(db, 'Recent Client');
    const oldClient = insertClient(db, 'Old Client');

    for (let i = 0; i < 3; i++) insertIncome(db, recentClient, { date: recentDate(30) });
    for (let i = 0; i < 5; i++) insertIncome(db, oldClient, { date: oldDate(100) });

    const result = getSuggestionsForIncome(db);

    expect(result.recentClients!.length).toBe(1);
    expect(result.recentClients![0].client).toBe('Recent Client');
  });

  it('returns correct lastAmount for clients', () => {
    const clientA = insertClient(db, 'Client A');
    insertIncome(db, clientA, { gross_amount: 1000, date: recentDate(30) });
    insertIncome(db, clientA, { gross_amount: 2000, date: recentDate(10) });

    const result = getSuggestionsForIncome(db);

    expect(result.recentClients![0].lastAmount).toBe(2000);
  });

  it('returns empty array for new user with no data', () => {
    const result = getSuggestionsForIncome(db);

    expect(result.recentClients).toBeDefined();
    // May contain active clients from fallback, but no income-based ones
    expect(result.recentClients!.length).toBe(0);
  });

  it('falls back to active clients when no income records', () => {
    insertClient(db, 'Fallback Client 1');
    insertClient(db, 'Fallback Client 2');

    const result = getSuggestionsForIncome(db);

    expect(result.recentClients!.length).toBe(2);
    expect(result.recentClients![0].count).toBe(0); // No transactions
  });
});

// ─── Invoice Suggestions ──────────────────────────────────────────

describe('getSuggestionsForInvoice', () => {
  it('includes next invoice number', () => {
    const year = new Date().getFullYear();
    insertInvoice(db, `RE-${year}-005`);

    const result = getSuggestionsForInvoice(db);

    expect(result.nextInvoiceNumber).toBe(`RE-${year}-006`);
  });

  it('suggests payment terms based on client history', () => {
    const clientId = insertClient(db, 'Regular Client');

    // All invoices with 30-day terms
    insertInvoice(db, 'INV-001', {
      client_id: clientId,
      invoice_date: '2024-01-01',
      due_date: '2024-01-31',
    });
    insertInvoice(db, 'INV-002', {
      client_id: clientId,
      invoice_date: '2024-02-01',
      due_date: '2024-03-02',
    });
    insertInvoice(db, 'INV-003', {
      client_id: clientId,
      invoice_date: '2024-03-01',
      due_date: '2024-03-31',
    });

    const result = getSuggestionsForInvoice(db, clientId);

    expect(result.suggestedPaymentTerms).toBe(30);
  });

  it('includes suggested due date', () => {
    const result = getSuggestionsForInvoice(db);

    expect(result.suggestedDueDate).toBeDefined();
    // Should be a valid date string
    expect(result.suggestedDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('defaults to 14-day payment terms for new user', () => {
    const result = getSuggestionsForInvoice(db);

    expect(result.suggestedPaymentTerms).toBe(14);
  });

  it('provides fallback invoice number when no invoices exist', () => {
    const result = getSuggestionsForInvoice(db);

    expect(result.nextInvoiceNumber).toBeDefined();
    expect(result.nextInvoiceNumber).toMatch(/^INV-\d{8}-001$/);
  });
});
