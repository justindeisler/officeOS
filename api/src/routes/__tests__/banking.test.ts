/**
 * Banking API Tests
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestClient,
  insertTestInvoice,
  testId,
} from '../../test/setup.js';

let testDb: Database.Database;

vi.mock('../../database.js', () => {
  let _db: Database.Database | null = null;
  return {
    getDb: () => { if (!_db) throw new Error('Test DB not initialized'); return _db; },
    generateId: () => crypto.randomUUID(),
    getCurrentTimestamp: () => new Date().toISOString(),
    __setTestDb: (db: Database.Database) => { _db = db; },
  };
});

vi.mock('../../cache.js', () => ({
  cache: { get: vi.fn(() => null), set: vi.fn(), invalidate: vi.fn() },
  cacheKey: (...p: unknown[]) => p.join(':'),
  TTL: { INCOME: 600000, EXPENSES: 600000 },
}));

import { createTestApp } from '../../test/app.js';
import bankingRouter from '../banking.js';
import bookingRulesRouter from '../booking-rules.js';
import request from 'supertest';
import express from 'express';

const appExpress = express();
appExpress.use(express.json());
appExpress.use('/api/banking', bankingRouter);
appExpress.use('/api/booking-rules', bookingRulesRouter);
appExpress.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.statusCode ?? err.status ?? 500;
  res.status(status).json({ error: { code: err.code ?? 'INTERNAL_ERROR', message: err.message ?? 'Internal Server Error' } });
});

// Helpers

function insertTestBankAccount(overrides: Partial<{ id: string; bank_name: string; iban: string }> = {}): string {
  const id = overrides.id ?? testId('ba');
  testDb.prepare(
    `INSERT INTO bank_accounts (id, provider, bank_name, iban, account_name, account_type, balance, currency, created_at, updated_at)
     VALUES (?, 'manual', ?, ?, 'Test', 'checking', 1000, 'EUR', datetime('now'), datetime('now'))`
  ).run(id, overrides.bank_name ?? 'Test Bank', overrides.iban ?? 'DE89370400440532013000');
  return id;
}

function insertTestBankTransaction(accountId: string, overrides: Partial<{
  id: string; amount: number; counterpart_name: string; purpose: string; booking_date: string; match_status: string;
}> = {}): string {
  const id = overrides.id ?? testId('bt');
  testDb.prepare(
    `INSERT INTO bank_transactions (id, account_id, amount, booking_date, counterpart_name, purpose, match_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(id, accountId, overrides.amount ?? -50, overrides.booking_date ?? '2024-06-15',
    overrides.counterpart_name ?? 'Test Vendor', overrides.purpose ?? 'Test payment', overrides.match_status ?? 'unmatched');
  return id;
}

describe('Banking API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import('../../database.js')) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  describe('Bank Accounts', () => {
    it('GET /api/banking/accounts - returns empty list', async () => {
      const res = await request(appExpress).get('/api/banking/accounts');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('POST /api/banking/accounts/connect - creates bank account', async () => {
      const res = await request(appExpress).post('/api/banking/accounts/connect')
        .send({ bank_name: 'Deutsche Bank', iban: 'DE89370400440532013000' });
      expect(res.status).toBe(201);
      expect(res.body.bank_name).toBe('Deutsche Bank');
    });

    it('DELETE /api/banking/accounts/:id - deactivates account', async () => {
      const accountId = insertTestBankAccount();
      const res = await request(appExpress).delete(`/api/banking/accounts/${accountId}`);
      expect(res.status).toBe(200);
      const listRes = await request(appExpress).get('/api/banking/accounts');
      expect(listRes.body).toEqual([]);
    });

    it('DELETE /api/banking/accounts/:id - returns 404 for missing', async () => {
      const res = await request(appExpress).delete('/api/banking/accounts/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('Transactions', () => {
    it('GET /api/banking/transactions - returns transactions', async () => {
      const accountId = insertTestBankAccount();
      insertTestBankTransaction(accountId, { amount: -100 });
      insertTestBankTransaction(accountId, { amount: 500 });
      const res = await request(appExpress).get('/api/banking/transactions');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it('GET /api/banking/transactions - filters by date range', async () => {
      const accountId = insertTestBankAccount();
      insertTestBankTransaction(accountId, { booking_date: '2024-01-01' });
      insertTestBankTransaction(accountId, { booking_date: '2024-06-15' });
      insertTestBankTransaction(accountId, { booking_date: '2024-12-31' });
      const res = await request(appExpress).get('/api/banking/transactions').query({ start_date: '2024-06-01', end_date: '2024-06-30' });
      expect(res.body.length).toBe(1);
    });

    it('GET /api/banking/transactions/unmatched - returns only unmatched', async () => {
      const accountId = insertTestBankAccount();
      insertTestBankTransaction(accountId, { match_status: 'unmatched' });
      insertTestBankTransaction(accountId, { match_status: 'booked' });
      insertTestBankTransaction(accountId, { match_status: 'unmatched' });
      const res = await request(appExpress).get('/api/banking/transactions/unmatched');
      expect(res.body.length).toBe(2);
    });
  });

  describe('Auto-Matching', () => {
    it('matches by exact invoice amount', async () => {
      const clientId = insertTestClient(testDb, { name: 'Acme Corp' });
      insertTestInvoice(testDb, { status: 'sent', client_id: clientId, subtotal: 1000, vat_rate: 19, vat_amount: 190, total: 1190 });
      const accountId = insertTestBankAccount();
      insertTestBankTransaction(accountId, { amount: 1190, counterpart_name: 'Acme Corp' });
      const res = await request(appExpress).post('/api/banking/transactions/auto-match');
      expect(res.status).toBe(200);
      expect(res.body.matched).toBe(1);
      expect(res.body.matches[0].match_type).toBe('invoice');
      expect(res.body.matches[0].confidence).toBeGreaterThanOrEqual(0.90);
    });

    it('matches by invoice number in purpose', async () => {
      insertTestInvoice(testDb, { invoice_number: 'RE-2024-042', status: 'sent', total: 595 });
      const accountId = insertTestBankAccount();
      insertTestBankTransaction(accountId, { amount: 595, purpose: 'Zahlung RE-2024-042' });
      const res = await request(appExpress).post('/api/banking/transactions/auto-match');
      expect(res.body.matched).toBe(1);
      expect(res.body.matches[0].reason).toContain('RE-2024-042');
    });

    it('matches by booking rule', async () => {
      const accountId = insertTestBankAccount();
      insertTestBankTransaction(accountId, { amount: -29.99, counterpart_name: 'NETFLIX' });
      testDb.prepare(
        `INSERT INTO booking_rules (id, name, priority, is_active, condition_counterpart_pattern, action_category, action_vat_rate, action_match_type, created_at, updated_at)
         VALUES (?, 'Netflix', 10, 1, 'netflix', 'software', 19, 'expense', datetime('now'), datetime('now'))`
      ).run(testId('rule'));
      const res = await request(appExpress).post('/api/banking/transactions/auto-match');
      expect(res.body.matched).toBe(1);
      expect(res.body.matches[0].match_type).toBe('rule');
    });

    it('does not match already matched transactions', async () => {
      const accountId = insertTestBankAccount();
      insertTestBankTransaction(accountId, { match_status: 'booked', amount: -50 });
      const res = await request(appExpress).post('/api/banking/transactions/auto-match');
      expect(res.body.total_processed).toBe(0);
    });
  });

  describe('Manual Matching', () => {
    it('matches to invoice and marks as paid', async () => {
      const clientId = insertTestClient(testDb);
      const invoiceId = insertTestInvoice(testDb, { status: 'sent', client_id: clientId, total: 1190 });
      const accountId = insertTestBankAccount();
      const txId = insertTestBankTransaction(accountId, { amount: 1190 });
      const res = await request(appExpress).post(`/api/banking/transactions/${txId}/match`).send({ match_type: 'invoice', matched_id: invoiceId });
      expect(res.status).toBe(200);
      expect(res.body.match_status).toBe('booked');
      const inv = testDb.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as { status: string };
      expect(inv.status).toBe('paid');
    });

    it('ignores transaction', async () => {
      const accountId = insertTestBankAccount();
      const txId = insertTestBankTransaction(accountId);
      const res = await request(appExpress).post(`/api/banking/transactions/${txId}/ignore`).send({ reason: 'Personal' });
      expect(res.body.match_status).toBe('ignored');
    });
  });

  describe('Create from Transaction', () => {
    it('creates expense from debit transaction', async () => {
      const accountId = insertTestBankAccount();
      const txId = insertTestBankTransaction(accountId, { amount: -119, counterpart_name: 'Office GmbH' });
      const res = await request(appExpress).post(`/api/banking/transactions/${txId}/create-expense`).send({ category: 'office_supplies', vat_rate: 19 });
      expect(res.status).toBe(201);
      expect(res.body.expense.gross_amount).toBe(119);
      expect(res.body.transaction.match_status).toBe('booked');
    });

    it('creates income from credit transaction', async () => {
      const accountId = insertTestBankAccount();
      const txId = insertTestBankTransaction(accountId, { amount: 2380 });
      const res = await request(appExpress).post(`/api/banking/transactions/${txId}/create-income`).send({ description: 'Consulting', vat_rate: 19 });
      expect(res.status).toBe(201);
      expect(res.body.income.gross_amount).toBe(2380);
      expect(res.body.transaction.match_status).toBe('booked');
    });
  });

  describe('Sync', () => {
    it('imports transactions', async () => {
      const accountId = insertTestBankAccount();
      const res = await request(appExpress).post(`/api/banking/accounts/${accountId}/sync`).send({
        transactions: [
          { amount: -50, booking_date: '2024-06-01', counterpart_name: 'Vendor A' },
          { amount: 1000, booking_date: '2024-06-15', counterpart_name: 'Client B' },
        ],
      });
      expect(res.body.transactions_imported).toBe(2);
    });

    it('skips duplicates', async () => {
      const accountId = insertTestBankAccount();
      await request(appExpress).post(`/api/banking/accounts/${accountId}/sync`).send({
        transactions: [{ provider_transaction_id: 'TX-001', amount: -50, booking_date: '2024-06-01' }],
      });
      const res = await request(appExpress).post(`/api/banking/accounts/${accountId}/sync`).send({
        transactions: [
          { provider_transaction_id: 'TX-001', amount: -50, booking_date: '2024-06-01' },
          { provider_transaction_id: 'TX-002', amount: -100, booking_date: '2024-06-02' },
        ],
      });
      expect(res.body.transactions_imported).toBe(1);
      expect(res.body.duplicates_skipped).toBe(1);
    });
  });

  describe('SEPA Export', () => {
    it('generates valid SEPA XML', async () => {
      const res = await request(appExpress).post('/api/banking/sepa/generate').send({
        payments: [{ recipient_name: 'Vendor GmbH', recipient_iban: 'DE89370400440532013000', amount: 500, purpose: 'Invoice 2024-001' }],
        debtor: { name: 'Justin Deisler', iban: 'DE12345678901234567890', bic: 'COBADEFFXXX' },
      });
      expect(res.status).toBe(200);
      expect(res.text).toContain('pain.001.001.03');
      expect(res.text).toContain('Vendor GmbH');
      expect(res.text).toContain('500.00');
    });
  });
});

describe('Booking Rules API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import('../../database.js')) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  it('creates a rule', async () => {
    const res = await request(appExpress).post('/api/booking-rules')
      .send({ name: 'Netflix', condition_counterpart_pattern: 'netflix', action_category: 'software', action_vat_rate: 19 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Netflix');
  });

  it('lists rules ordered by priority', async () => {
    testDb.prepare(`INSERT INTO booking_rules (id, name, priority, is_active, created_at, updated_at) VALUES (?, 'B', 200, 1, datetime('now'), datetime('now'))`).run(testId('rule'));
    testDb.prepare(`INSERT INTO booking_rules (id, name, priority, is_active, created_at, updated_at) VALUES (?, 'A', 100, 1, datetime('now'), datetime('now'))`).run(testId('rule'));
    const res = await request(appExpress).get('/api/booking-rules');
    expect(res.body.length).toBe(2);
    expect(res.body[0].name).toBe('A');
  });

  it('updates a rule', async () => {
    const ruleId = testId('rule');
    testDb.prepare(`INSERT INTO booking_rules (id, name, priority, is_active, created_at, updated_at) VALUES (?, 'Old', 100, 1, datetime('now'), datetime('now'))`).run(ruleId);
    const res = await request(appExpress).patch(`/api/booking-rules/${ruleId}`).send({ name: 'New', priority: 50 });
    expect(res.body.name).toBe('New');
    expect(res.body.priority).toBe(50);
  });

  it('deletes a rule', async () => {
    const ruleId = testId('rule');
    testDb.prepare(`INSERT INTO booking_rules (id, name, priority, is_active, created_at, updated_at) VALUES (?, 'Del', 100, 1, datetime('now'), datetime('now'))`).run(ruleId);
    const res = await request(appExpress).delete(`/api/booking-rules/${ruleId}`);
    expect(res.status).toBe(200);
    expect(testDb.prepare('SELECT * FROM booking_rules WHERE id = ?').get(ruleId)).toBeUndefined();
  });

  it('previews rule matches', async () => {
    const accountId = insertTestBankAccount();
    insertTestBankTransaction(accountId, { counterpart_name: 'NETFLIX', amount: -14.99 });
    insertTestBankTransaction(accountId, { counterpart_name: 'Amazon', amount: -29.99 });
    insertTestBankTransaction(accountId, { counterpart_name: 'NETFLIX', amount: -14.99 });
    const res = await request(appExpress).post('/api/booking-rules/test')
      .send({ rule: { condition_counterpart_pattern: 'netflix', condition_direction: 'debit' } });
    expect(res.body.would_match).toBe(2);
    expect(res.body.total_unmatched).toBe(3);
  });
});
