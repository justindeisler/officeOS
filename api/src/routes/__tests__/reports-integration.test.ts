/**
 * Reports Integration Tests & Edge Cases
 *
 * End-to-end flows verifying cross-report consistency, database state changes,
 * edge cases, error handling, and performance across USt-Voranmeldung and EÜR.
 *
 * These tests go beyond unit tests: they verify that the reports agree with
 * each other and respond correctly to real-world data mutation scenarios.
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

// Helper to insert depreciation records
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

// ============================================================================
// Shared test setup
// ============================================================================

describe('Reports Integration Tests', () => {
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
  // 1. Cross-Report Consistency
  // ==========================================================================

  describe('Cross-Report Consistency', () => {
    it('VAT totals across all quarters match EÜR yearly income', async () => {
      // Insert income across all 4 quarters
      const incomeData = [
        { date: '2024-01-15', net_amount: 5000, vat_rate: 19, vat_amount: 950 },
        { date: '2024-04-15', net_amount: 6000, vat_rate: 19, vat_amount: 1140 },
        { date: '2024-07-15', net_amount: 7000, vat_rate: 19, vat_amount: 1330 },
        { date: '2024-10-15', net_amount: 8000, vat_rate: 19, vat_amount: 1520 },
      ];

      for (const d of incomeData) {
        insertTestIncome(testDb, d);
      }

      // Get all quarterly USt reports
      const q1 = await request(app).get('/api/reports/ust/2024/1');
      const q2 = await request(app).get('/api/reports/ust/2024/2');
      const q3 = await request(app).get('/api/reports/ust/2024/3');
      const q4 = await request(app).get('/api/reports/ust/2024/4');

      // Get EÜR annual
      const euer = await request(app).get('/api/reports/euer/2024');

      // Total VAT from quarterly USt reports
      const totalUst =
        q1.body.totalUmsatzsteuer +
        q2.body.totalUmsatzsteuer +
        q3.body.totalUmsatzsteuer +
        q4.body.totalUmsatzsteuer;

      // Expected total: 950 + 1140 + 1330 + 1520 = 4940
      expect(totalUst).toBeCloseTo(4940, 2);

      // EÜR income should be the sum of all net amounts
      const expectedIncome = 5000 + 6000 + 7000 + 8000;
      expect(euer.body.totalIncome).toBeCloseTo(expectedIncome, 2);
    });

    it('expense totals are consistent between quarterly USt Vorsteuer and EÜR', async () => {
      // Insert expenses across quarters
      const expenseData = [
        { date: '2024-02-01', net_amount: 1000, vat_rate: 19, vat_amount: 190 },
        { date: '2024-05-01', net_amount: 2000, vat_rate: 19, vat_amount: 380 },
        { date: '2024-08-01', net_amount: 1500, vat_rate: 19, vat_amount: 285 },
        { date: '2024-11-01', net_amount: 500, vat_rate: 19, vat_amount: 95 },
      ];

      for (const d of expenseData) {
        insertTestExpense(testDb, { ...d, euer_line: EUER_LINES.SONSTIGE, deductible_percent: 100 });
      }

      const q1 = await request(app).get('/api/reports/ust/2024/1');
      const q2 = await request(app).get('/api/reports/ust/2024/2');
      const q3 = await request(app).get('/api/reports/ust/2024/3');
      const q4 = await request(app).get('/api/reports/ust/2024/4');

      const euer = await request(app).get('/api/reports/euer/2024');

      // Total Vorsteuer from quarterly reports
      const totalVorsteuer =
        q1.body.vorsteuer + q2.body.vorsteuer + q3.body.vorsteuer + q4.body.vorsteuer;

      expect(totalVorsteuer).toBeCloseTo(190 + 380 + 285 + 95, 2);

      // EÜR expenses should include net amounts + Homeoffice-Pauschale
      const expectedNetExpenses = 1000 + 2000 + 1500 + 500;
      expect(euer.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(expectedNetExpenses, 2);
    });

    it('income in each quarter sums to EÜR total income', async () => {
      // Insert multiple income records per quarter with mixed VAT rates
      const records = [
        { date: '2024-01-10', net_amount: 3000, vat_rate: 19, vat_amount: 570 },
        { date: '2024-02-15', net_amount: 2000, vat_rate: 7, vat_amount: 140 },
        { date: '2024-04-20', net_amount: 4000, vat_rate: 19, vat_amount: 760 },
        { date: '2024-07-05', net_amount: 1500, vat_rate: 7, vat_amount: 105 },
        { date: '2024-10-25', net_amount: 6000, vat_rate: 19, vat_amount: 1140 },
        { date: '2024-12-31', net_amount: 500, vat_rate: 19, vat_amount: 95 },
      ];

      for (const r of records) {
        insertTestIncome(testDb, r);
      }

      const euer = await request(app).get('/api/reports/euer/2024');

      const expectedTotal = records.reduce((sum, r) => sum + r.net_amount, 0);
      expect(euer.body.totalIncome).toBeCloseTo(expectedTotal, 2);
    });

    it('Zahllast across quarters tracks VAT cash flow correctly', async () => {
      // Q1: High income, low expenses → positive Zahllast (owe tax office)
      insertTestIncome(testDb, {
        date: '2024-02-01',
        net_amount: 10000,
        vat_rate: 19,
        vat_amount: 1900,
      });
      insertTestExpense(testDb, {
        date: '2024-02-15',
        net_amount: 2000,
        vat_rate: 19,
        vat_amount: 380,
      });

      // Q2: Low income, high expenses → negative Zahllast (refund expected)
      insertTestIncome(testDb, {
        date: '2024-05-01',
        net_amount: 1000,
        vat_rate: 19,
        vat_amount: 190,
      });
      insertTestExpense(testDb, {
        date: '2024-05-15',
        net_amount: 8000,
        vat_rate: 19,
        vat_amount: 1520,
      });

      const q1 = await request(app).get('/api/reports/ust/2024/1');
      const q2 = await request(app).get('/api/reports/ust/2024/2');

      // Q1: 1900 - 380 = 1520
      expect(q1.body.zahllast).toBeCloseTo(1520, 2);
      expect(q1.body.zahllast).toBeGreaterThan(0);

      // Q2: 190 - 1520 = -1330
      expect(q2.body.zahllast).toBeCloseTo(-1330, 2);
      expect(q2.body.zahllast).toBeLessThan(0);
    });
  });

  // ==========================================================================
  // 2. Database State Changes
  // ==========================================================================

  describe('Database State Changes', () => {
    it('adding a new income record updates both USt and EÜR reports', async () => {
      // Initial state: one income record
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 5000,
        vat_rate: 19,
        vat_amount: 950,
      });

      const ustBefore = await request(app).get('/api/reports/ust/2024/1');
      const euerBefore = await request(app).get('/api/reports/euer/2024');

      expect(ustBefore.body.totalUmsatzsteuer).toBeCloseTo(950, 2);
      expect(euerBefore.body.totalIncome).toBeCloseTo(5000, 2);

      // Add another income record directly to DB
      insertTestIncome(testDb, {
        date: '2024-03-15',
        net_amount: 3000,
        vat_rate: 19,
        vat_amount: 570,
      });

      const ustAfter = await request(app).get('/api/reports/ust/2024/1');
      const euerAfter = await request(app).get('/api/reports/euer/2024');

      // USt should reflect the new record
      expect(ustAfter.body.totalUmsatzsteuer).toBeCloseTo(1520, 2);
      // EÜR should reflect the new record
      expect(euerAfter.body.totalIncome).toBeCloseTo(8000, 2);
    });

    it('modifying expense deductibility updates EÜR profit calculation', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 10000,
      });

      // Expense that is 100% deductible initially
      insertTestExpense(testDb, {
        id: 'expense-deduct-test',
        date: '2024-03-01',
        net_amount: 2000,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });

      const euerBefore = await request(app).get('/api/reports/euer/2024');
      const deductibleBefore = euerBefore.body.expenses[EUER_LINES.SONSTIGE];
      expect(deductibleBefore).toBeCloseTo(2000, 2);

      // Change deductibility to 50%
      testDb
        .prepare('UPDATE expenses SET deductible_percent = 50 WHERE id = ?')
        .run('expense-deduct-test');

      const euerAfter = await request(app).get('/api/reports/euer/2024');
      const deductibleAfter = euerAfter.body.expenses[EUER_LINES.SONSTIGE];
      expect(deductibleAfter).toBeCloseTo(1000, 2);

      // Profit should increase since less is deducted
      expect(euerAfter.body.gewinn).toBeGreaterThan(euerBefore.body.gewinn);
    });

    it('deleting income records updates reports correctly', async () => {
      const id1 = insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 5000,
        vat_rate: 19,
        vat_amount: 950,
      });
      insertTestIncome(testDb, {
        date: '2024-02-15',
        net_amount: 3000,
        vat_rate: 19,
        vat_amount: 570,
      });

      const before = await request(app).get('/api/reports/ust/2024/1');
      expect(before.body.totalUmsatzsteuer).toBeCloseTo(1520, 2);

      // Delete first record
      testDb.prepare('DELETE FROM income WHERE id = ?').run(id1);

      const after = await request(app).get('/api/reports/ust/2024/1');
      expect(after.body.totalUmsatzsteuer).toBeCloseTo(570, 2);
    });

    it('deleting expense records updates EÜR correctly', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 10000 });

      const expId = insertTestExpense(testDb, {
        date: '2024-01-20',
        net_amount: 3000,
        euer_line: EUER_LINES.SONSTIGE,
        deductible_percent: 100,
      });

      const before = await request(app).get('/api/reports/euer/2024');
      expect(before.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(3000, 2);

      testDb.prepare('DELETE FROM expenses WHERE id = ?').run(expId);

      const after = await request(app).get('/api/reports/euer/2024');
      // SONSTIGE should now be 0 (key should not exist or be 0)
      expect(after.body.expenses[EUER_LINES.SONSTIGE] ?? 0).toBe(0);
      // Profit should increase
      expect(after.body.gewinn).toBeGreaterThan(before.body.gewinn);
    });

    it('adding depreciation records updates EÜR AfA line', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 20000 });

      const euerBefore = await request(app).get('/api/reports/euer/2024');
      const afaBefore = euerBefore.body.expenses[EUER_LINES.AFA] ?? 0;

      insertDepreciation(testDb, { year: 2024, depreciation_amount: 1500 });

      const euerAfter = await request(app).get('/api/reports/euer/2024');
      expect(euerAfter.body.expenses[EUER_LINES.AFA]).toBeCloseTo(afaBefore + 1500, 2);
    });

    it('multiple depreciation entries for same year accumulate', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 30000 });

      insertDepreciation(testDb, { year: 2024, depreciation_amount: 1000 });
      insertDepreciation(testDb, { year: 2024, depreciation_amount: 2000 });
      insertDepreciation(testDb, { year: 2024, depreciation_amount: 500 });

      const euer = await request(app).get('/api/reports/euer/2024');
      expect(euer.body.expenses[EUER_LINES.AFA]).toBeCloseTo(3500, 2);
    });
  });

  // ==========================================================================
  // 3. Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    describe('Large numbers (precision)', () => {
      it('handles very large income amounts without precision loss', async () => {
        insertTestIncome(testDb, {
          date: '2024-01-15',
          net_amount: 999999.99,
          vat_rate: 19,
          vat_amount: 190000.00,
          gross_amount: 1189999.99,
        });

        const ust = await request(app).get('/api/reports/ust/2024/1');
        expect(ust.status).toBe(200);
        expect(ust.body.totalUmsatzsteuer).toBeCloseTo(190000.00, 2);

        const euer = await request(app).get('/api/reports/euer/2024');
        expect(euer.body.totalIncome).toBeCloseTo(999999.99, 2);
      });

      it('handles many records summing to large totals', async () => {
        // 200 records of €5000 each
        for (let i = 0; i < 200; i++) {
          const month = String((i % 12) + 1).padStart(2, '0');
          const day = String((i % 28) + 1).padStart(2, '0');
          insertTestIncome(testDb, {
            date: `2024-${month}-${day}`,
            net_amount: 5000,
            vat_rate: 19,
            vat_amount: 950,
            gross_amount: 5950,
          });
        }

        const euer = await request(app).get('/api/reports/euer/2024');
        expect(euer.body.totalIncome).toBeCloseTo(1000000, 0); // €1M
      });

      it('handles fractional cent amounts correctly', async () => {
        // €33.33 at 19% = €6.3327 → rounded to €6.33
        insertTestIncome(testDb, {
          date: '2024-01-15',
          net_amount: 33.33,
          vat_rate: 19,
          vat_amount: 6.33,
          gross_amount: 39.66,
        });

        const ust = await request(app).get('/api/reports/ust/2024/1');
        expect(ust.body.umsatzsteuer19).toBeCloseTo(6.33, 2);
      });
    });

    describe('Zero and null values', () => {
      it('handles income with zero VAT rate (VAT-free Kleinunternehmer)', async () => {
        insertTestIncome(testDb, {
          date: '2024-01-15',
          net_amount: 5000,
          vat_rate: 0,
          vat_amount: 0,
          gross_amount: 5000,
        });

        const ust = await request(app).get('/api/reports/ust/2024/1');
        expect(ust.status).toBe(200);
        expect(ust.body.umsatzsteuer19).toBe(0);
        expect(ust.body.umsatzsteuer7).toBe(0);
        expect(ust.body.totalUmsatzsteuer).toBe(0);

        const euer = await request(app).get('/api/reports/euer/2024');
        expect(euer.body.totalIncome).toBeCloseTo(5000, 2);
      });

      it('handles expense with zero net amount', async () => {
        insertTestExpense(testDb, {
          date: '2024-01-15',
          net_amount: 0,
          vat_rate: 19,
          vat_amount: 0,
          gross_amount: 0,
          euer_line: EUER_LINES.SONSTIGE,
          deductible_percent: 100,
        });

        const ust = await request(app).get('/api/reports/ust/2024/1');
        expect(ust.body.vorsteuer).toBe(0);
      });

      it('handles expense with 0% deductibility', async () => {
        insertTestIncome(testDb, { date: '2024-01-15', net_amount: 10000 });
        insertTestExpense(testDb, {
          date: '2024-01-15',
          net_amount: 5000,
          euer_line: EUER_LINES.SONSTIGE,
          deductible_percent: 0,
        });

        const euer = await request(app).get('/api/reports/euer/2024');
        // 0% deductible means nothing counts
        expect(euer.body.expenses[EUER_LINES.SONSTIGE] ?? 0).toBeCloseTo(0, 2);
      });

      it('returns valid report structure with completely empty database', async () => {
        const ust = await request(app).get('/api/reports/ust/2024/1');
        expect(ust.status).toBe(200);
        expect(ust.body.umsatzsteuer19).toBe(0);
        expect(ust.body.umsatzsteuer7).toBe(0);
        expect(ust.body.vorsteuer).toBe(0);
        expect(ust.body.zahllast).toBe(0);

        const euer = await request(app).get('/api/reports/euer/2024');
        expect(euer.status).toBe(200);
        expect(euer.body.totalIncome).toBe(0);
        // Homeoffice not enabled → no expenses
        expect(euer.body.totalExpenses).toBe(0);
        expect(euer.body.gewinn).toBe(0);
      });
    });

    describe('Date boundary conditions', () => {
      it('Q1 boundary: Jan 1 included, Apr 1 excluded', async () => {
        insertTestIncome(testDb, {
          date: '2024-01-01',
          net_amount: 1000,
          vat_rate: 19,
          vat_amount: 190,
        });
        insertTestIncome(testDb, {
          date: '2024-03-31',
          net_amount: 2000,
          vat_rate: 19,
          vat_amount: 380,
        });
        insertTestIncome(testDb, {
          date: '2024-04-01',
          net_amount: 9000,
          vat_rate: 19,
          vat_amount: 1710,
        });

        const q1 = await request(app).get('/api/reports/ust/2024/1');
        const q2 = await request(app).get('/api/reports/ust/2024/2');

        expect(q1.body.totalUmsatzsteuer).toBeCloseTo(570, 2); // 190 + 380
        expect(q2.body.totalUmsatzsteuer).toBeCloseTo(1710, 2); // Only Apr 1
      });

      it('Q4 boundary: Oct 1 included, Dec 31 included', async () => {
        insertTestIncome(testDb, {
          date: '2024-10-01',
          net_amount: 1000,
          vat_rate: 19,
          vat_amount: 190,
        });
        insertTestIncome(testDb, {
          date: '2024-12-31',
          net_amount: 2000,
          vat_rate: 19,
          vat_amount: 380,
        });

        const q4 = await request(app).get('/api/reports/ust/2024/4');
        expect(q4.body.totalUmsatzsteuer).toBeCloseTo(570, 2);
      });

      it('year boundary: Dec 31 vs Jan 1 assigned to correct years', async () => {
        insertTestIncome(testDb, {
          date: '2023-12-31',
          net_amount: 5000,
        });
        insertTestIncome(testDb, {
          date: '2024-01-01',
          net_amount: 7000,
        });
        insertTestIncome(testDb, {
          date: '2024-12-31',
          net_amount: 3000,
        });
        insertTestIncome(testDb, {
          date: '2025-01-01',
          net_amount: 9000,
        });

        const euer2023 = await request(app).get('/api/reports/euer/2023');
        const euer2024 = await request(app).get('/api/reports/euer/2024');
        const euer2025 = await request(app).get('/api/reports/euer/2025');

        expect(euer2023.body.totalIncome).toBeCloseTo(5000, 2);
        expect(euer2024.body.totalIncome).toBeCloseTo(10000, 2); // 7000 + 3000
        expect(euer2025.body.totalIncome).toBeCloseTo(9000, 2);
      });

      it('leap year Feb 29 is included in Q1', async () => {
        insertTestIncome(testDb, {
          date: '2024-02-29',
          net_amount: 4000,
          vat_rate: 19,
          vat_amount: 760,
        });

        const q1 = await request(app).get('/api/reports/ust/2024/1');
        expect(q1.body.totalUmsatzsteuer).toBeCloseTo(760, 2);
      });

      it('all four quarter boundaries are contiguous (no gaps or overlaps)', async () => {
        // Insert one record on each quarter boundary date
        const boundaryDates = [
          '2024-01-01', // Q1 start
          '2024-03-31', // Q1 end
          '2024-04-01', // Q2 start
          '2024-06-30', // Q2 end
          '2024-07-01', // Q3 start
          '2024-09-30', // Q3 end
          '2024-10-01', // Q4 start
          '2024-12-31', // Q4 end
        ];

        for (const date of boundaryDates) {
          insertTestIncome(testDb, {
            date,
            net_amount: 1000,
            vat_rate: 19,
            vat_amount: 190,
          });
        }

        const q1 = await request(app).get('/api/reports/ust/2024/1');
        const q2 = await request(app).get('/api/reports/ust/2024/2');
        const q3 = await request(app).get('/api/reports/ust/2024/3');
        const q4 = await request(app).get('/api/reports/ust/2024/4');

        // Each quarter should have exactly 2 records (start + end boundary)
        expect(q1.body.totalUmsatzsteuer).toBeCloseTo(380, 2); // 2 × 190
        expect(q2.body.totalUmsatzsteuer).toBeCloseTo(380, 2);
        expect(q3.body.totalUmsatzsteuer).toBeCloseTo(380, 2);
        expect(q4.body.totalUmsatzsteuer).toBeCloseTo(380, 2);

        // Total across all quarters should equal all 8 records
        const totalUst =
          q1.body.totalUmsatzsteuer +
          q2.body.totalUmsatzsteuer +
          q3.body.totalUmsatzsteuer +
          q4.body.totalUmsatzsteuer;
        expect(totalUst).toBeCloseTo(1520, 2); // 8 × 190
      });
    });

    describe('Mixed VAT rates', () => {
      it('correctly tracks 0%, 7%, and 19% VAT rates separately', async () => {
        // 0% (e.g., reverse charge EU)
        insertTestIncome(testDb, {
          date: '2024-01-15',
          net_amount: 3000,
          vat_rate: 0,
          vat_amount: 0,
          gross_amount: 3000,
        });
        // 7%
        insertTestIncome(testDb, {
          date: '2024-01-20',
          net_amount: 2000,
          vat_rate: 7,
          vat_amount: 140,
          gross_amount: 2140,
        });
        // 19%
        insertTestIncome(testDb, {
          date: '2024-02-10',
          net_amount: 5000,
          vat_rate: 19,
          vat_amount: 950,
          gross_amount: 5950,
        });

        const ust = await request(app).get('/api/reports/ust/2024/1');

        expect(ust.body.umsatzsteuer19).toBeCloseTo(950, 2);
        expect(ust.body.umsatzsteuer7).toBeCloseTo(140, 2);
        // 0% shouldn't appear in either bucket
        expect(ust.body.totalUmsatzsteuer).toBeCloseTo(1090, 2); // 950 + 140
      });
    });

    describe('Deductibility edge cases', () => {
      it('handles exactly 100% deductible expenses', async () => {
        insertTestExpense(testDb, {
          date: '2024-01-15',
          net_amount: 1000,
          euer_line: EUER_LINES.SONSTIGE,
          deductible_percent: 100,
        });

        const euer = await request(app).get('/api/reports/euer/2024');
        expect(euer.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(1000, 2);
      });

      it('handles fractional deductible percent (e.g., 33.33%)', async () => {
        insertTestExpense(testDb, {
          date: '2024-01-15',
          net_amount: 3000,
          euer_line: EUER_LINES.SONSTIGE,
          deductible_percent: 33.33,
        });

        const euer = await request(app).get('/api/reports/euer/2024');
        // 3000 * 33.33% = 999.9
        expect(euer.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(999.9, 1);
      });

      it('mixed deductibility expenses aggregate correctly', async () => {
        // Two expenses on the same EÜR line with different deductibility
        insertTestExpense(testDb, {
          date: '2024-01-15',
          net_amount: 1000,
          euer_line: EUER_LINES.SONSTIGE,
          deductible_percent: 100,
        });
        insertTestExpense(testDb, {
          date: '2024-02-15',
          net_amount: 2000,
          euer_line: EUER_LINES.SONSTIGE,
          deductible_percent: 50,
        });

        const euer = await request(app).get('/api/reports/euer/2024');
        // 1000 * 100% + 2000 * 50% = 1000 + 1000 = 2000
        expect(euer.body.expenses[EUER_LINES.SONSTIGE]).toBeCloseTo(2000, 2);
      });
    });

    describe('Homeoffice-Pauschale behavior', () => {
      it('applies Pauschale when enabled in settings and no Arbeitszimmer expense exists', async () => {
        testDb.prepare("INSERT INTO settings (key, value) VALUES ('homeoffice_enabled', 'true')").run();
        insertTestIncome(testDb, { date: '2024-06-15', net_amount: 20000 });

        const euer = await request(app).get('/api/reports/euer/2024');
        expect(euer.body.expenses[EUER_LINES.ARBEITSZIMMER]).toBe(HOMEOFFICE_PAUSCHALE);
      });

      it('does NOT apply Pauschale when not enabled in settings', async () => {
        insertTestIncome(testDb, { date: '2024-06-15', net_amount: 20000 });

        const euer = await request(app).get('/api/reports/euer/2024');
        expect(euer.body.expenses[EUER_LINES.ARBEITSZIMMER]).toBeUndefined();
      });

      it('does NOT apply Pauschale when real Arbeitszimmer expense exists', async () => {
        insertTestIncome(testDb, { date: '2024-06-15', net_amount: 20000 });
        insertTestExpense(testDb, {
          date: '2024-01-15',
          net_amount: 500,
          euer_line: EUER_LINES.ARBEITSZIMMER,
          deductible_percent: 100,
        });

        const euer = await request(app).get('/api/reports/euer/2024');
        // Should use the actual expense, not the Pauschale
        expect(euer.body.expenses[EUER_LINES.ARBEITSZIMMER]).toBeCloseTo(500, 2);
      });
    });
  });

  // ==========================================================================
  // 4. Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('rejects quarter 0 for USt', async () => {
      const res = await request(app).get('/api/reports/ust/2024/0');
      expect(res.status).toBe(400);
    });

    it('rejects quarter 5 for USt', async () => {
      const res = await request(app).get('/api/reports/ust/2024/5');
      expect(res.status).toBe(400);
    });

    it('rejects negative quarter for USt', async () => {
      const res = await request(app).get('/api/reports/ust/2024/-1');
      expect(res.status).toBe(400);
    });

    it('rejects non-numeric year for USt', async () => {
      const res = await request(app).get('/api/reports/ust/abc/1');
      expect(res.status).toBe(400);
    });

    it('rejects non-numeric year for EÜR', async () => {
      const res = await request(app).get('/api/reports/euer/abc');
      expect(res.status).toBe(400);
    });

    it('rejects non-numeric quarter for USt', async () => {
      const res = await request(app).get('/api/reports/ust/2024/abc');
      expect(res.status).toBe(400);
    });

    it('handles year 0 gracefully', async () => {
      // Year 0 is "falsy" in JS: parseInt('0') === 0 which is falsy
      const res = await request(app).get('/api/reports/euer/0');
      expect(res.status).toBe(400);
    });

    it('returns valid JSON error for all error responses', async () => {
      const res = await request(app).get('/api/reports/ust/invalid/invalid');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
    });

    it('handles future years without errors', async () => {
      const res = await request(app).get('/api/reports/euer/2099');
      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBe(0);
    });

    it('handles past years without errors', async () => {
      const res = await request(app).get('/api/reports/euer/2000');
      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBe(0);
    });
  });

  // ==========================================================================
  // 5. Performance
  // ==========================================================================

  describe('Performance', () => {
    it('EÜR report with 100+ income and expense records completes in <500ms', async () => {
      // Insert 150 income records
      for (let i = 0; i < 150; i++) {
        const month = String((i % 12) + 1).padStart(2, '0');
        const day = String((i % 28) + 1).padStart(2, '0');
        insertTestIncome(testDb, {
          date: `2024-${month}-${day}`,
          net_amount: 1000 + (i * 10),
          vat_rate: i % 3 === 0 ? 7 : 19,
          euer_line: EUER_LINES.BETRIEBSEINNAHMEN,
        });
      }

      // Insert 120 expense records
      for (let i = 0; i < 120; i++) {
        const month = String((i % 12) + 1).padStart(2, '0');
        const day = String((i % 28) + 1).padStart(2, '0');
        insertTestExpense(testDb, {
          date: `2024-${month}-${day}`,
          net_amount: 100 + (i * 5),
          euer_line: i % 2 === 0 ? EUER_LINES.SONSTIGE : EUER_LINES.FREMDLEISTUNGEN,
          deductible_percent: i % 5 === 0 ? 50 : 100,
        });
      }

      const start = performance.now();
      const res = await request(app).get('/api/reports/euer/2024');
      const elapsed = performance.now() - start;

      expect(res.status).toBe(200);
      expect(res.body.totalIncome).toBeGreaterThan(0);
      expect(res.body.totalExpenses).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(500);
    });

    it('USt quarterly report with 100+ records completes in <200ms', async () => {
      // Insert 100 income records in Q1
      for (let i = 0; i < 100; i++) {
        const day = String((i % 28) + 1).padStart(2, '0');
        const month = String((i % 3) + 1).padStart(2, '0');
        insertTestIncome(testDb, {
          date: `2024-${month}-${day}`,
          net_amount: 500 + i,
          vat_rate: 19,
          vat_amount: (500 + i) * 0.19,
        });
      }

      // Insert 50 expenses in Q1
      for (let i = 0; i < 50; i++) {
        const day = String((i % 28) + 1).padStart(2, '0');
        insertTestExpense(testDb, {
          date: `2024-01-${day}`,
          net_amount: 100 + i,
          vat_rate: 19,
          vat_amount: (100 + i) * 0.19,
        });
      }

      const start = performance.now();
      const res = await request(app).get('/api/reports/ust/2024/1');
      const elapsed = performance.now() - start;

      expect(res.status).toBe(200);
      expect(res.body.totalUmsatzsteuer).toBeGreaterThan(0);
      expect(res.body.vorsteuer).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(200);
    });

    it('handles 500 records across all report types', async () => {
      // Bulk insert 500 income records
      const insertIncome = testDb.prepare(
        `INSERT INTO income (id, date, description, net_amount, vat_rate, vat_amount, gross_amount, euer_line, euer_category, ust_reported, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
      );

      const insertExpenseStmt = testDb.prepare(
        `INSERT INTO expenses (id, date, vendor, description, category, net_amount, vat_rate, vat_amount, gross_amount, euer_line, deductible_percent, ust_reported, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
      );

      const insertManyTx = testDb.transaction(() => {
        for (let i = 0; i < 300; i++) {
          const month = String((i % 12) + 1).padStart(2, '0');
          const day = String((i % 28) + 1).padStart(2, '0');
          const net = 1000 + i;
          const vat = Math.round(net * 0.19 * 100) / 100;
          insertIncome.run(
            `bulk-inc-${i}`,
            `2024-${month}-${day}`,
            `Bulk income ${i}`,
            net,
            19,
            vat,
            net + vat,
            14,
            'services'
          );
        }
        for (let i = 0; i < 200; i++) {
          const month = String((i % 12) + 1).padStart(2, '0');
          const day = String((i % 28) + 1).padStart(2, '0');
          const net = 200 + i;
          const vat = Math.round(net * 0.19 * 100) / 100;
          insertExpenseStmt.run(
            `bulk-exp-${i}`,
            `2024-${month}-${day}`,
            'Bulk Vendor',
            `Bulk expense ${i}`,
            'software',
            net,
            19,
            vat,
            net + vat,
            EUER_LINES.SONSTIGE,
            100
          );
        }
      });

      insertManyTx();

      const start = performance.now();

      const [euer, q1, q2, q3, q4] = await Promise.all([
        request(app).get('/api/reports/euer/2024'),
        request(app).get('/api/reports/ust/2024/1'),
        request(app).get('/api/reports/ust/2024/2'),
        request(app).get('/api/reports/ust/2024/3'),
        request(app).get('/api/reports/ust/2024/4'),
      ]);

      const elapsed = performance.now() - start;

      expect(euer.status).toBe(200);
      expect(q1.status).toBe(200);
      expect(q2.status).toBe(200);
      expect(q3.status).toBe(200);
      expect(q4.status).toBe(200);

      // All 5 reports should complete in under 1 second
      expect(elapsed).toBeLessThan(1000);

      // Verify data integrity with bulk data
      expect(euer.body.totalIncome).toBeGreaterThan(0);
      expect(euer.body.totalExpenses).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 6. EÜR Lines Reference Endpoint
  // ==========================================================================

  describe('EÜR Lines Reference (integration)', () => {
    it('all EÜR line numbers used in reports match the reference', async () => {
      // Get the reference
      const linesRes = await request(app).get('/api/reports/euer-lines');
      expect(linesRes.status).toBe(200);

      const allLineNumbers = [
        ...linesRes.body.income.map((l: { line: number }) => l.line),
        ...linesRes.body.expenses.map((l: { line: number }) => l.line),
      ];

      // Verify all EUER_LINES constants appear in the reference
      expect(allLineNumbers).toContain(EUER_LINES.BETRIEBSEINNAHMEN);
      expect(allLineNumbers).toContain(EUER_LINES.AFA);
      expect(allLineNumbers).toContain(EUER_LINES.ARBEITSZIMMER);
      expect(allLineNumbers).toContain(EUER_LINES.SONSTIGE);
      expect(allLineNumbers).toContain(EUER_LINES.FREMDLEISTUNGEN);
      expect(allLineNumbers).toContain(EUER_LINES.VORSTEUER);
    });
  });
});
