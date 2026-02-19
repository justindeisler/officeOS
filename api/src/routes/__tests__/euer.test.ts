/**
 * EÜR (Einnahmenüberschussrechnung) Report Tests
 *
 * Comprehensive tests for the Profit/EÜR report endpoint:
 *   GET /api/accounting/reports/euer/:year
 *
 * Tests tax calculation accuracy for German freelancer annual profit calculation.
 * These calculations directly affect tax filings — errors here = real money mistakes.
 *
 * Coverage:
 *   1. Income calculations (quarterly totals, annual totals, empty)
 *   2. Expense calculations (deductible_percent: 100%, partial, 0%, null)
 *   3. Profit (Gewinn) calculation (income - expenses, Homeoffice-Pauschale)
 *   4. EÜR line items (EUER_LINES constants, aggregation, empty lines)
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestIncome,
  insertTestExpense,
  testId,
} from '../../test/setup.js';
import { EUER_LINES, HOMEOFFICE_PAUSCHALE } from '../../constants/euer.js';

// ============================================================================
// Setup
// ============================================================================

let testDb: Database.Database;

import { createTestApp } from '../../test/app.js';
import reportsRouter from '../reports.js';
import request from 'supertest';

const app = createTestApp(reportsRouter, '/api/reports');

// ============================================================================
// Helpers
// ============================================================================

/** Helper: insert depreciation schedule entry */
function insertDepreciation(
  db: Database.Database,
  overrides: {
    asset_id?: string;
    year: number;
    depreciation_amount: number;
    accumulated_depreciation?: number;
    book_value?: number;
  }
) {
  const assetId = overrides.asset_id ?? testId('asset');

  // Ensure the referenced asset exists (required by FK constraint)
  const existingAsset = db.prepare('SELECT id FROM assets WHERE id = ?').get(assetId);
  if (!existingAsset) {
    db.prepare(
      `INSERT INTO assets (id, name, purchase_date, purchase_price, useful_life_years, depreciation_method, salvage_value, current_value, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      assetId,
      'Test Asset',
      `${overrides.year}-01-01`,
      overrides.depreciation_amount * 3,
      3,
      'linear',
      0,
      overrides.depreciation_amount * 3,
      'equipment'
    );
  }

  const id = testId('dep');
  db.prepare(
    `INSERT INTO depreciation_schedule (id, asset_id, year, depreciation_amount, accumulated_depreciation, book_value)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    assetId,
    overrides.year,
    overrides.depreciation_amount,
    overrides.accumulated_depreciation ?? overrides.depreciation_amount,
    overrides.book_value ?? 0
  );
  return id;
}

/** Helper: insert an expense with deductible_percent set to NULL in DB */
function insertExpenseWithNullDeductible(
  db: Database.Database,
  overrides: {
    date?: string;
    net_amount?: number;
    euer_line?: number;
  } = {}
) {
  const id = testId('expense');
  const netAmount = overrides.net_amount ?? 500;
  const vatRate = 19;
  const vatAmount = Math.round(netAmount * (vatRate / 100) * 100) / 100;
  const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;

  db.prepare(
    `INSERT INTO expenses (id, date, vendor, description, category, net_amount, vat_rate, vat_amount, gross_amount, euer_line, euer_category, deductible_percent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))`
  ).run(
    id,
    overrides.date ?? '2024-06-15',
    'Test Vendor',
    'Expense with NULL deductible',
    'software',
    netAmount,
    vatRate,
    vatAmount,
    grossAmount,
    overrides.euer_line ?? EUER_LINES.SONSTIGE,
    null
  );
  return id;
}

/** Helper: get EÜR report for a year */
async function getEuerReport(year: number) {
  return request(app).get(`/api/reports/euer/${year}`);
}

// ============================================================================
// Tests
// ============================================================================

describe('EÜR Report — GET /api/reports/euer/:year', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import('../../database.js')) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Income Calculations
  // ==========================================================================

  describe('Income Calculations', () => {
    it('calculates annual total income from multiple invoices', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 5000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });
      insertTestIncome(testDb, { date: '2024-04-10', net_amount: 8000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });
      insertTestIncome(testDb, { date: '2024-07-22', net_amount: 6500, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });
      insertTestIncome(testDb, { date: '2024-10-05', net_amount: 4500, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBeCloseTo(24000, 2); // 5000 + 8000 + 6500 + 4500
    });

    it('sums income correctly per quarter (Q1 through Q4)', async () => {
      // Q1 income
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 3000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });
      insertTestIncome(testDb, { date: '2024-02-20', net_amount: 4000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });
      insertTestIncome(testDb, { date: '2024-03-31', net_amount: 2000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });

      // Q2 income
      insertTestIncome(testDb, { date: '2024-04-01', net_amount: 5000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });
      insertTestIncome(testDb, { date: '2024-06-30', net_amount: 6000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });

      // Q3 income
      insertTestIncome(testDb, { date: '2024-09-15', net_amount: 7000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });

      // Q4 income
      insertTestIncome(testDb, { date: '2024-12-31', net_amount: 8000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // All quarters combined
      expect(res.body.totalIncome).toBeCloseTo(35000, 2); // 9000 + 11000 + 7000 + 8000
    });

    it('returns zero income when no income records exist', async () => {
      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBe(0);
    });

    it('excludes income from other years', async () => {
      // 2023 — should be excluded
      insertTestIncome(testDb, { date: '2023-12-31', net_amount: 99999 });
      // 2024 — should be included
      insertTestIncome(testDb, { date: '2024-01-01', net_amount: 5000 });
      insertTestIncome(testDb, { date: '2024-12-31', net_amount: 3000 });
      // 2025 — should be excluded
      insertTestIncome(testDb, { date: '2025-01-01', net_amount: 88888 });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBeCloseTo(8000, 2);
    });

    it('handles income with various EÜR line numbers', async () => {
      // Standard business income (line 14)
      insertTestIncome(testDb, { date: '2024-03-15', net_amount: 10000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });
      // USt-Erstattung (line 18)
      insertTestIncome(testDb, { date: '2024-06-15', net_amount: 500, euer_line: EUER_LINES.UST_ERSTATTUNG });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.income[EUER_LINES.BETRIEBSEINNAHMEN]).toBeCloseTo(10000, 2);
      expect(res.body.income[EUER_LINES.UST_ERSTATTUNG]).toBeCloseTo(500, 2);
      expect(res.body.totalIncome).toBeCloseTo(10500, 2);
    });

    it('defaults income without euer_line to BETRIEBSEINNAHMEN (line 14)', async () => {
      // Insert income with euer_line = null by directly using SQL
      const id = testId('income');
      testDb.prepare(
        `INSERT INTO income (id, date, description, net_amount, vat_rate, vat_amount, gross_amount, euer_line, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))`
      ).run(id, '2024-05-15', 'Income with null euer_line', 3000, 19, 570, 3570);

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.income[EUER_LINES.BETRIEBSEINNAHMEN]).toBeCloseTo(3000, 2);
    });

    it('handles many small income entries without precision loss', async () => {
      // 200 entries of €49.99 each
      for (let i = 0; i < 200; i++) {
        const month = String((i % 12) + 1).padStart(2, '0');
        const day = String((i % 28) + 1).padStart(2, '0');
        insertTestIncome(testDb, {
          date: `2024-${month}-${day}`,
          net_amount: 49.99,
          euer_line: EUER_LINES.BETRIEBSEINNAHMEN,
        });
      }

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // 200 × 49.99 = 9998.00
      expect(res.body.totalIncome).toBeCloseTo(9998, 1);
    });
  });

  // ==========================================================================
  // 2. Expense Calculations (deductible_percent)
  // ==========================================================================

  describe('Expense Calculations — deductible_percent', () => {
    it('includes 100% deductible expenses at full value', async () => {
      insertTestExpense(testDb, {
        date: '2024-02-15',
        net_amount: 2000,
        euer_line: EUER_LINES.FREMDLEISTUNGEN,
        deductible_percent: 100,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.FREMDLEISTUNGEN]).toBeCloseTo(2000, 2);
    });

    it('applies 50% deductible correctly (mixed-use asset)', async () => {
      // e.g., phone used 50% for business
      insertTestExpense(testDb, {
        date: '2024-03-10',
        net_amount: 1200,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 50,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(600, 2); // 1200 × 50%
    });

    it('excludes 0% deductible expenses entirely (non-deductible)', async () => {
      insertTestExpense(testDb, {
        date: '2024-04-10',
        net_amount: 5000,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 0,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // Line 34 (Sonstige) should be 0 or not set (only Homeoffice-Pauschale in total expenses)
      expect(res.body.expenses[EUER_LINES.SONSTIGE] ?? 0).toBe(0);
    });

    it('defaults NULL deductible_percent to 100% (full deduction)', async () => {
      // Insert expense with deductible_percent = NULL directly
      insertExpenseWithNullDeductible(testDb, {
        date: '2024-05-15',
        net_amount: 800,
        euer_line: EUER_LINES.SONSTIGE,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // NULL should default to 100% → full €800 counted
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(800, 2);
    });

    it('applies various deductible percentages to different expenses', async () => {
      // 100% deductible software subscription
      insertTestExpense(testDb, {
        date: '2024-01-15',
        net_amount: 500,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });

      // 70% deductible car expense
      insertTestExpense(testDb, {
        date: '2024-02-15',
        net_amount: 1000,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 70,
      });

      // 30% deductible phone plan
      insertTestExpense(testDb, {
        date: '2024-03-15',
        net_amount: 600,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 30,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // 500×1.0 + 1000×0.7 + 600×0.3 = 500 + 700 + 180 = 1380
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(1380, 2);
    });

    it('handles expenses across different EÜR lines with deductible percentages', async () => {
      // Fremdleistungen — 100%
      insertTestExpense(testDb, {
        date: '2024-06-01',
        net_amount: 3000,
        euer_line: EUER_LINES.FREMDLEISTUNGEN,
        deductible_percent: 100,
      });

      // Vorsteuer — 50% (mixed-use)
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 400,
        euer_line: EUER_LINES.VORSTEUER,
        deductible_percent: 50,
      });

      // Sonstige — 0% (not deductible)
      insertTestExpense(testDb, {
        date: '2024-07-01',
        net_amount: 2000,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 0,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.FREMDLEISTUNGEN]).toBeCloseTo(3000, 2);
      expect(res.body.expenses[EUER_LINES.VORSTEUER]).toBeCloseTo(200, 2); // 400 × 50%
      // Sonstige = 0 because 0% deductible
      expect(res.body.expenses[EUER_LINES.SONSTIGE] ?? 0).toBe(0);
    });

    it('excludes expenses from other years', async () => {
      insertTestExpense(testDb, {
        date: '2023-12-31',
        net_amount: 9999,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 1000,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });
      insertTestExpense(testDb, {
        date: '2025-01-01',
        net_amount: 8888,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(1000, 2);
    });
  });

  // ==========================================================================
  // 3. Profit (Gewinn) Calculation
  // ==========================================================================

  describe('Profit (Gewinn) Calculation', () => {
    it('calculates Gewinn = totalIncome - totalExpenses', async () => {
      insertTestIncome(testDb, { date: '2024-03-15', net_amount: 50000 });
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 15000,
        euer_line: EUER_LINES.FREMDLEISTUNGEN,
        deductible_percent: 100,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.gewinn).toBe(res.body.totalIncome - res.body.totalExpenses);
    });

    it('auto-adds Homeoffice-Pauschale (€1,260) when no Arbeitszimmer expense', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 40000 });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // Line 33 (Arbeitszimmer) = Homeoffice-Pauschale
      expect(res.body.expenses[EUER_LINES.ARBEITSZIMMER]).toBe(HOMEOFFICE_PAUSCHALE);
      expect(res.body.expenses[EUER_LINES.ARBEITSZIMMER]).toBe(1260);
      // Total expenses should include it
      expect(res.body.totalExpenses).toBeGreaterThanOrEqual(1260);
      // Gewinn = 40000 - 1260 = 38740
      expect(res.body.gewinn).toBeCloseTo(38740, 2);
    });

    it('does NOT add Homeoffice-Pauschale when actual Arbeitszimmer expenses exist', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 40000 });

      // Explicit home office expense (line 33)
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 3000,
        euer_line: EUER_LINES.ARBEITSZIMMER,
        deductible_percent: 100,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // Should use the actual expense, not the Pauschale
      expect(res.body.expenses[EUER_LINES.ARBEITSZIMMER]).toBeCloseTo(3000, 2);
      // Gewinn = 40000 - 3000
      expect(res.body.gewinn).toBeCloseTo(37000, 2);
    });

    it('calculates positive profit (income exceeds expenses)', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 60000 });
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 10000,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // Gewinn = 60000 - 10000 - 1260 (Homeoffice) = 48740
      expect(res.body.gewinn).toBeCloseTo(48740, 2);
      expect(res.body.gewinn).toBeGreaterThan(0);
    });

    it('calculates negative profit (expenses exceed income)', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 5000 });
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 20000,
        euer_line: EUER_LINES.FREMDLEISTUNGEN,
        deductible_percent: 100,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // Gewinn = 5000 - 20000 - 1260 = -16260
      expect(res.body.gewinn).toBeCloseTo(-16260, 2);
      expect(res.body.gewinn).toBeLessThan(0);
    });

    it('calculates negative Gewinn for empty year (only Homeoffice-Pauschale)', async () => {
      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBe(0);
      expect(res.body.totalExpenses).toBe(1260);
      expect(res.body.gewinn).toBe(-1260);
    });

    it('handles a realistic freelancer year with mixed deductibility', async () => {
      // Monthly income: roughly €5k/month
      const monthlyIncome = [4500, 5200, 4800, 6000, 5500, 5000, 4700, 5300, 5100, 5800, 4900, 6200];
      let expectedIncome = 0;

      for (let i = 0; i < 12; i++) {
        const month = String(i + 1).padStart(2, '0');
        insertTestIncome(testDb, {
          date: `2024-${month}-15`,
          net_amount: monthlyIncome[i],
          euer_line: EUER_LINES.BETRIEBSEINNAHMEN,
        });
        expectedIncome += monthlyIncome[i];
      }

      // Subcontractor: 100% deductible
      insertTestExpense(testDb, {
        date: '2024-03-01',
        net_amount: 8000,
        euer_line: EUER_LINES.FREMDLEISTUNGEN,
        deductible_percent: 100,
      });

      // Software/tools: 100% deductible
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 2400,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });

      // Phone plan: 60% business use
      insertTestExpense(testDb, {
        date: '2024-01-15',
        net_amount: 720,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 60,
      });

      // Coffee with client: not deductible (Bewirtung → 0%)
      insertTestExpense(testDb, {
        date: '2024-09-10',
        net_amount: 150,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 0,
      });

      const expectedExpenses =
        8000 * 1.0 + // Fremdleistungen
        2400 * 1.0 + // Software (Sonstige)
        720 * 0.6 +  // Phone (Sonstige, 60%)
        150 * 0.0 +  // Coffee (Sonstige, 0%)
        1260;         // Homeoffice-Pauschale

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBeCloseTo(expectedIncome, 0);
      expect(res.body.totalExpenses).toBeCloseTo(expectedExpenses, 0);
      expect(res.body.gewinn).toBeCloseTo(expectedIncome - expectedExpenses, 0);
    });

    it('includes AfA (depreciation) in Gewinn calculation', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 30000 });

      // Depreciation for a laptop: €333.33/year
      insertDepreciation(testDb, {
        year: 2024,
        depreciation_amount: 333.33,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // totalExpenses = AfA(333.33) + Homeoffice(1260)
      expect(res.body.totalExpenses).toBeCloseTo(333.33 + 1260, 1);
      expect(res.body.gewinn).toBeCloseTo(30000 - 333.33 - 1260, 1);
    });
  });

  // ==========================================================================
  // 4. EÜR Line Items
  // ==========================================================================

  describe('EÜR Line Items — EUER_LINES constants', () => {
    it('maps all EUER_LINES constants to correct line numbers', () => {
      // Verify constant values match the official EÜR form
      expect(EUER_LINES.BETRIEBSEINNAHMEN).toBe(14);
      expect(EUER_LINES.ENTNAHME_VERKAUF).toBe(16);
      expect(EUER_LINES.UST_ERSTATTUNG).toBe(18);
      expect(EUER_LINES.FREMDLEISTUNGEN).toBe(25);
      expect(EUER_LINES.VORSTEUER).toBe(27);
      expect(EUER_LINES.GEZAHLTE_UST).toBe(28);
      expect(EUER_LINES.AFA).toBe(30);
      expect(EUER_LINES.ARBEITSZIMMER).toBe(33);
      expect(EUER_LINES.SONSTIGE).toBe(34);
      expect(EUER_LINES.ANLAGENABGANG_VERLUST).toBe(35);
    });

    it('HOMEOFFICE_PAUSCHALE is €1,260', () => {
      expect(HOMEOFFICE_PAUSCHALE).toBe(1260);
    });

    it('aggregates multiple entries on the same EÜR line', async () => {
      // Three separate Fremdleistungen (line 25)
      insertTestExpense(testDb, { date: '2024-01-15', net_amount: 2000, euer_line: EUER_LINES.FREMDLEISTUNGEN, deductible_percent: 100 });
      insertTestExpense(testDb, { date: '2024-04-15', net_amount: 3000, euer_line: EUER_LINES.FREMDLEISTUNGEN, deductible_percent: 100 });
      insertTestExpense(testDb, { date: '2024-08-15', net_amount: 1500, euer_line: EUER_LINES.FREMDLEISTUNGEN, deductible_percent: 100 });

      // Two separate Sonstige (line 34)
      insertTestExpense(testDb, { date: '2024-02-15', net_amount: 500, euer_line: EUER_LINES.SONSTIGE, deductible_percent: 100 });
      insertTestExpense(testDb, { date: '2024-05-15', net_amount: 800, euer_line: EUER_LINES.SONSTIGE, deductible_percent: 100 });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.FREMDLEISTUNGEN]).toBeCloseTo(6500, 2); // 2000 + 3000 + 1500
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(1300, 2); // 500 + 800
    });

    it('aggregates multiple income entries on the same EÜR line', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 5000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });
      insertTestIncome(testDb, { date: '2024-03-15', net_amount: 7000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });
      insertTestIncome(testDb, { date: '2024-06-15', net_amount: 4000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.income[EUER_LINES.BETRIEBSEINNAHMEN]).toBeCloseTo(16000, 2);
    });

    it('returns empty lines as absent from response (not 0.00)', async () => {
      // Only add income — no expenses except auto Homeoffice-Pauschale
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 10000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);

      // Lines with no data should not appear
      expect(res.body.income[EUER_LINES.UST_ERSTATTUNG]).toBeUndefined();
      expect(res.body.income[EUER_LINES.ENTNAHME_VERKAUF]).toBeUndefined();
      expect(res.body.expenses[EUER_LINES.FREMDLEISTUNGEN]).toBeUndefined();
      expect(res.body.expenses[EUER_LINES.VORSTEUER]).toBeUndefined();
      expect(res.body.expenses[EUER_LINES.GEZAHLTE_UST]).toBeUndefined();
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeUndefined();
      expect(res.body.expenses[EUER_LINES.ANLAGENABGANG_VERLUST]).toBeUndefined();

      // Arbeitszimmer should exist (Homeoffice-Pauschale auto-added)
      expect(res.body.expenses[EUER_LINES.ARBEITSZIMMER]).toBe(1260);
    });

    it('includes AfA line (30) from depreciation schedule', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 20000 });

      // Two assets depreciating in 2024
      insertDepreciation(testDb, { year: 2024, depreciation_amount: 500 });
      insertDepreciation(testDb, { year: 2024, depreciation_amount: 300 });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.AFA]).toBeCloseTo(800, 2); // 500 + 300
    });

    it('separates income lines and expense lines correctly', async () => {
      // Income on multiple lines
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 40000, euer_line: EUER_LINES.BETRIEBSEINNAHMEN });
      insertTestIncome(testDb, { date: '2024-06-15', net_amount: 800, euer_line: EUER_LINES.UST_ERSTATTUNG });

      // Expenses on multiple lines
      insertTestExpense(testDb, { date: '2024-02-10', net_amount: 5000, euer_line: EUER_LINES.FREMDLEISTUNGEN, deductible_percent: 100 });
      insertTestExpense(testDb, { date: '2024-03-10', net_amount: 400, euer_line: EUER_LINES.VORSTEUER, deductible_percent: 100 });
      insertTestExpense(testDb, { date: '2024-04-10', net_amount: 1200, euer_line: EUER_LINES.GEZAHLTE_UST, deductible_percent: 100 });
      insertTestExpense(testDb, { date: '2024-05-10', net_amount: 600, euer_line: EUER_LINES.SONSTIGE, deductible_percent: 100 });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);

      // Income lines
      expect(res.body.income[EUER_LINES.BETRIEBSEINNAHMEN]).toBeCloseTo(40000, 2);
      expect(res.body.income[EUER_LINES.UST_ERSTATTUNG]).toBeCloseTo(800, 2);

      // Expense lines
      expect(res.body.expenses[EUER_LINES.FREMDLEISTUNGEN]).toBeCloseTo(5000, 2);
      expect(res.body.expenses[EUER_LINES.VORSTEUER]).toBeCloseTo(400, 2);
      expect(res.body.expenses[EUER_LINES.GEZAHLTE_UST]).toBeCloseTo(1200, 2);
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(600, 2);
      expect(res.body.expenses[EUER_LINES.ARBEITSZIMMER]).toBe(1260); // Auto-added Pauschale

      // Totals
      expect(res.body.totalIncome).toBeCloseTo(40800, 2);
      // 5000 + 400 + 1200 + 600 + 1260 = 8460
      expect(res.body.totalExpenses).toBeCloseTo(8460, 2);
      expect(res.body.gewinn).toBeCloseTo(32340, 2);
    });

    it('returns correct response structure', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 10000 });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('year', 2024);
      expect(res.body).toHaveProperty('income');
      expect(res.body).toHaveProperty('expenses');
      expect(res.body).toHaveProperty('totalIncome');
      expect(res.body).toHaveProperty('totalExpenses');
      expect(res.body).toHaveProperty('gewinn');

      // income and expenses should be objects (line → amount maps)
      expect(typeof res.body.income).toBe('object');
      expect(typeof res.body.expenses).toBe('object');
    });
  });

  // ==========================================================================
  // 5. EÜR Lines Reference Endpoint
  // ==========================================================================

  describe('GET /api/reports/euer-lines', () => {
    it('returns income and expense line definitions', async () => {
      const res = await request(app).get('/api/reports/euer-lines');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('income');
      expect(res.body).toHaveProperty('expenses');
      expect(Array.isArray(res.body.income)).toBe(true);
      expect(Array.isArray(res.body.expenses)).toBe(true);
    });

    it('includes all income lines with correct numbers', async () => {
      const res = await request(app).get('/api/reports/euer-lines');

      const incomeLines = res.body.income as Array<{ line: number; name: string }>;
      const lineNumbers = incomeLines.map((l) => l.line);

      expect(lineNumbers).toContain(EUER_LINES.BETRIEBSEINNAHMEN); // 14
      expect(lineNumbers).toContain(EUER_LINES.ENTNAHME_VERKAUF); // 16
      expect(lineNumbers).toContain(EUER_LINES.UST_ERSTATTUNG); // 18
    });

    it('includes all expense lines with correct numbers', async () => {
      const res = await request(app).get('/api/reports/euer-lines');

      const expenseLines = res.body.expenses as Array<{ line: number; name: string }>;
      const lineNumbers = expenseLines.map((l) => l.line);

      expect(lineNumbers).toContain(EUER_LINES.FREMDLEISTUNGEN); // 25
      expect(lineNumbers).toContain(EUER_LINES.VORSTEUER); // 27
      expect(lineNumbers).toContain(EUER_LINES.GEZAHLTE_UST); // 28
      expect(lineNumbers).toContain(EUER_LINES.AFA); // 30
      expect(lineNumbers).toContain(EUER_LINES.ARBEITSZIMMER); // 33
      expect(lineNumbers).toContain(EUER_LINES.SONSTIGE); // 34
      expect(lineNumbers).toContain(EUER_LINES.ANLAGENABGANG_VERLUST); // 35
    });

    it('has correct names for each line', async () => {
      const res = await request(app).get('/api/reports/euer-lines');

      const allLines = [...res.body.income, ...res.body.expenses] as Array<{ line: number; name: string }>;
      const findLine = (num: number) => allLines.find((l) => l.line === num);

      expect(findLine(14)?.name).toBe('Betriebseinnahmen');
      expect(findLine(16)?.name).toBe('Veräußerungsgewinne');
      expect(findLine(18)?.name).toBe('USt-Erstattung');
      expect(findLine(25)?.name).toBe('Fremdleistungen');
      expect(findLine(27)?.name).toBe('Vorsteuer');
      expect(findLine(28)?.name).toBe('Gezahlte USt');
      expect(findLine(30)?.name).toBe('AfA');
      expect(findLine(33)?.name).toBe('Arbeitszimmer');
      expect(findLine(34)?.name).toBe('Sonstige');
      expect(findLine(35)?.name).toBe('Anlagenabgang (Verlust)');
    });

    it('each line has a description', async () => {
      const res = await request(app).get('/api/reports/euer-lines');

      const allLines = [...res.body.income, ...res.body.expenses] as Array<{ line: number; name: string; description: string }>;
      for (const line of allLines) {
        expect(line.description).toBeDefined();
        expect(typeof line.description).toBe('string');
        expect(line.description.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // 6. Validation & Edge Cases
  // ==========================================================================

  describe('Validation & Edge Cases', () => {
    it('rejects invalid year', async () => {
      const res = await request(app).get('/api/reports/euer/invalid');
      expect(res.status).toBe(400);
    });

    it('handles year with zero income but real expenses', async () => {
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 5000,
        euer_line: EUER_LINES.FREMDLEISTUNGEN,
        deductible_percent: 100,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBe(0);
      // 5000 (Fremdleistungen) + 1260 (Homeoffice)
      expect(res.body.totalExpenses).toBeCloseTo(6260, 2);
      expect(res.body.gewinn).toBeCloseTo(-6260, 2);
    });

    it('handles rounding for cent-precise deductible amounts', async () => {
      // 33.33% deductible of €100 = €33.33
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 100,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 33.33,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // 100 × 33.33% = 33.33
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(33.33, 2);
    });

    it('handles expenses with very small amounts', async () => {
      insertTestExpense(testDb, {
        date: '2024-03-15',
        net_amount: 0.01,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(0.01, 2);
    });

    it('all monetary values are rounded to 2 decimal places', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 1000.555 });
      insertTestExpense(testDb, {
        date: '2024-02-15',
        net_amount: 333.333,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);

      // Check all values have at most 2 decimal places
      const checkDecimals = (val: number) => {
        const str = val.toString();
        const decimalPart = str.includes('.') ? str.split('.')[1] : '';
        expect(decimalPart.length).toBeLessThanOrEqual(2);
      };

      checkDecimals(res.body.totalIncome);
      checkDecimals(res.body.totalExpenses);
      checkDecimals(res.body.gewinn);
    });

    it('correctly combines depreciation with regular expenses on line 30', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 50000 });

      // Depreciation from asset schedule
      insertDepreciation(testDb, { year: 2024, depreciation_amount: 1000 });

      // Manual AfA expense (shouldn't happen normally, but test aggregation)
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 200,
        euer_line: EUER_LINES.AFA,
        deductible_percent: 100,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // Line 30 = depreciation (1000) + manual expense (200)
      expect(res.body.expenses[EUER_LINES.AFA]).toBeCloseTo(1200, 2);
    });

    it('handles depreciation from multiple assets', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 50000 });

      // Laptop depreciation
      insertDepreciation(testDb, {
        asset_id: 'asset-laptop',
        year: 2024,
        depreciation_amount: 333.33,
      });

      // Monitor depreciation
      insertDepreciation(testDb, {
        asset_id: 'asset-monitor',
        year: 2024,
        depreciation_amount: 166.67,
      });

      // Chair depreciation
      insertDepreciation(testDb, {
        asset_id: 'asset-chair',
        year: 2024,
        depreciation_amount: 100,
      });

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      // Total AfA = 333.33 + 166.67 + 100 = 600
      expect(res.body.expenses[EUER_LINES.AFA]).toBeCloseTo(600, 2);
    });

    it('does not include depreciation from other years', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 50000 });

      const assetId = 'asset-multi-year';
      // Ensure asset exists
      testDb.prepare(
        `INSERT INTO assets (id, name, purchase_date, purchase_price, useful_life_years, depreciation_method, salvage_value, current_value, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(assetId, 'Multi-year Asset', '2023-01-01', 3000, 3, 'linear', 0, 3000, 'equipment');

      // 2023 depreciation — should be excluded
      testDb.prepare(
        `INSERT INTO depreciation_schedule (id, asset_id, year, depreciation_amount, accumulated_depreciation, book_value)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(testId('dep'), assetId, 2023, 1000, 1000, 2000);

      // 2024 depreciation — should be included
      testDb.prepare(
        `INSERT INTO depreciation_schedule (id, asset_id, year, depreciation_amount, accumulated_depreciation, book_value)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(testId('dep'), assetId, 2024, 1000, 2000, 1000);

      // 2025 depreciation — should be excluded
      testDb.prepare(
        `INSERT INTO depreciation_schedule (id, asset_id, year, depreciation_amount, accumulated_depreciation, book_value)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(testId('dep'), assetId, 2025, 1000, 3000, 0);

      const res = await getEuerReport(2024);

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.AFA]).toBeCloseTo(1000, 2);
    });
  });
});
