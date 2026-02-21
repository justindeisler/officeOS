/**
 * Reports API Route Tests — Comprehensive Suite
 *
 * CRITICAL: Tests tax calculation accuracy for German freelancer accounting.
 * - USt-Voranmeldung (quarterly VAT declaration)
 * - EÜR (Einnahmenüberschussrechnung — annual profit calculation)
 * - EÜR Lines reference endpoint
 *
 * These calculations directly affect tax filings. Errors here = real money mistakes.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestIncome,
  insertTestExpense,
  insertTestAsset,
  insertTestDepreciation,
  testId,
} from '../../test/setup.js';
import { EUER_LINES, HOMEOFFICE_PAUSCHALE } from '../../constants/euer.js';

// ============================================================================
// Setup — use the setupDbMock pattern from setup.ts
// ============================================================================

let testDb: Database.Database;

// vi.mock in setup.ts (setupDbMock) is hoisted automatically for '../database.js'
// which resolves to src/database.ts. We use the __setTestDb helper it provides.

import { createTestApp } from '../../test/app.js';
import reportsRouter from '../reports.js';
import request from 'supertest';

const app = createTestApp(reportsRouter, '/api/reports');

// ============================================================================
// Helper to insert depreciation records (with valid FK to asset)
// ============================================================================

function insertDepreciationWithAsset(
  db: Database.Database,
  overrides: {
    year: number;
    depreciation_amount: number;
    accumulated_depreciation?: number;
    book_value?: number;
    purchase_price?: number;
  }
) {
  const assetId = insertTestAsset(db, {
    purchase_date: `${overrides.year}-01-01`,
    purchase_price: overrides.purchase_price ?? overrides.depreciation_amount * 3,
  });

  const depId = insertTestDepreciation(db, {
    asset_id: assetId,
    year: overrides.year,
    depreciation_amount: overrides.depreciation_amount,
    accumulated_depreciation: overrides.accumulated_depreciation,
    book_value: overrides.book_value,
  });

  return { assetId, depId };
}

// ============================================================================
// Tests
// ============================================================================

describe('Reports API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    // Use the __setTestDb helper exposed by setup.ts's hoisted vi.mock
    const dbModule = await import('../../database.js') as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // USt quarterly reports
  // ==========================================================================

  describe('GET /api/reports/ust/:year/:quarter', () => {
    it('returns correct VAT calculation for Q1 with 19% income', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 5000,
        vat_rate: 19,
        vat_amount: 950,
        gross_amount: 5950,
      });
      insertTestIncome(testDb, {
        date: '2024-02-20',
        net_amount: 3000,
        vat_rate: 19,
        vat_amount: 570,
        gross_amount: 3570,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);
      expect(res.body.quarter).toBe(1);
      expect(res.body.umsatzsteuer19).toBeCloseTo(1520, 2);
      expect(res.body.umsatzsteuer7).toBe(0);
      expect(res.body.totalUmsatzsteuer).toBeCloseTo(1520, 2);
    });

    it('separates 19% and 7% VAT correctly', async () => {
      insertTestIncome(testDb, {
        date: '2024-04-15',
        net_amount: 10000,
        vat_rate: 19,
        vat_amount: 1900,
        gross_amount: 11900,
      });
      insertTestIncome(testDb, {
        date: '2024-05-10',
        net_amount: 2000,
        vat_rate: 7,
        vat_amount: 140,
        gross_amount: 2140,
      });

      const res = await request(app).get('/api/reports/ust/2024/2');

      expect(res.status).toBe(200);
      expect(res.body.umsatzsteuer19).toBeCloseTo(1900, 2);
      expect(res.body.umsatzsteuer7).toBeCloseTo(140, 2);
      expect(res.body.totalUmsatzsteuer).toBeCloseTo(2040, 2);
    });

    it('calculates Vorsteuer from all expenses in the period', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 5000,
        vat_rate: 19,
        vat_amount: 950,
      });
      insertTestExpense(testDb, {
        date: '2024-02-10',
        net_amount: 1000,
        vat_rate: 19,
        vat_amount: 190,
        gross_amount: 1190,
      });
      insertTestExpense(testDb, {
        date: '2024-03-10',
        net_amount: 500,
        vat_rate: 19,
        vat_amount: 95,
        gross_amount: 595,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.status).toBe(200);
      expect(res.body.totalUmsatzsteuer).toBeCloseTo(950, 2);
      expect(res.body.vorsteuer).toBeCloseTo(285, 2);
      expect(res.body.zahllast).toBeCloseTo(665, 2);
    });

    it('calculates Zahllast correctly (positive = owe money)', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 10000,
        vat_rate: 19,
        vat_amount: 1900,
      });
      insertTestExpense(testDb, {
        date: '2024-02-01',
        net_amount: 2000,
        vat_rate: 19,
        vat_amount: 380,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.body.zahllast).toBeCloseTo(1520, 2);
      expect(res.body.zahllast).toBeGreaterThan(0);
    });

    it('calculates negative Zahllast (refund) when Vorsteuer > Umsatzsteuer', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 1000,
        vat_rate: 19,
        vat_amount: 190,
      });
      insertTestExpense(testDb, {
        date: '2024-02-01',
        net_amount: 5000,
        vat_rate: 19,
        vat_amount: 950,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.body.zahllast).toBeCloseTo(-760, 2);
      expect(res.body.zahllast).toBeLessThan(0);
    });

    it('returns zeros when no data exists for the quarter', async () => {
      const res = await request(app).get('/api/reports/ust/2024/3');

      expect(res.status).toBe(200);
      expect(res.body.umsatzsteuer19).toBe(0);
      expect(res.body.umsatzsteuer7).toBe(0);
      expect(res.body.totalUmsatzsteuer).toBe(0);
      expect(res.body.vorsteuer).toBe(0);
      expect(res.body.zahllast).toBe(0);
    });

    it('correctly assigns records to quarters by boundary dates', async () => {
      insertTestIncome(testDb, { date: '2024-03-31', vat_rate: 19, vat_amount: 100 });
      insertTestIncome(testDb, { date: '2024-04-01', vat_rate: 19, vat_amount: 200 });
      insertTestIncome(testDb, { date: '2024-09-30', vat_rate: 19, vat_amount: 300 });
      insertTestIncome(testDb, { date: '2024-12-31', vat_rate: 19, vat_amount: 400 });

      const q1 = await request(app).get('/api/reports/ust/2024/1');
      const q2 = await request(app).get('/api/reports/ust/2024/2');
      const q3 = await request(app).get('/api/reports/ust/2024/3');
      const q4 = await request(app).get('/api/reports/ust/2024/4');

      expect(q1.body.totalUmsatzsteuer).toBeCloseTo(100, 2);
      expect(q2.body.totalUmsatzsteuer).toBeCloseTo(200, 2);
      expect(q3.body.totalUmsatzsteuer).toBeCloseTo(300, 2);
      expect(q4.body.totalUmsatzsteuer).toBeCloseTo(400, 2);
    });

    it('rejects invalid quarter numbers', async () => {
      const res0 = await request(app).get('/api/reports/ust/2024/0');
      const res5 = await request(app).get('/api/reports/ust/2024/5');

      expect(res0.status).toBe(400);
      expect(res5.status).toBe(400);
    });

    it('rejects invalid year', async () => {
      const res = await request(app).get('/api/reports/ust/invalid/1');
      expect(res.status).toBe(400);
    });

    it('handles rounding correctly for many small transactions', async () => {
      for (let i = 0; i < 100; i++) {
        const day = String((i % 28) + 1).padStart(2, '0');
        const month = String((i % 3) + 1).padStart(2, '0');
        insertTestIncome(testDb, {
          date: `2024-${month}-${day}`,
          net_amount: 10,
          vat_rate: 19,
          vat_amount: 1.90,
          gross_amount: 11.90,
        });
      }

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.body.umsatzsteuer19).toBeCloseTo(190, 1);
    });

    it('handles mixed 19% and 7% income with expenses in same quarter', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-10',
        net_amount: 5000,
        vat_rate: 19,
        vat_amount: 950,
      });
      insertTestIncome(testDb, {
        date: '2024-02-15',
        net_amount: 3000,
        vat_rate: 7,
        vat_amount: 210,
      });
      insertTestExpense(testDb, {
        date: '2024-03-01',
        net_amount: 2000,
        vat_rate: 19,
        vat_amount: 380,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.body.umsatzsteuer19).toBeCloseTo(950, 2);
      expect(res.body.umsatzsteuer7).toBeCloseTo(210, 2);
      expect(res.body.totalUmsatzsteuer).toBeCloseTo(1160, 2);
      expect(res.body.vorsteuer).toBeCloseTo(380, 2);
      expect(res.body.zahllast).toBeCloseTo(780, 2);
    });

    it('includes 0% VAT income without affecting VAT totals', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 5000,
        vat_rate: 0,
        vat_amount: 0,
        gross_amount: 5000,
      });
      insertTestIncome(testDb, {
        date: '2024-02-15',
        net_amount: 1000,
        vat_rate: 19,
        vat_amount: 190,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.body.umsatzsteuer19).toBeCloseTo(190, 2);
      expect(res.body.umsatzsteuer7).toBe(0);
      expect(res.body.totalUmsatzsteuer).toBeCloseTo(190, 2);
    });

    it('expenses with 7% VAT contribute to Vorsteuer', async () => {
      insertTestExpense(testDb, {
        date: '2024-01-15',
        net_amount: 100,
        vat_rate: 7,
        vat_amount: 7,
        gross_amount: 107,
      });
      insertTestExpense(testDb, {
        date: '2024-02-15',
        net_amount: 200,
        vat_rate: 19,
        vat_amount: 38,
        gross_amount: 238,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.body.vorsteuer).toBeCloseTo(45, 2);
    });

    it('expenses with 0% VAT do not add to Vorsteuer', async () => {
      insertTestExpense(testDb, {
        date: '2024-01-15',
        net_amount: 1000,
        vat_rate: 0,
        vat_amount: 0,
        gross_amount: 1000,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.body.vorsteuer).toBe(0);
    });

    it('does not cross year boundaries', async () => {
      insertTestIncome(testDb, {
        date: '2023-12-31',
        net_amount: 5000,
        vat_rate: 19,
        vat_amount: 950,
      });
      insertTestIncome(testDb, {
        date: '2025-01-01',
        net_amount: 3000,
        vat_rate: 19,
        vat_amount: 570,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.body.totalUmsatzsteuer).toBe(0);
    });

    it('returns correct period metadata', async () => {
      const res = await request(app).get('/api/reports/ust/2024/2');

      expect(res.body.period).toBe('2024-Q2');
      expect(res.body.year).toBe(2024);
      expect(res.body.quarter).toBe(2);
      expect(res.body.status).toBe('draft');
    });

    it('handles single expense with no income (full refund scenario)', async () => {
      insertTestExpense(testDb, {
        date: '2024-07-15',
        net_amount: 10000,
        vat_rate: 19,
        vat_amount: 1900,
      });

      const res = await request(app).get('/api/reports/ust/2024/3');

      expect(res.body.totalUmsatzsteuer).toBe(0);
      expect(res.body.vorsteuer).toBeCloseTo(1900, 2);
      expect(res.body.zahllast).toBeCloseTo(-1900, 2);
    });

    it('handles fractional cent amounts (€0.01 precision)', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-01',
        net_amount: 33.33,
        vat_rate: 19,
        vat_amount: 6.33,
        gross_amount: 39.66,
      });
      insertTestIncome(testDb, {
        date: '2024-01-02',
        net_amount: 33.33,
        vat_rate: 19,
        vat_amount: 6.33,
        gross_amount: 39.66,
      });
      insertTestIncome(testDb, {
        date: '2024-01-03',
        net_amount: 33.34,
        vat_rate: 19,
        vat_amount: 6.34,
        gross_amount: 39.68,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.body.umsatzsteuer19).toBeCloseTo(19.00, 2);
    });
  });

  // ==========================================================================
  // EÜR Report Tests (Annual Profit Calculation)
  // ==========================================================================

  describe('GET /api/reports/euer/:year', () => {
    it('calculates basic EÜR report correctly', async () => {
      insertTestIncome(testDb, {
        date: '2024-03-15',
        net_amount: 5000,
        euer_line: EUER_LINES.BETRIEBSEINNAHMEN,
      });
      insertTestIncome(testDb, {
        date: '2024-06-15',
        net_amount: 8000,
        euer_line: EUER_LINES.BETRIEBSEINNAHMEN,
      });
      insertTestExpense(testDb, {
        date: '2024-04-10',
        net_amount: 1000,
        euer_line: EUER_LINES.VORSTEUER,
        deductible_percent: 100,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);
      expect(res.body.totalIncome).toBeCloseTo(13000, 2);
      // totalExpenses: only the explicit expense (Homeoffice not enabled by default)
      expect(res.body.totalExpenses).toBeCloseTo(1000, 2);
    });

    it('groups income by EÜR line number', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 5000,
        euer_line: EUER_LINES.BETRIEBSEINNAHMEN,
      });
      insertTestIncome(testDb, {
        date: '2024-06-15',
        net_amount: 3000,
        euer_line: EUER_LINES.BETRIEBSEINNAHMEN,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.income[EUER_LINES.BETRIEBSEINNAHMEN]).toBeCloseTo(8000, 2);
    });

    it('groups expenses by EÜR line number', async () => {
      insertTestExpense(testDb, {
        date: '2024-02-10',
        net_amount: 500,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });
      insertTestExpense(testDb, {
        date: '2024-05-10',
        net_amount: 700,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });
      insertTestExpense(testDb, {
        date: '2024-03-10',
        net_amount: 2000,
        euer_line: EUER_LINES.FREMDLEISTUNGEN,
        deductible_percent: 100,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(1200, 2);
      expect(res.body.expenses[EUER_LINES.FREMDLEISTUNGEN]).toBeCloseTo(2000, 2);
    });

    it('applies deductible percentage to expenses', async () => {
      insertTestExpense(testDb, {
        date: '2024-01-15',
        net_amount: 1000,
        euer_line: EUER_LINES.VORSTEUER,
        deductible_percent: 50,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.VORSTEUER]).toBeCloseTo(500, 2);
    });

    it('includes Homeoffice-Pauschale (€1,260) when enabled in settings and no Arbeitszimmer expense exists', async () => {
      testDb.prepare("INSERT INTO settings (key, value) VALUES ('homeoffice_enabled', 'true')").run();
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 50000,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.ARBEITSZIMMER]).toBe(HOMEOFFICE_PAUSCHALE);
    });

    it('does NOT include Homeoffice-Pauschale when not enabled in settings', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 50000,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.ARBEITSZIMMER]).toBeUndefined();
    });

    it('does NOT add Homeoffice-Pauschale when Arbeitszimmer expense already exists', async () => {
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 2000,
        euer_line: EUER_LINES.ARBEITSZIMMER,
        deductible_percent: 100,
      });
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 50000 });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      // Existing Arbeitszimmer expense should be used, not Pauschale
      expect(res.body.expenses[EUER_LINES.ARBEITSZIMMER]).toBeCloseTo(2000, 2);
    });

    it('includes AfA (depreciation) from depreciation schedule', async () => {
      insertDepreciationWithAsset(testDb, {
        year: 2024,
        depreciation_amount: 800,
      });
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 5000 });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.expenses[EUER_LINES.AFA]).toBeCloseTo(800, 2);
    });

    it('sums AfA from multiple assets', async () => {
      insertDepreciationWithAsset(testDb, {
        year: 2024,
        depreciation_amount: 500,
      });
      insertDepreciationWithAsset(testDb, {
        year: 2024,
        depreciation_amount: 300,
      });
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 10000 });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.body.expenses[EUER_LINES.AFA]).toBeCloseTo(800, 2);
    });

    it('combines AfA from depreciation schedule with AfA expense line', async () => {
      insertDepreciationWithAsset(testDb, {
        year: 2024,
        depreciation_amount: 500,
      });
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 200,
        euer_line: EUER_LINES.AFA,
        deductible_percent: 100,
      });
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 10000 });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.body.expenses[EUER_LINES.AFA]).toBeCloseTo(700, 2);
    });

    it('calculates profit (Gewinn) correctly', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 50000 });
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 10000,
        euer_line: EUER_LINES.VORSTEUER,
        deductible_percent: 100,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.gewinn).toBe(res.body.totalIncome - res.body.totalExpenses);
    });

    it('only includes records from the specified year', async () => {
      insertTestIncome(testDb, { date: '2023-12-31', net_amount: 9999 });
      insertTestIncome(testDb, { date: '2024-01-01', net_amount: 5000 });
      insertTestIncome(testDb, { date: '2025-01-01', net_amount: 8888 });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBeCloseTo(5000, 2);
    });

    it('handles year with no income or expenses (empty report)', async () => {
      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBe(0);
      // Homeoffice not enabled by default → no expenses
      expect(res.body.totalExpenses).toBe(0);
      expect(res.body.gewinn).toBe(0);
    });

    it('rejects invalid year', async () => {
      const res = await request(app).get('/api/reports/euer/invalid');
      expect(res.status).toBe(400);
    });

    it('handles a realistic freelancer year correctly', async () => {
      const months = [
        { income: 4500, expense: 800 },
        { income: 5000, expense: 600 },
        { income: 4800, expense: 750 },
        { income: 5200, expense: 900 },
        { income: 4000, expense: 500 },
        { income: 5500, expense: 1200 },
        { income: 4700, expense: 650 },
        { income: 5100, expense: 800 },
        { income: 4900, expense: 700 },
        { income: 5300, expense: 950 },
        { income: 4600, expense: 600 },
        { income: 5400, expense: 1100 },
      ];

      let totalIncomeExpected = 0;
      let totalExpensesExpected = 0;

      months.forEach((m, i) => {
        const month = String(i + 1).padStart(2, '0');
        insertTestIncome(testDb, {
          date: `2024-${month}-15`,
          net_amount: m.income,
          euer_line: EUER_LINES.BETRIEBSEINNAHMEN,
        });
        insertTestExpense(testDb, {
          date: `2024-${month}-20`,
          net_amount: m.expense,
          euer_line: EUER_LINES.VORSTEUER,
          deductible_percent: 100,
        });
        totalIncomeExpected += m.income;
        totalExpensesExpected += m.expense;
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBeCloseTo(totalIncomeExpected, 0);
      // Homeoffice not enabled → no Pauschale
      expect(res.body.totalExpenses).toBeCloseTo(totalExpensesExpected, 0);
      expect(res.body.gewinn).toBeCloseTo(
        totalIncomeExpected - totalExpensesExpected,
        0
      );
    });

    it('applies 0% deductible (non-deductible expense)', async () => {
      insertTestExpense(testDb, {
        date: '2024-03-15',
        net_amount: 5000,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 0,
      });
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 10000 });

      const res = await request(app).get('/api/reports/euer/2024');

      // Sonstige should be 0 because 0% deductible
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBe(0);
    });

    it('applies partial deductible correctly to multiple expenses on same line', async () => {
      insertTestExpense(testDb, {
        date: '2024-01-15',
        net_amount: 1000,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 75,
      });
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 2000,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 50,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      // 1000 * 0.75 + 2000 * 0.50 = 750 + 1000 = 1750
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(1750, 2);
    });

    it('income with no euer_line defaults to BETRIEBSEINNAHMEN (line 14)', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 3000,
        // euer_line defaults to 14 in insertTestIncome
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.body.income[EUER_LINES.BETRIEBSEINNAHMEN]).toBeCloseTo(3000, 2);
    });

    it('handles USt-Erstattung income line correctly', async () => {
      insertTestIncome(testDb, {
        date: '2024-06-15',
        net_amount: 500,
        vat_rate: 0,
        vat_amount: 0,
        gross_amount: 500,
        euer_line: EUER_LINES.UST_ERSTATTUNG,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.body.income[EUER_LINES.UST_ERSTATTUNG]).toBeCloseTo(500, 2);
    });

    it('handles Veräußerungsgewinne (asset sale) income line', async () => {
      insertTestIncome(testDb, {
        date: '2024-09-15',
        net_amount: 2000,
        vat_rate: 0,
        vat_amount: 0,
        gross_amount: 2000,
        euer_line: EUER_LINES.ENTNAHME_VERKAUF,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.body.income[EUER_LINES.ENTNAHME_VERKAUF]).toBeCloseTo(2000, 2);
    });

    it('handles all expense line types simultaneously', async () => {
      const expenseLines = [
        { line: EUER_LINES.FREMDLEISTUNGEN, amount: 1000 },
        { line: EUER_LINES.VORSTEUER, amount: 500 },
        { line: EUER_LINES.GEZAHLTE_UST, amount: 300 },
        { line: EUER_LINES.SONSTIGE, amount: 200 },
      ];

      for (const { line, amount } of expenseLines) {
        insertTestExpense(testDb, {
          date: '2024-06-15',
          net_amount: amount,
          euer_line: line,
          deductible_percent: 100,
        });
      }
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 50000 });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.body.expenses[EUER_LINES.FREMDLEISTUNGEN]).toBeCloseTo(1000, 2);
      expect(res.body.expenses[EUER_LINES.VORSTEUER]).toBeCloseTo(500, 2);
      expect(res.body.expenses[EUER_LINES.GEZAHLTE_UST]).toBeCloseTo(300, 2);
      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(200, 2);
    });

    it('handles loss year correctly (negative Gewinn)', async () => {
      insertTestIncome(testDb, { date: '2024-06-15', net_amount: 5000 });
      insertTestExpense(testDb, {
        date: '2024-01-15',
        net_amount: 10000,
        euer_line: EUER_LINES.FREMDLEISTUNGEN,
        deductible_percent: 100,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.body.gewinn).toBeLessThan(0);
    });

    it('handles expenses without explicit deductible_percent (defaults to 100%)', async () => {
      // The insertTestExpense default for deductible_percent is 100
      insertTestExpense(testDb, {
        date: '2024-01-15',
        net_amount: 2000,
        euer_line: EUER_LINES.SONSTIGE,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(2000, 2);
    });
  });

  // ==========================================================================
  // EÜR Lines Reference
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

    it('includes Betriebseinnahmen line 14', async () => {
      const res = await request(app).get('/api/reports/euer-lines');
      const line14 = res.body.income.find((l: { line: number }) => l.line === EUER_LINES.BETRIEBSEINNAHMEN);
      expect(line14).toBeDefined();
      expect(line14.name).toBe('Betriebseinnahmen');
    });

    it('includes AfA line 30', async () => {
      const res = await request(app).get('/api/reports/euer-lines');
      const line30 = res.body.expenses.find((l: { line: number }) => l.line === EUER_LINES.AFA);
      expect(line30).toBeDefined();
      expect(line30.name).toBe('AfA');
    });

    it('includes Arbeitszimmer line 33', async () => {
      const res = await request(app).get('/api/reports/euer-lines');
      const line33 = res.body.expenses.find((l: { line: number }) => l.line === EUER_LINES.ARBEITSZIMMER);
      expect(line33).toBeDefined();
      expect(line33.name).toBe('Arbeitszimmer');
    });

    it('includes all required income lines', async () => {
      const res = await request(app).get('/api/reports/euer-lines');
      const incomeLines = res.body.income.map((l: { line: number }) => l.line);

      expect(incomeLines).toContain(EUER_LINES.BETRIEBSEINNAHMEN);
      expect(incomeLines).toContain(EUER_LINES.ENTNAHME_VERKAUF);
      expect(incomeLines).toContain(EUER_LINES.UST_ERSTATTUNG);
    });

    it('includes all required expense lines', async () => {
      const res = await request(app).get('/api/reports/euer-lines');
      const expenseLines = res.body.expenses.map((l: { line: number }) => l.line);

      expect(expenseLines).toContain(EUER_LINES.FREMDLEISTUNGEN);
      expect(expenseLines).toContain(EUER_LINES.VORSTEUER);
      expect(expenseLines).toContain(EUER_LINES.GEZAHLTE_UST);
      expect(expenseLines).toContain(EUER_LINES.AFA);
      expect(expenseLines).toContain(EUER_LINES.ARBEITSZIMMER);
      expect(expenseLines).toContain(EUER_LINES.SONSTIGE);
      expect(expenseLines).toContain(EUER_LINES.ANLAGENABGANG_VERLUST);
    });

    it('each line has name and description', async () => {
      const res = await request(app).get('/api/reports/euer-lines');

      for (const line of [...res.body.income, ...res.body.expenses]) {
        expect(line).toHaveProperty('line');
        expect(line).toHaveProperty('name');
        expect(line).toHaveProperty('description');
        expect(typeof line.line).toBe('number');
        expect(typeof line.name).toBe('string');
        expect(typeof line.description).toBe('string');
        expect(line.name.length).toBeGreaterThan(0);
      }
    });
  });
});
