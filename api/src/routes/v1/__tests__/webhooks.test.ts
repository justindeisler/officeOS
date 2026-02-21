/**
 * Public REST API v1 — Webhook Route Tests
 *
 * Tests CRUD endpoints, validation, auth scoping, and delivery history.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import express from 'express';
import { createTestDb, resetIdCounter } from '../../../test/setup.js';
import { ensureWebhookTables, createWebhook, createDelivery } from '../../../services/webhookService.js';
import { generateApiKey } from '../../../services/apiKeyService.js';

let testDb: Database.Database;
let apiKeyValue: string; // the raw key for Bearer auth

vi.mock('../../../database.js', () => {
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

import { apiAuthMiddleware } from '../../../middleware/apiAuth.js';
import webhooksRouter from '../webhooks.js';

// Create an app with API auth middleware (mimicking v1 router)
function createWebhookApp() {
  const app = express();
  app.use(express.json());
  app.use(apiAuthMiddleware(['read', 'write']));
  app.use('/api/v1/webhooks', webhooksRouter);
  app.use(
    (err: any, _req: any, res: any, _next: any) => {
      res.status(err.statusCode ?? 500).json({
        error: { code: err.code ?? 'INTERNAL_ERROR', message: err.message },
      });
    }
  );
  return app;
}

describe('V1 Webhooks API', () => {
  let app: any;

  beforeEach(async () => {
    testDb = createTestDb();
    const dbModule = (await import('../../../database.js')) as any;
    dbModule.__setTestDb(testDb);
    resetIdCounter();

    ensureWebhookTables(testDb);

    // Create an API key for auth
    const { key } = generateApiKey(testDb, 'test-key', ['read', 'write']);
    apiKeyValue = key;

    app = createWebhookApp();
  });

  afterAll(() => {
    if (testDb) testDb.close();
    vi.restoreAllMocks();
  });

  // Helper for authenticated requests
  function authedGet(url: string) {
    return request(app).get(url).set('Authorization', `Bearer ${apiKeyValue}`);
  }
  function authedPost(url: string) {
    return request(app).post(url).set('Authorization', `Bearer ${apiKeyValue}`);
  }
  function authedPatch(url: string) {
    return request(app).patch(url).set('Authorization', `Bearer ${apiKeyValue}`);
  }
  function authedDelete(url: string) {
    return request(app).delete(url).set('Authorization', `Bearer ${apiKeyValue}`);
  }

  // ========== LIST ==========

  describe('GET /api/v1/webhooks', () => {
    it('returns empty list initially', async () => {
      const res = await authedGet('/api/v1/webhooks');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns webhooks for authenticated API key', async () => {
      // Get the API key ID
      const apiKey = testDb.prepare('SELECT * FROM api_keys WHERE is_active = 1').get() as any;
      createWebhook(testDb, apiKey.id, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
        description: 'Test',
      });

      const res = await authedGet('/api/v1/webhooks');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].url).toBe('https://example.com/hook');
      // Secret should be masked
      expect(res.body.data[0].secret).toMatch(/^whsec_\w{4}\.\.\.$/);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/webhooks');
      expect(res.status).toBe(401);
    });
  });

  // ========== LIST EVENTS ==========

  describe('GET /api/v1/webhooks/events', () => {
    it('returns available event types', async () => {
      const res = await authedGet('/api/v1/webhooks/events');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toContain('invoice.created');
      expect(res.body.data).toContain('task.completed');
      expect(res.body.data.length).toBeGreaterThan(10);
    });
  });

  // ========== CREATE ==========

  describe('POST /api/v1/webhooks', () => {
    it('creates a webhook and returns full secret', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({
          url: 'https://example.com/hook',
          events: ['invoice.created', 'invoice.paid'],
          description: 'My webhook',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeTruthy();
      expect(res.body.data.url).toBe('https://example.com/hook');
      expect(res.body.data.secret).toMatch(/^whsec_/);
      expect(res.body.data.secret.length).toBeGreaterThan(20); // full secret
      expect(res.body.data.events).toEqual(['invoice.created', 'invoice.paid']);
      expect(res.body.data.is_active).toBe(1);
      expect(res.body.data.description).toBe('My webhook');
    });

    it('rejects missing URL', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ events: ['invoice.created'] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid URL', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'not-a-url', events: ['invoice.created'] });
      expect(res.status).toBe(400);
    });

    it('rejects non-http/https URL', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'ftp://example.com/hook', events: ['invoice.created'] });
      expect(res.status).toBe(400);
    });

    it('rejects missing events', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'https://example.com/hook' });
      expect(res.status).toBe(400);
    });

    it('rejects empty events array', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'https://example.com/hook', events: [] });
      expect(res.status).toBe(400);
    });

    it('rejects invalid event type', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'https://example.com/hook', events: ['invalid.event'] });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid event type');
    });

    it('accepts wildcard event', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'https://example.com/hook', events: ['*'] });
      expect(res.status).toBe(201);
      expect(res.body.data.events).toEqual(['*']);
    });

    // SSRF Protection
    it('rejects localhost webhook URL', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'https://localhost/hook', events: ['invoice.created'] });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('private');
    });

    it('rejects 127.0.0.1 webhook URL', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'http://127.0.0.1:3000/hook', events: ['invoice.created'] });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('private');
    });

    it('rejects 10.x.x.x webhook URL', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'http://10.0.0.1/hook', events: ['invoice.created'] });
      expect(res.status).toBe(400);
    });

    it('rejects 192.168.x.x webhook URL', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'http://192.168.1.100/hook', events: ['invoice.created'] });
      expect(res.status).toBe(400);
    });

    it('rejects 169.254.x.x (cloud metadata) webhook URL', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'http://169.254.169.254/latest/meta-data/', events: ['invoice.created'] });
      expect(res.status).toBe(400);
    });

    it('rejects 172.16.x.x webhook URL', async () => {
      const res = await authedPost('/api/v1/webhooks')
        .send({ url: 'http://172.16.0.1/hook', events: ['invoice.created'] });
      expect(res.status).toBe(400);
    });
  });

  // ========== GET BY ID ==========

  describe('GET /api/v1/webhooks/:id', () => {
    it('returns webhook details', async () => {
      const apiKey = testDb.prepare('SELECT * FROM api_keys WHERE is_active = 1').get() as any;
      const webhook = createWebhook(testDb, apiKey.id, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const res = await authedGet(`/api/v1/webhooks/${webhook.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(webhook.id);
      // Secret masked
      expect(res.body.data.secret).toMatch(/\.\.\.$/);
    });

    it('returns 404 for non-existent webhook', async () => {
      const res = await authedGet('/api/v1/webhooks/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns 404 for webhook owned by different API key', async () => {
      const { apiKey: otherKey } = generateApiKey(testDb, 'other-key');
      const webhook = createWebhook(testDb, otherKey.id, {
        url: 'https://other.com/hook',
        events: ['invoice.created'],
      });

      const res = await authedGet(`/api/v1/webhooks/${webhook.id}`);
      expect(res.status).toBe(404);
    });
  });

  // ========== UPDATE ==========

  describe('PATCH /api/v1/webhooks/:id', () => {
    it('updates webhook URL', async () => {
      const apiKey = testDb.prepare('SELECT * FROM api_keys WHERE is_active = 1').get() as any;
      const webhook = createWebhook(testDb, apiKey.id, {
        url: 'https://old.com/hook',
        events: ['invoice.created'],
      });

      const res = await authedPatch(`/api/v1/webhooks/${webhook.id}`)
        .send({ url: 'https://new.com/hook' });

      expect(res.status).toBe(200);
      expect(res.body.data.url).toBe('https://new.com/hook');
    });

    it('updates webhook events', async () => {
      const apiKey = testDb.prepare('SELECT * FROM api_keys WHERE is_active = 1').get() as any;
      const webhook = createWebhook(testDb, apiKey.id, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const res = await authedPatch(`/api/v1/webhooks/${webhook.id}`)
        .send({ events: ['invoice.created', 'expense.created'] });

      expect(res.status).toBe(200);
      expect(res.body.data.events).toEqual(['invoice.created', 'expense.created']);
    });

    it('deactivates webhook', async () => {
      const apiKey = testDb.prepare('SELECT * FROM api_keys WHERE is_active = 1').get() as any;
      const webhook = createWebhook(testDb, apiKey.id, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const res = await authedPatch(`/api/v1/webhooks/${webhook.id}`)
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.data.is_active).toBe(0);
    });

    it('returns 404 for non-existent webhook', async () => {
      const res = await authedPatch('/api/v1/webhooks/nonexistent')
        .send({ url: 'https://new.com/hook' });
      expect(res.status).toBe(404);
    });

    it('rejects invalid URL', async () => {
      const apiKey = testDb.prepare('SELECT * FROM api_keys WHERE is_active = 1').get() as any;
      const webhook = createWebhook(testDb, apiKey.id, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const res = await authedPatch(`/api/v1/webhooks/${webhook.id}`)
        .send({ url: 'not-a-url' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid event type', async () => {
      const apiKey = testDb.prepare('SELECT * FROM api_keys WHERE is_active = 1').get() as any;
      const webhook = createWebhook(testDb, apiKey.id, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const res = await authedPatch(`/api/v1/webhooks/${webhook.id}`)
        .send({ events: ['invalid.event'] });
      expect(res.status).toBe(400);
    });

    it('rejects private IP in URL update', async () => {
      const apiKey = testDb.prepare('SELECT * FROM api_keys WHERE is_active = 1').get() as any;
      const webhook = createWebhook(testDb, apiKey.id, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const res = await authedPatch(`/api/v1/webhooks/${webhook.id}`)
        .send({ url: 'http://192.168.1.1/hook' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('private');
    });
  });

  // ========== DELETE ==========

  describe('DELETE /api/v1/webhooks/:id', () => {
    it('deletes webhook', async () => {
      const apiKey = testDb.prepare('SELECT * FROM api_keys WHERE is_active = 1').get() as any;
      const webhook = createWebhook(testDb, apiKey.id, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const res = await authedDelete(`/api/v1/webhooks/${webhook.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);

      // Verify it's gone
      const check = await authedGet(`/api/v1/webhooks/${webhook.id}`);
      expect(check.status).toBe(404);
    });

    it('returns 404 for non-existent webhook', async () => {
      const res = await authedDelete('/api/v1/webhooks/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ========== DELIVERIES ==========

  describe('GET /api/v1/webhooks/:id/deliveries', () => {
    it('returns delivery history', async () => {
      const apiKey = testDb.prepare('SELECT * FROM api_keys WHERE is_active = 1').get() as any;
      const webhook = createWebhook(testDb, apiKey.id, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      createDelivery(testDb, webhook.id, 'invoice.created', { id: '1' });
      createDelivery(testDb, webhook.id, 'invoice.created', { id: '2' });

      const res = await authedGet(`/api/v1/webhooks/${webhook.id}/deliveries`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('event_type');
      expect(res.body.data[0]).toHaveProperty('status');
      expect(res.body.data[0]).toHaveProperty('attempts');
    });

    it('respects limit parameter', async () => {
      const apiKey = testDb.prepare('SELECT * FROM api_keys WHERE is_active = 1').get() as any;
      const webhook = createWebhook(testDb, apiKey.id, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      for (let i = 0; i < 5; i++) {
        createDelivery(testDb, webhook.id, 'invoice.created', { id: String(i) });
      }

      const res = await authedGet(`/api/v1/webhooks/${webhook.id}/deliveries?limit=2`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('returns 404 for non-existent webhook', async () => {
      const res = await authedGet('/api/v1/webhooks/nonexistent/deliveries');
      expect(res.status).toBe(404);
    });

    it('returns 404 for webhook owned by different API key', async () => {
      const { apiKey: otherKey } = generateApiKey(testDb, 'other-key');
      const webhook = createWebhook(testDb, otherKey.id, {
        url: 'https://other.com/hook',
        events: ['invoice.created'],
      });

      const res = await authedGet(`/api/v1/webhooks/${webhook.id}/deliveries`);
      expect(res.status).toBe(404);
    });
  });
});
