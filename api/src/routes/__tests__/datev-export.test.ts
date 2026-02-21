/**
 * Server-Side DATEV Export Tests
 * 
 * Tests DATEV CSV generation with SKR03/SKR04 compliance.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb, resetTestDb, closeTestDb, resetIdCounter,
  insertTestIncome, insertTestExpense, insertTestAsset, insertTestDepreciation,
} from '../../../src/test/setup.js';
import { generateDatevExport } from '../../services/datevExportService.js';

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
// SKR03 Export Tests
// ============================================================================

describe('DATEV Export - SKR03', () => {
  it('should export income records with correct accounts', () => {
    insertTestIncome(db, {
      date: '2025-01-15', net_amount: 5000, vat_rate: 19,
      description: 'Web Development', euer_category: 'services',
    });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    expect(result.recordCount).toBe(1);
    expect(result.records[0].debitCredit).toBe('H'); // Credit for income
    expect(result.records[0].account).toBe(8400); // Erlöse 19% (SKR03)
    expect(result.records[0].counterAccount).toBe(1200); // Bank
    expect(result.records[0].vatCode).toBe(3); // 19%
  });

  it('should export expense records with correct accounts', () => {
    insertTestExpense(db, {
      date: '2025-02-10', net_amount: 500, vat_rate: 19,
      description: 'Adobe License', category: 'software',
    });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    expect(result.recordCount).toBe(1);
    expect(result.records[0].debitCredit).toBe('S'); // Debit for expense
    expect(result.records[0].account).toBe(4964); // EDV-Kosten (SKR03)
    expect(result.records[0].counterAccount).toBe(1200); // Bank
    expect(result.records[0].vatCode).toBe(3); // 19%
  });

  it('should use correct counter accounts for payment methods', () => {
    insertTestExpense(db, {
      date: '2025-01-10', net_amount: 100, category: 'office_supplies',
    });

    // Set payment method
    db.prepare("UPDATE expenses SET payment_method = 'cash'").run();

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    expect(result.records[0].counterAccount).toBe(1000); // Kasse (SKR03)
  });

  it('should include depreciation records', () => {
    const assetId = insertTestAsset(db, {
      name: 'MacBook Pro', purchase_price: 3000, useful_life_years: 3,
      purchase_date: '2025-01-01',
    });
    insertTestDepreciation(db, {
      asset_id: assetId, year: 2025,
      depreciation_amount: 1000, accumulated_depreciation: 1000, book_value: 2000,
    });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    // Find the AfA record
    const afaRecord = result.records.find(r => r.description.includes('AfA'));
    expect(afaRecord).toBeDefined();
    expect(afaRecord!.account).toBe(4830); // Abschreibungen (SKR03)
    expect(afaRecord!.amount).toBe(1000);
    expect(afaRecord!.vatCode).toBe(0); // No VAT on depreciation
  });

  it('should format dates as DDMM', () => {
    insertTestIncome(db, { date: '2025-03-15', net_amount: 1000 });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    expect(result.records[0].documentDate).toBe('1503');
  });

  it('should format amounts with German locale', () => {
    insertTestIncome(db, {
      date: '2025-01-15', net_amount: 1234.56, vat_rate: 19,
    });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    // CSV should contain German number format
    expect(result.csv).toContain(',');
    // Gross amount: 1234.56 + 234.57 = 1469.13
    expect(result.csv).toContain('1469,13');
  });

  it('should apply deductible percent to expense amounts', () => {
    insertTestExpense(db, {
      date: '2025-01-20', net_amount: 100, vat_rate: 19,
      category: 'travel', deductible_percent: 70,
    });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    // Gross: 119 * 0.70 = 83.30
    expect(result.records[0].amount).toBe(83.3);
  });
});

// ============================================================================
// SKR04 Export Tests
// ============================================================================

describe('DATEV Export - SKR04', () => {
  it('should use SKR04 income accounts', () => {
    insertTestIncome(db, {
      date: '2025-01-15', net_amount: 5000, vat_rate: 19,
      euer_category: 'services',
    });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR04',
    });

    expect(result.records[0].account).toBe(4400); // Erlöse 19% (SKR04)
    expect(result.records[0].counterAccount).toBe(1800); // Bank (SKR04)
  });

  it('should use SKR04 expense accounts', () => {
    insertTestExpense(db, {
      date: '2025-02-10', net_amount: 500, vat_rate: 19, category: 'software',
    });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR04',
    });

    expect(result.records[0].account).toBe(6520); // EDV-Kosten (SKR04)
    expect(result.records[0].counterAccount).toBe(1800); // Bank (SKR04)
  });
});

// ============================================================================
// CSV Format Tests
// ============================================================================

describe('DATEV CSV Format', () => {
  it('should generate valid CSV with EXTF header', () => {
    insertTestIncome(db, { date: '2025-01-15', net_amount: 1000 });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
      consultantNumber: '12345',
      clientNumber: '67890',
    });

    const lines = result.csv.split('\n');
    expect(lines[0]).toContain('EXTF');
    expect(lines[0]).toContain('"12345"'); // Berater
    expect(lines[0]).toContain('"67890"'); // Mandant
    expect(lines[1]).toContain('Umsatz');
    expect(lines[1]).toContain('Buchungstext');
  });

  it('should use semicolon as delimiter', () => {
    insertTestIncome(db, { date: '2025-01-15', net_amount: 1000 });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    const dataLine = result.csv.split('\n')[2]; // First data row
    expect(dataLine.split(';').length).toBeGreaterThanOrEqual(10);
  });

  it('should generate correct filename', () => {
    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-03-31',
      chartOfAccounts: 'SKR03',
    });

    expect(result.filename).toBe('DATEV_SKR03_20250101_20250331.csv');
  });

  it('should handle empty date range gracefully', () => {
    const result = generateDatevExport(db, {
      startDate: '2099-01-01',
      endDate: '2099-12-31',
      chartOfAccounts: 'SKR03',
    });

    expect(result.recordCount).toBe(0);
    expect(result.warnings).toContain('No records found in the selected date range');
    expect(result.errors).toHaveLength(0);
  });

  it('should exclude soft-deleted records', () => {
    insertTestIncome(db, { date: '2025-01-15', net_amount: 1000 });
    insertTestIncome(db, { date: '2025-01-20', net_amount: 2000 });

    // Soft-delete second record
    const records = db.prepare('SELECT id FROM income ORDER BY date ASC').all() as Array<{ id: string }>;
    db.prepare('UPDATE income SET is_deleted = 1 WHERE id = ?').run(records[1].id);

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    expect(result.recordCount).toBe(1);
  });

  it('should truncate long descriptions to 60 chars', () => {
    insertTestIncome(db, {
      date: '2025-01-15', net_amount: 1000,
      description: 'This is a very long description that exceeds the DATEV maximum length of sixty characters',
    });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    expect(result.records[0].description.length).toBeLessThanOrEqual(60);
    expect(result.records[0].description.endsWith('...')).toBe(true);
  });

  it('should include reference numbers in Belegfeld 1', () => {
    insertTestIncome(db, { date: '2025-01-15', net_amount: 1000 });
    db.prepare("UPDATE income SET reference_number = 'EI-2025-001'").run();

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    expect(result.records[0].documentRef1).toBe('EI-2025-001');
  });

  it('should map 7% VAT correctly', () => {
    insertTestIncome(db, { date: '2025-01-15', net_amount: 1000, vat_rate: 7 });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    expect(result.records[0].vatCode).toBe(2); // BU-Schlüssel 2 = 7%
  });

  it('should map 0% VAT correctly', () => {
    insertTestIncome(db, { date: '2025-01-15', net_amount: 1000, vat_rate: 0 });

    const result = generateDatevExport(db, {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      chartOfAccounts: 'SKR03',
    });

    expect(result.records[0].vatCode).toBe(0); // BU-Schlüssel 0 = steuerfrei
  });
});
