/**
 * BWA & SUSA Report Tests
 *
 * Tests for:
 * - BWA (Betriebswirtschaftliche Auswertung) — monthly P&L
 * - SuSa (Summen- und Saldenliste) — trial balance
 * - Profitability reports — by client and by category
 * - Input validation
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestIncome,
  insertTestExpense,
  insertTestClient,
} from '../../test/setup.js';

// ============================================================================
// Setup
// ============================================================================

let testDb: Database.Database;

import { createTestApp } from '../../test/app.js';
import bwaRouter from '../bwa.js';
import request from 'supertest';

const app = createTestApp(bwaRouter, '/api/reports');

// ============================================================================
// Tests
// ============================================================================

describe('BWA & SUSA Reports', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = await import('../../database.js') as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // BWA Full Year
  // ==========================================================================

  describe('GET /api/reports/bwa/:year', () => {
    it('returns 12 months for a year with data', async () => {
      insertTestIncome(testDb, { date: '2024-03-15', net_amount: 5000 });
      insertTestExpense(testDb, { date: '2024-03-20', net_amount: 1000 });

      const res = await request(app).get('/api/reports/bwa/2024');

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);
      expect(res.body.months).toHaveLength(12);
      expect(res.body.months[0].month).toBe(1);
      expect(res.body.months[11].month).toBe(12);
    });

    it('correctly aggregates income by category', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 3000,
        euer_category: 'services',
      });
      insertTestIncome(testDb, {
        date: '2024-01-20',
        net_amount: 2000,
        euer_category: 'products',
      });

      const res = await request(app).get('/api/reports/bwa/2024');

      const jan = res.body.months[0]; // January
      expect(jan.income.total).toBeCloseTo(5000, 2);
      expect(jan.income.by_category['services']).toBeCloseTo(3000, 2);
      expect(jan.income.by_category['products']).toBeCloseTo(2000, 2);
    });

    it('correctly aggregates income by VAT rate', async () => {
      insertTestIncome(testDb, {
        date: '2024-02-15',
        net_amount: 4000,
        vat_rate: 19,
        vat_amount: 760,
      });
      insertTestIncome(testDb, {
        date: '2024-02-20',
        net_amount: 1000,
        vat_rate: 7,
        vat_amount: 70,
      });

      const res = await request(app).get('/api/reports/bwa/2024');

      const feb = res.body.months[1]; // February
      expect(feb.income.by_vat_rate[19]).toBeCloseTo(4000, 2);
      expect(feb.income.by_vat_rate[7]).toBeCloseTo(1000, 2);
    });

    it('correctly aggregates expenses by EÜR line', async () => {
      insertTestExpense(testDb, {
        date: '2024-04-10',
        net_amount: 500,
        category: 'software',
        euer_line: 34,
      });
      insertTestExpense(testDb, {
        date: '2024-04-15',
        net_amount: 2000,
        category: 'fremdleistungen',
        euer_line: 25,
      });

      const res = await request(app).get('/api/reports/bwa/2024');

      const apr = res.body.months[3]; // April
      expect(apr.expenses.by_euer_line[34]).toBeCloseTo(500, 2);
      expect(apr.expenses.by_euer_line[25]).toBeCloseTo(2000, 2);
    });

    it('calculates profit correctly (income - expenses)', async () => {
      insertTestIncome(testDb, { date: '2024-06-15', net_amount: 10000 });
      insertTestExpense(testDb, { date: '2024-06-20', net_amount: 3000 });

      const res = await request(app).get('/api/reports/bwa/2024');

      const jun = res.body.months[5]; // June
      expect(jun.profit).toBeCloseTo(7000, 2);
      expect(jun.income.total).toBeCloseTo(10000, 2);
      expect(jun.expenses.total).toBeCloseTo(3000, 2);
    });

    it('calculates year totals correctly', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 5000 });
      insertTestIncome(testDb, { date: '2024-06-15', net_amount: 8000 });
      insertTestExpense(testDb, { date: '2024-03-10', net_amount: 2000 });
      insertTestExpense(testDb, { date: '2024-09-10', net_amount: 1500 });

      const res = await request(app).get('/api/reports/bwa/2024');

      expect(res.body.totals.income).toBeCloseTo(13000, 2);
      expect(res.body.totals.expenses).toBeCloseTo(3500, 2);
      expect(res.body.totals.profit).toBeCloseTo(9500, 2);
    });

    it('calculates profit margin correctly', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 10000 });
      insertTestExpense(testDb, { date: '2024-01-20', net_amount: 3000 });

      const res = await request(app).get('/api/reports/bwa/2024');

      // Profit margin = (10000 - 3000) / 10000 * 100 = 70%
      expect(res.body.totals.profit_margin_percent).toBeCloseTo(70, 1);
    });

    it('empty year returns zero values (not errors)', async () => {
      const res = await request(app).get('/api/reports/bwa/2024');

      expect(res.status).toBe(200);
      expect(res.body.months).toHaveLength(12);
      expect(res.body.totals.income).toBe(0);
      expect(res.body.totals.expenses).toBe(0);
      expect(res.body.totals.profit).toBe(0);
      expect(res.body.totals.profit_margin_percent).toBe(0);

      // Every month should also be zero
      for (const month of res.body.months) {
        expect(month.income.total).toBe(0);
        expect(month.expenses.total).toBe(0);
        expect(month.profit).toBe(0);
      }
    });

    it('excludes soft-deleted records', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 5000 });

      // Insert a soft-deleted income record directly
      testDb.prepare(
        `INSERT INTO income (id, date, description, net_amount, vat_rate, vat_amount, gross_amount, is_deleted, created_at)
         VALUES ('del-1', '2024-01-20', 'Deleted', 3000, 19, 570, 3570, 1, datetime('now'))`
      ).run();

      const res = await request(app).get('/api/reports/bwa/2024');

      expect(res.body.totals.income).toBeCloseTo(5000, 2);
    });

    it('respects deductible_percent on expenses', async () => {
      insertTestExpense(testDb, {
        date: '2024-05-15',
        net_amount: 1000,
        deductible_percent: 70,
      });

      const res = await request(app).get('/api/reports/bwa/2024');

      const may = res.body.months[4]; // May
      expect(may.expenses.total).toBeCloseTo(700, 2);
    });

    it('calculates VAT liability per month', async () => {
      insertTestIncome(testDb, {
        date: '2024-03-15',
        net_amount: 5000,
        vat_rate: 19,
        vat_amount: 950,
      });
      insertTestExpense(testDb, {
        date: '2024-03-20',
        net_amount: 1000,
        vat_rate: 19,
        vat_amount: 190,
        category: 'software', // Vorsteuer-eligible
      });

      const res = await request(app).get('/api/reports/bwa/2024');

      const mar = res.body.months[2]; // March
      // VAT liability = output VAT (950) - input VAT (190) = 760
      expect(mar.vat_liability).toBeCloseTo(760, 2);
    });

    it('rejects invalid year', async () => {
      const res = await request(app).get('/api/reports/bwa/invalid');
      expect(res.status).toBe(400);
    });

    it('rejects year out of range', async () => {
      const res = await request(app).get('/api/reports/bwa/1999');
      expect(res.status).toBe(400);
    });

    it('does not cross year boundaries', async () => {
      insertTestIncome(testDb, { date: '2023-12-31', net_amount: 9999 });
      insertTestIncome(testDb, { date: '2024-01-01', net_amount: 1000 });
      insertTestIncome(testDb, { date: '2025-01-01', net_amount: 8888 });

      const res = await request(app).get('/api/reports/bwa/2024');

      expect(res.body.totals.income).toBeCloseTo(1000, 2);
    });

    it('handles many small transactions with correct rounding', async () => {
      for (let i = 0; i < 50; i++) {
        const day = String((i % 28) + 1).padStart(2, '0');
        insertTestIncome(testDb, {
          date: `2024-01-${day}`,
          net_amount: 33.33,
          vat_rate: 19,
          vat_amount: 6.33,
        });
      }

      const res = await request(app).get('/api/reports/bwa/2024');

      expect(res.body.months[0].income.total).toBeCloseTo(1666.50, 1);
    });
  });

  // ==========================================================================
  // BWA Single Month
  // ==========================================================================

  describe('GET /api/reports/bwa/:year/:month', () => {
    it('returns only that month', async () => {
      insertTestIncome(testDb, { date: '2024-03-15', net_amount: 5000 });
      insertTestIncome(testDb, { date: '2024-04-15', net_amount: 8000 });

      const res = await request(app).get('/api/reports/bwa/2024/3');

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);
      expect(res.body.month).toBe(3);
      expect(res.body.aggregate.month).toBe(3);
      expect(res.body.totals.income).toBeCloseTo(5000, 2);
    });

    it('returns zero for empty month', async () => {
      const res = await request(app).get('/api/reports/bwa/2024/7');

      expect(res.status).toBe(200);
      expect(res.body.totals.income).toBe(0);
      expect(res.body.totals.expenses).toBe(0);
      expect(res.body.totals.profit).toBe(0);
    });

    it('rejects invalid month', async () => {
      const res13 = await request(app).get('/api/reports/bwa/2024/13');
      expect(res13.status).toBe(400);

      const res0 = await request(app).get('/api/reports/bwa/2024/0');
      expect(res0.status).toBe(400);
    });

    it('handles month boundary dates correctly', async () => {
      // February end (non-leap year)
      insertTestIncome(testDb, { date: '2023-02-28', net_amount: 1000 });
      insertTestIncome(testDb, { date: '2023-03-01', net_amount: 2000 });

      const resFeb = await request(app).get('/api/reports/bwa/2023/2');
      const resMar = await request(app).get('/api/reports/bwa/2023/3');

      expect(resFeb.body.totals.income).toBeCloseTo(1000, 2);
      expect(resMar.body.totals.income).toBeCloseTo(2000, 2);
    });

    it('handles leap year February correctly', async () => {
      insertTestIncome(testDb, { date: '2024-02-29', net_amount: 1500 });

      const res = await request(app).get('/api/reports/bwa/2024/2');

      expect(res.body.totals.income).toBeCloseTo(1500, 2);
    });
  });

  // ==========================================================================
  // SuSa
  // ==========================================================================

  describe('GET /api/reports/susa/:year', () => {
    it('maps income categories to SKR03 account numbers', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 10000,
        vat_rate: 19,
        vat_amount: 1900,
        euer_category: 'services',
      });

      const res = await request(app).get('/api/reports/susa/2024');

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);

      // Should have account 8400 (Erlöse 19%)
      const account8400 = res.body.accounts.find((a: any) => a.account_number === '8400');
      expect(account8400).toBeDefined();
      expect(account8400.credit).toBeCloseTo(10000, 2);

      // Should have account 1776 (Umsatzsteuer 19%)
      const account1776 = res.body.accounts.find((a: any) => a.account_number === '1776');
      expect(account1776).toBeDefined();
      expect(account1776.credit).toBeCloseTo(1900, 2);
    });

    it('maps expense categories to SKR03 account numbers', async () => {
      insertTestExpense(testDb, {
        date: '2024-06-15',
        net_amount: 500,
        vat_rate: 19,
        vat_amount: 95,
        category: 'software',
      });

      const res = await request(app).get('/api/reports/susa/2024');

      // Account 4964 (Software)
      const account4964 = res.body.accounts.find((a: any) => a.account_number === '4964');
      expect(account4964).toBeDefined();
      expect(account4964.debit).toBeCloseTo(500, 2);

      // Account 1576 (Vorsteuer)
      const account1576 = res.body.accounts.find((a: any) => a.account_number === '1576');
      expect(account1576).toBeDefined();
      expect(account1576.debit).toBeCloseTo(95, 2);
    });

    it('returns accounts sorted by account number', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 5000, vat_rate: 19, vat_amount: 950 });
      insertTestExpense(testDb, { date: '2024-01-20', net_amount: 200, category: 'telecom' });

      const res = await request(app).get('/api/reports/susa/2024');

      const numbers = res.body.accounts.map((a: any) => a.account_number);
      const sorted = [...numbers].sort();
      expect(numbers).toEqual(sorted);
    });

    it('empty year returns empty accounts array', async () => {
      const res = await request(app).get('/api/reports/susa/2024');

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);
      expect(res.body.accounts).toEqual([]);
    });

    it('calculates balance correctly (debit - credit)', async () => {
      insertTestExpense(testDb, {
        date: '2024-01-15',
        net_amount: 800,
        vat_rate: 0,
        vat_amount: 0,
        category: 'bank_fees',
      });

      const res = await request(app).get('/api/reports/susa/2024');

      // Account 4970 (Bank fees) — only debit, no credit
      const account4970 = res.body.accounts.find((a: any) => a.account_number === '4970');
      expect(account4970).toBeDefined();
      expect(account4970.debit).toBeCloseTo(800, 2);
      expect(account4970.credit).toBe(0);
      expect(account4970.balance).toBeCloseTo(800, 2);
    });

    it('handles multiple expense categories mapping to same account', async () => {
      // Both 'software' and 'hosting' map to account 4964
      insertTestExpense(testDb, {
        date: '2024-01-15',
        net_amount: 500,
        category: 'software',
        vat_rate: 0,
        vat_amount: 0,
      });
      insertTestExpense(testDb, {
        date: '2024-02-15',
        net_amount: 300,
        category: 'hosting',
        vat_rate: 0,
        vat_amount: 0,
      });

      const res = await request(app).get('/api/reports/susa/2024');

      const account4964 = res.body.accounts.find((a: any) => a.account_number === '4964');
      expect(account4964).toBeDefined();
      expect(account4964.debit).toBeCloseTo(800, 2);
    });

    it('rejects invalid year', async () => {
      const res = await request(app).get('/api/reports/susa/invalid');
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // Profitability by Client
  // ==========================================================================

  describe('GET /api/reports/profitability/by-client/:year', () => {
    it('returns income grouped by client', async () => {
      const clientId = insertTestClient(testDb, { name: 'Acme Corp' });
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 5000, client_id: clientId });
      insertTestIncome(testDb, { date: '2024-02-15', net_amount: 3000, client_id: clientId });

      const res = await request(app).get('/api/reports/profitability/by-client/2024');

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);
      expect(res.body.clients).toHaveLength(1);
      expect(res.body.clients[0].client_name).toBe('Acme Corp');
      expect(res.body.clients[0].income).toBeCloseTo(8000, 2);
    });

    it('tracks unassigned income separately', async () => {
      insertTestIncome(testDb, { date: '2024-01-15', net_amount: 2000 }); // no client_id

      const res = await request(app).get('/api/reports/profitability/by-client/2024');

      expect(res.body.clients).toHaveLength(0);
      expect(res.body.unassigned.income).toBeCloseTo(2000, 2);
    });

    it('returns empty for year with no data', async () => {
      const res = await request(app).get('/api/reports/profitability/by-client/2024');

      expect(res.status).toBe(200);
      expect(res.body.clients).toHaveLength(0);
      expect(res.body.unassigned.income).toBe(0);
    });

    it('rejects invalid year', async () => {
      const res = await request(app).get('/api/reports/profitability/by-client/invalid');
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // Profitability by Category
  // ==========================================================================

  describe('GET /api/reports/profitability/by-category/:year', () => {
    it('returns income and expense categories', async () => {
      insertTestIncome(testDb, {
        date: '2024-01-15',
        net_amount: 5000,
        euer_category: 'services',
      });
      insertTestExpense(testDb, {
        date: '2024-02-15',
        net_amount: 800,
        category: 'software',
      });

      const res = await request(app).get('/api/reports/profitability/by-category/2024');

      expect(res.status).toBe(200);
      expect(res.body.year).toBe(2024);

      expect(res.body.income_categories).toHaveLength(1);
      expect(res.body.income_categories[0].category).toBe('services');
      expect(res.body.income_categories[0].total).toBeCloseTo(5000, 2);

      expect(res.body.expense_categories).toHaveLength(1);
      expect(res.body.expense_categories[0].category).toBe('software');
      expect(res.body.expense_categories[0].category_name).toBe('Software & Lizenzen');
      expect(res.body.expense_categories[0].total).toBeCloseTo(800, 2);
    });

    it('returns empty arrays for year with no data', async () => {
      const res = await request(app).get('/api/reports/profitability/by-category/2024');

      expect(res.status).toBe(200);
      expect(res.body.income_categories).toHaveLength(0);
      expect(res.body.expense_categories).toHaveLength(0);
    });

    it('rejects invalid year', async () => {
      const res = await request(app).get('/api/reports/profitability/by-category/invalid');
      expect(res.status).toBe(400);
    });
  });
});
