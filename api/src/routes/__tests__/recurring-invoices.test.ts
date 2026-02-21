/**
 * Recurring Invoices & Dunning API Tests
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
  TTL: {},
}));

import { createTestApp } from '../../test/app.js';
import recurringRouter from '../recurring-invoices.js';
import dunningRouter from '../dunning.js';
import request from 'supertest';
import express from 'express';

const app = express();
app.use(express.json());
app.use('/api/invoices/recurring', recurringRouter);
app.use('/api/dunning', dunningRouter);
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.statusCode ?? err.status ?? 500;
  res.status(status).json({ error: { code: err.code, message: err.message } });
});

const validTemplate = {
  name: 'Monthly Hosting',
  frequency: 'monthly',
  next_date: '2024-07-01',
  vat_rate: 19,
  payment_terms_days: 14,
  items: [{ description: 'Web Hosting', quantity: 1, unit: 'pauschal', unit_price: 100 }],
};

describe('Recurring Invoices API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import('../../database.js')) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  it('creates template', async () => {
    const res = await request(app).post('/api/invoices/recurring').send(validTemplate);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Monthly Hosting');
    expect(res.body.frequency).toBe('monthly');
    expect(res.body.is_active).toBe(1);
  });

  it('lists templates', async () => {
    await request(app).post('/api/invoices/recurring').send(validTemplate);
    await request(app).post('/api/invoices/recurring').send({ ...validTemplate, name: 'Quarterly', frequency: 'quarterly', next_date: '2024-10-01' });
    const res = await request(app).get('/api/invoices/recurring');
    expect(res.body.length).toBe(2);
  });

  it('generates invoice from template', async () => {
    const clientId = insertTestClient(testDb, { name: 'Hosting Client' });
    const createRes = await request(app).post('/api/invoices/recurring').send({ ...validTemplate, client_id: clientId });
    const genRes = await request(app).post(`/api/invoices/recurring/${createRes.body.id}/generate`);
    expect(genRes.status).toBe(201);
    expect(genRes.body.invoice_number).toBeDefined();
    expect(genRes.body.client_id).toBe(clientId);
    expect(genRes.body.subtotal).toBe(100);
    expect(genRes.body.recurring_invoice_id).toBe(createRes.body.id);
    // Template should advance
    const tplRes = await request(app).get(`/api/invoices/recurring/${createRes.body.id}`);
    expect(tplRes.body.generated_count).toBe(1);
    expect(tplRes.body.next_date).toBe('2024-08-01');
  });

  it('supports multi-VAT items', async () => {
    const createRes = await request(app).post('/api/invoices/recurring').send({
      name: 'Mixed VAT', frequency: 'monthly', next_date: '2024-07-01', vat_rate: 19,
      items: [
        { description: 'Dev', quantity: 10, unit: 'hours', unit_price: 100, vat_rate: 19 },
        { description: 'Books', quantity: 2, unit: 'pieces', unit_price: 50, vat_rate: 7 },
      ],
    });
    const genRes = await request(app).post(`/api/invoices/recurring/${createRes.body.id}/generate`);
    expect(genRes.body.subtotal).toBe(1100);
    expect(genRes.body.vat_amount).toBe(197);
    expect(genRes.body.total).toBe(1297);
  });

  it('processes due templates', async () => {
    const today = new Date().toISOString().split('T')[0];
    await request(app).post('/api/invoices/recurring').send({ ...validTemplate, next_date: today });
    await request(app).post('/api/invoices/recurring').send({ ...validTemplate, name: 'Future', next_date: '2099-01-01' });
    const res = await request(app).post('/api/invoices/recurring/process');
    expect(res.body.processed).toBe(1);
    expect(res.body.generated).toBe(1);
  });

  it('respects end_date', async () => {
    const today = new Date().toISOString().split('T')[0];
    await request(app).post('/api/invoices/recurring').send({ ...validTemplate, next_date: today, end_date: '2020-01-01' });
    const res = await request(app).post('/api/invoices/recurring/process');
    expect(res.body.processed).toBe(0);
  });

  it('respects is_active', async () => {
    const today = new Date().toISOString().split('T')[0];
    const createRes = await request(app).post('/api/invoices/recurring').send({ ...validTemplate, next_date: today });
    await request(app).patch(`/api/invoices/recurring/${createRes.body.id}`).send({ is_active: 0 });
    const res = await request(app).post('/api/invoices/recurring/process');
    expect(res.body.processed).toBe(0);
  });

  it('updates template', async () => {
    const createRes = await request(app).post('/api/invoices/recurring').send(validTemplate);
    const res = await request(app).patch(`/api/invoices/recurring/${createRes.body.id}`).send({ name: 'Updated', payment_terms_days: 30 });
    expect(res.body.name).toBe('Updated');
    expect(res.body.payment_terms_days).toBe(30);
  });

  it('deletes template', async () => {
    const createRes = await request(app).post('/api/invoices/recurring').send(validTemplate);
    await request(app).delete(`/api/invoices/recurring/${createRes.body.id}`);
    const getRes = await request(app).get(`/api/invoices/recurring/${createRes.body.id}`);
    expect(getRes.status).toBe(404);
  });

  it('calculates next_date for quarterly', async () => {
    const createRes = await request(app).post('/api/invoices/recurring').send({ ...validTemplate, frequency: 'quarterly', next_date: '2024-01-01' });
    await request(app).post(`/api/invoices/recurring/${createRes.body.id}/generate`);
    const tplRes = await request(app).get(`/api/invoices/recurring/${createRes.body.id}`);
    expect(tplRes.body.next_date).toBe('2024-04-01');
  });

  it('calculates next_date for yearly', async () => {
    const createRes = await request(app).post('/api/invoices/recurring').send({ ...validTemplate, frequency: 'yearly', next_date: '2024-01-01' });
    await request(app).post(`/api/invoices/recurring/${createRes.body.id}/generate`);
    const tplRes = await request(app).get(`/api/invoices/recurring/${createRes.body.id}`);
    expect(tplRes.body.next_date).toBe('2025-01-01');
  });
});

describe('Dunning API', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import('../../database.js')) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  it('returns overdue invoices', async () => {
    const clientId = insertTestClient(testDb, { name: 'Late Payer' });
    insertTestInvoice(testDb, { status: 'sent', client_id: clientId, due_date: '2020-01-01' });
    insertTestInvoice(testDb, { status: 'sent', client_id: clientId, due_date: '2099-12-31' });
    const res = await request(app).get('/api/dunning/overdue');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].client_name).toBe('Late Payer');
  });

  it('creates dunning entry (Zahlungserinnerung)', async () => {
    const invoiceId = insertTestInvoice(testDb, { status: 'sent', due_date: '2024-01-01', total: 1190 });
    const res = await request(app).post('/api/dunning').send({ invoice_id: invoiceId, level: 1 });
    expect(res.status).toBe(201);
    expect(res.body.level).toBe(1);
    const inv = testDb.prepare('SELECT dunning_level, status FROM invoices WHERE id = ?').get(invoiceId) as any;
    expect(inv.dunning_level).toBe(1);
    expect(inv.status).toBe('overdue');
  });

  it('prevents level repetition', async () => {
    const invoiceId = insertTestInvoice(testDb, { status: 'sent', due_date: '2024-01-01' });
    await request(app).post('/api/dunning').send({ invoice_id: invoiceId, level: 1 });
    const res = await request(app).post('/api/dunning').send({ invoice_id: invoiceId, level: 1 });
    expect(res.status).toBe(400);
  });

  it('supports escalation 1 → 2 → 3', async () => {
    const invoiceId = insertTestInvoice(testDb, { status: 'sent', due_date: '2024-01-01', total: 1000 });
    const l1 = await request(app).post('/api/dunning').send({ invoice_id: invoiceId, level: 1 });
    expect(l1.status).toBe(201);
    const l2 = await request(app).post('/api/dunning').send({ invoice_id: invoiceId, level: 2, fee: 5 });
    expect(l2.status).toBe(201);
    expect(l2.body.fee).toBe(5);
    const l3 = await request(app).post('/api/dunning').send({ invoice_id: invoiceId, level: 3, fee: 10, interest_rate: 5 });
    expect(l3.status).toBe(201);
    expect(l3.body.interest_amount).toBeGreaterThan(0);
  });

  it('rejects dunning for paid invoice', async () => {
    const invoiceId = insertTestInvoice(testDb, { status: 'paid' });
    const res = await request(app).post('/api/dunning').send({ invoice_id: invoiceId, level: 1 });
    expect(res.status).toBe(400);
  });

  it('marks as sent', async () => {
    const invoiceId = insertTestInvoice(testDb, { status: 'sent', due_date: '2024-01-01' });
    const createRes = await request(app).post('/api/dunning').send({ invoice_id: invoiceId });
    const res = await request(app).post(`/api/dunning/${createRes.body.id}/send`);
    expect(res.body.status).toBe('sent');
    expect(res.body.sent_date).toBeDefined();
  });

  it('returns templates', async () => {
    const res = await request(app).get('/api/dunning/templates');
    expect(res.body[1]).toBeDefined();
    expect(res.body[1].subject).toContain('Zahlungserinnerung');
  });

  it('lists dunning entries', async () => {
    const invoiceId = insertTestInvoice(testDb, { status: 'sent', due_date: '2024-01-01' });
    await request(app).post('/api/dunning').send({ invoice_id: invoiceId, level: 1 });
    const res = await request(app).get('/api/dunning');
    expect(res.body.length).toBe(1);
  });
});
