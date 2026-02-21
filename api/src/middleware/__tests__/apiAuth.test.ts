/**
 * API Authentication Middleware Tests
 *
 * Tests API key validation, scope enforcement, and error responses.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import express from 'express';
import { createTestDb, resetIdCounter } from '../../test/setup.js';
import { generateApiKey } from '../../services/apiKeyService.js';

let testDb: Database.Database;

// Mock the database module
vi.mock('../../database.js', () => {
  let _db: Database.Database | null = null;
  return {
    getDb: () => {
      if (!_db) throw new Error('Test DB not initialized');
      return _db;
    },
    generateId: () => crypto.randomUUID(),
    getCurrentTimestamp: () => new Date().toISOString(),
    __setTestDb: (db: Database.Database) => { _db = db; },
  };
});

// Mock pdfService to avoid Puppeteer
vi.mock('../../services/pdfService.js', () => ({
  generateInvoicePdf: vi.fn(async () => '/tmp/test.pdf'),
  generateInvoicePdfBuffer: vi.fn(async () => Buffer.from('fake-pdf')),
  getInvoicePdfPath: vi.fn((p: string) => p),
  invoicePdfExists: vi.fn(() => false),
  deleteInvoicePdf: vi.fn(async () => {}),
  getDefaultSeller: vi.fn(() => ({ name: 'Test Seller' })),
}));

import v1Router from '../../routes/v1/index.js';

function createAuthTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', v1Router);
  return app;
}

const app = createAuthTestApp();

describe('API Authentication', () => {
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

  it('rejects requests without Authorization header', async () => {
    const res = await request(app).get('/api/v1/invoices');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with empty Bearer token', async () => {
    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with non-Bearer auth', async () => {
    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects invalid API keys', async () => {
    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', 'Bearer pk_test_invalid_key_that_does_not_exist');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_API_KEY');
  });

  it('accepts valid API keys', async () => {
    const { key } = generateApiKey(testDb, 'Test Key', ['read', 'write']);
    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects revoked API keys', async () => {
    const { key, apiKey } = generateApiKey(testDb, 'Revoked Key', ['read', 'write']);

    // Revoke the key
    testDb.prepare('UPDATE api_keys SET is_active = 0 WHERE id = ?').run(apiKey.id);

    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_API_KEY');
  });

  it('rejects expired API keys', async () => {
    const { key, apiKey } = generateApiKey(testDb, 'Expired Key', ['read', 'write']);

    // Set expiry to the past
    testDb.prepare('UPDATE api_keys SET expires_at = ? WHERE id = ?')
      .run('2020-01-01T00:00:00.000Z', apiKey.id);

    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_API_KEY');
  });

  it('enforces scope requirements — read-only key on reports (read scope)', async () => {
    const { key } = generateApiKey(testDb, 'Read Only', ['read']);
    const res = await request(app)
      .get('/api/v1/reports/euer?year=2024')
      .set('Authorization', `Bearer ${key}`);
    // Reports require 'read' scope — should succeed
    expect(res.status).toBe(200);
  });

  it('enforces scope requirements — read-only key cannot access write endpoints', async () => {
    // Create a key with only 'admin' scope (no read or write)
    const { key } = generateApiKey(testDb, 'Admin Only', ['admin']);
    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key}`);
    // The per-resource middleware requires ['read', 'write'] — admin has neither
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('updates last_used_at on successful validation', async () => {
    const { key, apiKey } = generateApiKey(testDb, 'Timestamp Key', ['read', 'write']);

    // Initially null
    const before = testDb.prepare('SELECT last_used_at FROM api_keys WHERE id = ?').get(apiKey.id) as any;
    expect(before.last_used_at).toBeNull();

    await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key}`);

    const after = testDb.prepare('SELECT last_used_at FROM api_keys WHERE id = ?').get(apiKey.id) as any;
    expect(after.last_used_at).not.toBeNull();
  });

  it('returns consistent error envelope format', async () => {
    const res = await request(app).get('/api/v1/invoices');
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });
});
