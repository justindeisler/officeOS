/**
 * Rate Limiter Middleware Tests
 *
 * Tests per-key rate limiting, request logging, and rate limit headers.
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

function createRateLimitTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', v1Router);
  return app;
}

const app = createRateLimitTestApp();

describe('Rate Limiting', () => {
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

  it('allows requests under the limit', async () => {
    const { key } = generateApiKey(testDb, 'Test', ['read', 'write'], 5);

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${key}`);
      expect(res.status).toBe(200);
    }
  });

  it('blocks requests over the limit', async () => {
    const { key } = generateApiKey(testDb, 'Test', ['read', 'write'], 2);

    // Use up the limit
    await request(app).get('/api/v1/invoices').set('Authorization', `Bearer ${key}`);
    await request(app).get('/api/v1/invoices').set('Authorization', `Bearer ${key}`);

    // This should be blocked
    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key}`);

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(res.body.error.details).toHaveProperty('limit', 2);
    expect(res.body.error.details).toHaveProperty('retry_after', 60);
  });

  it('sets rate limit headers on successful requests', async () => {
    const { key } = generateApiKey(testDb, 'Test', ['read', 'write'], 100);

    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key}`);

    expect(res.status).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('100');
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('decrements remaining count correctly', async () => {
    const { key } = generateApiKey(testDb, 'Test', ['read', 'write'], 10);

    const res1 = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key}`);
    expect(res1.headers['x-ratelimit-remaining']).toBe('9');

    const res2 = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key}`);
    expect(res2.headers['x-ratelimit-remaining']).toBe('8');
  });

  it('sets rate limit headers on 429 responses', async () => {
    const { key } = generateApiKey(testDb, 'Test', ['read', 'write'], 1);

    await request(app).get('/api/v1/invoices').set('Authorization', `Bearer ${key}`);

    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key}`);

    expect(res.status).toBe(429);
    expect(res.headers['x-ratelimit-limit']).toBe('1');
    expect(res.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('logs requests in the api_requests table', async () => {
    const { key, apiKey } = generateApiKey(testDb, 'Logger', ['read', 'write'], 100);

    await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key}`);

    const logs = testDb.prepare('SELECT * FROM api_requests WHERE api_key_id = ?').all(apiKey.id) as any[];
    expect(logs).toHaveLength(1);
    expect(logs[0].method).toBe('GET');
    expect(logs[0].endpoint).toBe('/api/v1/invoices');
    expect(logs[0].status_code).toBe(200);
    expect(logs[0].response_time_ms).toBeGreaterThanOrEqual(0);
  });

  it('different keys have independent rate limits', async () => {
    const key1 = generateApiKey(testDb, 'Key1', ['read', 'write'], 1);
    const key2 = generateApiKey(testDb, 'Key2', ['read', 'write'], 1);

    // Use up key1's limit
    await request(app).get('/api/v1/invoices').set('Authorization', `Bearer ${key1.key}`);

    // key1 should be blocked
    const res1 = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key1.key}`);
    expect(res1.status).toBe(429);

    // key2 should still work
    const res2 = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${key2.key}`);
    expect(res2.status).toBe(200);
  });
});
