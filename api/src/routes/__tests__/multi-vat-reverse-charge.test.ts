/**
 * Multi-VAT Invoice & Reverse Charge Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
  createTestDb,
  resetIdCounter,
  insertTestClient,
  insertTestIncome,
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

vi.mock('../../services/pdfService.js', () => ({
  generateInvoicePdf: vi.fn().mockResolvedValue('2024/01/test.pdf'),
  generateInvoicePdfBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-pdf')),
  getInvoicePdfPath: vi.fn().mockReturnValue('/tmp/test.pdf'),
  invoicePdfExists: vi.fn().mockReturnValue(false),
  deleteInvoicePdf: vi.fn().mockResolvedValue(true),
  getDefaultSeller: vi.fn().mockReturnValue({
    name: 'Test Seller', title: 'Dev',
    address: { street: 'Test St 1', zip: '12345', city: 'Berlin' },
    email: 'test@example.com', vatId: 'DE123456789',
    bank: { name: 'Test Bank', iban: 'DE12 3456 7890', bic: 'TESTDEFFXXX' },
  }),
  closeBrowser: vi.fn(),
}));

import invoicesRouter from '../invoices.js';
import reportsRouter from '../reports.js';
import request from 'supertest';
import express from 'express';

const app = express();
app.use(express.json());
app.use('/api/invoices', invoicesRouter);
app.use('/api/reports', reportsRouter);
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.statusCode ?? err.status ?? 500;
  res.status(status).json({ error: { code: err.code, message: err.message } });
});

describe('Multi-VAT Invoices', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import('../../database.js')) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  it('creates invoice with mixed VAT rates', async () => {
    const res = await request(app).post('/api/invoices').send({
      items: [
        { description: 'Dev', quantity: 10, unit: 'hours', unit_price: 100, vat_rate: 19 },
        { description: 'Books', quantity: 3, unit: 'pieces', unit_price: 50, vat_rate: 7 },
        { description: 'EU Service', quantity: 1, unit: 'pauschal', unit_price: 200, vat_rate: 0 },
      ],
      vat_rate: 19,
    });
    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(1350);
    expect(res.body.vat_amount).toBe(200.5);
    expect(res.body.total).toBe(1550.5);
  });

  it('stores per-item VAT rates', async () => {
    const res = await request(app).post('/api/invoices').send({
      items: [
        { description: 'Dev', quantity: 1, unit_price: 100, vat_rate: 19 },
        { description: 'Tax-free', quantity: 1, unit_price: 50, vat_rate: 0 },
      ],
      vat_rate: 19,
    });
    expect(res.status).toBe(201);
    const items = testDb.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(res.body.id) as Array<{
      description: string; vat_rate: number; vat_amount: number; net_amount: number;
    }>;
    expect(items.length).toBe(2);
    const devItem = items.find(i => i.description === 'Dev')!;
    expect(devItem.vat_rate).toBe(19);
    expect(devItem.vat_amount).toBe(19);
    const freeItem = items.find(i => i.description === 'Tax-free')!;
    expect(freeItem.vat_rate).toBe(0);
    expect(freeItem.vat_amount).toBe(0);
  });

  it('uses invoice-level VAT when item vat_rate not specified', async () => {
    const res = await request(app).post('/api/invoices').send({
      vat_rate: 7,
      items: [{ description: 'Item A', quantity: 1, unit_price: 100 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.vat_amount).toBe(7);
  });
});

describe('Reverse Charge', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import('../../database.js')) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  it('auto-detects for EU B2B clients', async () => {
    const clientId = insertTestClient(testDb, { name: 'EU Corp' });
    testDb.prepare('UPDATE clients SET client_type = ?, vat_id = ? WHERE id = ?').run('eu_b2b', 'FR12345678901', clientId);
    const res = await request(app).post('/api/invoices').send({
      client_id: clientId,
      items: [{ description: 'Consulting', quantity: 10, unit_price: 150, vat_rate: 19 }],
      vat_rate: 19,
    });
    expect(res.status).toBe(201);
    expect(res.body.is_reverse_charge).toBe(1);
    expect(res.body.reverse_charge_note).toContain('§13b');
    expect(res.body.vat_amount).toBe(0);
    expect(res.body.total).toBe(1500);
  });

  it('normal VAT for domestic clients', async () => {
    const clientId = insertTestClient(testDb);
    testDb.prepare('UPDATE clients SET client_type = ? WHERE id = ?').run('domestic', clientId);
    const res = await request(app).post('/api/invoices').send({
      client_id: clientId,
      items: [{ description: 'Dev', quantity: 1, unit_price: 100 }],
      vat_rate: 19,
    });
    expect(res.body.is_reverse_charge).toBe(0);
    expect(res.body.vat_amount).toBe(19);
  });

  it('USt-VA includes reverse charge separately', async () => {
    insertTestIncome(testDb, { date: '2024-01-15', net_amount: 1000, vat_rate: 19, vat_amount: 190, gross_amount: 1190 });
    const rcId = testId('income-rc');
    testDb.prepare(
      `INSERT INTO income (id, date, description, net_amount, vat_rate, vat_amount, gross_amount, euer_line, euer_category, is_reverse_charge, reverse_charge_note, created_at)
       VALUES (?, '2024-02-15', 'EU Consulting', 5000, 0, 0, 5000, 14, 'services', 1, 'Reverse Charge §13b', datetime('now'))`
    ).run(rcId);
    const res = await request(app).get('/api/reports/ust/2024/1');
    expect(res.body.umsatzsteuer19).toBe(190);
    expect(res.body.reverseChargeNet).toBe(5000);
    expect(res.body.reverseChargeCount).toBe(1);
    expect(res.body.totalUmsatzsteuer).toBe(190);
  });
});

describe('Client Types', () => {
  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import('../../database.js')) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();
  });

  it('default client_type is domestic', async () => {
    const clientId = insertTestClient(testDb);
    const client = testDb.prepare('SELECT client_type FROM clients WHERE id = ?').get(clientId) as { client_type: string };
    expect(client.client_type).toBe('domestic');
  });
});
