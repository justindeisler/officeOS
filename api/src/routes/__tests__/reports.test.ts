/**
 * Reports API Route Tests
 *
 * CRITICAL: Tests tax calculation accuracy for German freelancer accounting.
 * - USt-Voranmeldung (quarterly VAT declaration)
 * - EÜR (Einnahmenüberschussrechnung - annual profit calculation)
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
  testId,
} from '../../test/setup.js';

// ============================================================================
// Setup
// ============================================================================

let testDb: Database.Database;

vi.mock('../database.js', () => {
  return {
    getDb: () => {
      if (!testDb) throw new Error('Test DB not initialized');
      return testDb;
    },
    generateId: () => crypto.randomUUID(),
    getCurrentTimestamp: () => new Date().toISOString(),
  };
});

import { createTestApp } from '../../test/app.js';
import reportsRouter from '../reports.js';
import request from 'supertest';

const app = createTestApp(reportsRouter, '/api/reports');

// ============================================================================
// Helper to insert depreciation records
// ============================================================================

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
  const id = testId('dep');
  db.prepare(
    `INSERT INTO depreciation_schedule (id, asset_id, year, depreciation_amount, accumulated_depreciation, book_value)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    overrides.asset_id ?? testId('asset'),
    overrides.year,
    overrides.depreciation_amount,
    overrides.accumulated_depreciation ?? overrides.depreciation_amount,
    overrides.book_value ?? 0
  );
  return id;
}

// ============================================================================
// USt-Voranmeldung Tests (Quarterly VAT)
// ============================================================================

describe('Reports API', () => {
  beforeEach(() => {
    testDb = createTestDb();
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  describe('GET /api/reports/ust/:year/:quarter', () => {
    it('returns correct VAT calculation for Q1 with 19% income', async () => {
      // Insert income records for Q1 2024
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
      expect(res.body.umsatzsteuer19).toBeCloseTo(1520, 2); // 950 + 570
      expect(res.body.umsatzsteuer7).toBe(0);
      expect(res.body.totalUmsatzsteuer).toBeCloseTo(1520, 2);
    });

    it('separates 19% and 7% VAT correctly', async () => {
      // 19% income
      insertTestIncome(testDb, {
        date: '2024-04-15',
        net_amount: 10000,
        vat_rate: 19,
        vat_amount: 1900,
        gross_amount: 11900,
      });

      // 7% income
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

    it('calculates Vorsteuer from claimed expenses', async () => {
      // Income Q1
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 5000,
        vat_rate: 19,
        vat_amount: 950,
      });

      // Expense with Vorsteuer claimed
      insertTestExpense(testDb, {
        date: '2024-02-10',
        net_amount: 1000,
        vat_rate: 19,
        vat_amount: 190,
        gross_amount: 1190,
        vorsteuer_claimed: 1,
      });

      // Expense WITHOUT Vorsteuer claimed (should be excluded)
      insertTestExpense(testDb, {
        date: '2024-03-10',
        net_amount: 500,
        vat_rate: 19,
        vat_amount: 95,
        gross_amount: 595,
        vorsteuer_claimed: 0,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      expect(res.status).toBe(200);
      expect(res.body.totalUmsatzsteuer).toBeCloseTo(950, 2);
      expect(res.body.vorsteuer).toBeCloseTo(190, 2); // Only claimed expenses
      expect(res.body.zahllast).toBeCloseTo(760, 2); // 950 - 190
    });

    it('calculates Zahllast correctly (positive = owe money)', async () => {
      // More VAT collected than paid
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
        vorsteuer_claimed: 1,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      // Zahllast = Umsatzsteuer - Vorsteuer = 1900 - 380 = 1520
      expect(res.body.zahllast).toBeCloseTo(1520, 2);
      // Positive zahllast = we owe money to the tax office
      expect(res.body.zahllast).toBeGreaterThan(0);
    });

    it('calculates negative Zahllast (refund expected) when Vorsteuer exceeds Umsatzsteuer', async () => {
      // Small income
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 1000,
        vat_rate: 19,
        vat_amount: 190,
      });

      // Large expense with Vorsteuer
      insertTestExpense(testDb, {
        date: '2024-02-01',
        net_amount: 5000,
        vat_rate: 19,
        vat_amount: 950,
        vorsteuer_claimed: 1,
      });

      const res = await request(app).get('/api/reports/ust/2024/1');

      // Zahllast = 190 - 950 = -760 (refund expected)
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

    it('correctly assigns records to quarters', async () => {
      // Q1: Jan-Mar
      insertTestIncome(testDb, { date: '2024-03-31', vat_rate: 19, vat_amount: 100 });
      // Q2: Apr-Jun
      insertTestIncome(testDb, { date: '2024-04-01', vat_rate: 19, vat_amount: 200 });
      // Q3: Jul-Sep
      insertTestIncome(testDb, { date: '2024-09-30', vat_rate: 19, vat_amount: 300 });
      // Q4: Oct-Dec
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
      const res = await request(app).get('/api/reports/ust/2024/5');
      expect(res.status).toBe(400);
    });

    it('rejects invalid year', async () => {
      const res = await request(app).get('/api/reports/ust/invalid/1');
      expect(res.status).toBe(400);
    });

    it('handles rounding correctly for many small transactions', async () => {
      // Insert 100 income records of €10 each at 19%
      for (let i = 0; i < 100; i++) {
        const day = String((i % 28) + 1).padStart(2, '0');
        const month = String((i % 3) + 1).padStart(2, '0'); // Q1
        insertTestIncome(testDb, {
          date: `2024-${month}-${day}`,
          net_amount: 10,
          vat_rate: 19,
          vat_amount: 1.90,
          gross_amount: 11.90,
        });
      }

      const res = await request(app).get('/api/reports/ust/2024/1');

      // Total USt should be exactly 190 (100 * 1.90)
      expect(res.body.umsatzsteuer19).toBeCloseTo(190, 1);
    });
  });

  // ==========================================================================
  // EÜR Report Tests (Annual Profit Calculation)
  // ==========================================================================

  describe('GET /api/reports/euer/:year', () => {
    it('calculates basic EÜR report correctly', async () => {
      // Income for 2024
      insertTestIncome(testDb, {
        date: '2024-03-15',
        net_amount: 5000,
        euer_line: 14,
      });
      insertTestIncome(testDb, {
        date: '2024-06-15',
        net_amount: 8000,
        euer_line: 14,
      });

      // Expenses for 2024
      insertTestExpense(testDb, {
        date: '2024-04-10',
        net_amount: 1000,
        euer_line: 27,
        deductible_percent: 100,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);
      expect(res.body.totalIncome).toBeCloseTo(13000, 2);
      // totalExpenses includes the expense + Homeoffice-Pauschale (€1,260)
      expect(res.body.totalExpenses).toBeGreaterThanOrEqual(1000);
    });

    it('groups income by EÜR line number', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 5000,
        euer_line: 14, // Betriebseinnahmen
      });
      insertTestIncome(testDb, {
        date: '2024-06-15',
        net_amount: 3000,
        euer_line: 14, // Betriebseinnahmen
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.income[14]).toBeCloseTo(8000, 2);
    });

    it('groups expenses by EÜR line number', async () => {
      // Sonstige Kosten (line 40 in API)
      insertTestExpense(testDb, {
        date: '2024-02-10',
        net_amount: 500,
        euer_line: 40,
        deductible_percent: 100,
      });
      insertTestExpense(testDb, {
        date: '2024-05-10',
        net_amount: 700,
        euer_line: 40,
        deductible_percent: 100,
      });

      // Fremdleistungen (line 21)
      insertTestExpense(testDb, {
        date: '2024-03-10',
        net_amount: 2000,
        euer_line: 21,
        deductible_percent: 100,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.expenses[40]).toBeCloseTo(1200, 2); // 500 + 700
      expect(res.body.expenses[21]).toBeCloseTo(2000, 2);
    });

    it('applies deductible percentage to expenses', async () => {
      // 50% deductible expense (e.g., mixed-use phone)
      insertTestExpense(testDb, {
        date: '2024-01-15',
        net_amount: 1000,
        euer_line: 27,
        deductible_percent: 50,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      // Only €500 should count (50% of €1000)
      expect(res.body.expenses[27]).toBeCloseTo(500, 2);
    });

    it('includes Homeoffice-Pauschale (€1,260) when no Arbeitszimmer expense exists', async () => {
      // Just income, no home office expenses
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 50000,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      // Line 33 (Arbeitszimmer) should contain the Pauschale
      expect(res.body.expenses[33]).toBe(1260);
    });

    it('includes AfA (depreciation) from depreciation schedule', async () => {
      // Add depreciation entry for 2024
      insertDepreciation(testDb, {
        year: 2024,
        depreciation_amount: 800,
      });

      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 5000 });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      // Line 30 (AfA) should include the depreciation
      expect(res.body.expenses[30]).toBeCloseTo(800, 2);
    });

    it('calculates profit (Gewinn) correctly', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 50000 });

      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 10000,
        euer_line: 27,
        deductible_percent: 100,
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      // Gewinn = totalIncome - totalExpenses
      expect(res.body.gewinn).toBe(res.body.totalIncome - res.body.totalExpenses);
    });

    it('only includes records from the specified year', async () => {
      // 2023 income (should be excluded)
      insertTestIncome(testDb, { date: '2023-12-31', net_amount: 9999 });
      // 2024 income (should be included)
      insertTestIncome(testDb, { date: '2024-01-01', net_amount: 5000 });
      // 2025 income (should be excluded)
      insertTestIncome(testDb, { date: '2025-01-01', net_amount: 8888 });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBeCloseTo(5000, 2);
    });

    it('handles year with no income or expenses', async () => {
      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBe(0);
      // Still should have Homeoffice-Pauschale
      expect(res.body.totalExpenses).toBe(1260);
      expect(res.body.gewinn).toBe(-1260);
    });

    it('rejects invalid year', async () => {
      const res = await request(app).get('/api/reports/euer/invalid');
      expect(res.status).toBe(400);
    });

    it('handles a realistic freelancer year correctly', async () => {
      // Simulate a realistic freelancer year
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
          euer_line: 14,
        });
        insertTestExpense(testDb, {
          date: `2024-${month}-20`,
          net_amount: m.expense,
          euer_line: 27,
          deductible_percent: 100,
        });
        totalIncomeExpected += m.income;
        totalExpensesExpected += m.expense;
      });

      const res = await request(app).get('/api/reports/euer/2024');

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBeCloseTo(totalIncomeExpected, 0);
      // Expenses include Homeoffice-Pauschale
      expect(res.body.totalExpenses).toBeCloseTo(totalExpensesExpected + 1260, 0);
      expect(res.body.gewinn).toBeCloseTo(
        totalIncomeExpected - totalExpensesExpected - 1260,
        0
      );
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
      const line14 = res.body.income.find((l: { line: number }) => l.line === 14);
      expect(line14).toBeDefined();
      expect(line14.name).toBe('Betriebseinnahmen');
    });

    it('includes AfA line 30', async () => {
      const res = await request(app).get('/api/reports/euer-lines');
      const line30 = res.body.expenses.find((l: { line: number }) => l.line === 30);
      expect(line30).toBeDefined();
      expect(line30.name).toBe('AfA');
    });

    it('includes Arbeitszimmer line 33', async () => {
      const res = await request(app).get('/api/reports/euer-lines');
      const line33 = res.body.expenses.find((l: { line: number }) => l.line === 33);
      expect(line33).toBeDefined();
      expect(line33.name).toBe('Arbeitszimmer');
    });
  });
});
