/**
 * Webhook Service Tests
 *
 * Tests CRUD operations, signature generation/verification,
 * event dispatch, delivery attempts with retry logic.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../../test/setup.js';
import {
  ensureWebhookTables,
  createWebhook,
  getWebhookById,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  generateSignature,
  verifySignature,
  getRetryDelay,
  createDelivery,
  dispatchEvent,
  attemptDelivery,
  getDeliveryHistory,
  getPendingDeliveries,
  WEBHOOK_EVENT_TYPES,
} from '../webhookService.js';
import { generateApiKey } from '../apiKeyService.js';

let db: Database.Database;
let apiKeyId: string;

function setupApiKey() {
  const { apiKey } = generateApiKey(db, 'test-key', ['read', 'write']);
  apiKeyId = apiKey.id;
}

describe('WebhookService', () => {
  beforeEach(() => {
    db = createTestDb();
    ensureWebhookTables(db);
    setupApiKey();
  });

  afterAll(() => {
    if (db) db.close();
  });

  // ========================================================================
  // CRUD
  // ========================================================================

  describe('CRUD', () => {
    it('creates a webhook with secret', () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created', 'invoice.paid'],
        description: 'Test webhook',
      });

      expect(webhook.id).toBeTruthy();
      expect(webhook.api_key_id).toBe(apiKeyId);
      expect(webhook.url).toBe('https://example.com/hook');
      expect(webhook.secret).toMatch(/^whsec_/);
      expect(webhook.secret).toHaveLength(6 + 64); // whsec_ + 32 bytes hex
      expect(webhook.events).toEqual(['invoice.created', 'invoice.paid']);
      expect(webhook.is_active).toBe(1);
      expect(webhook.description).toBe('Test webhook');
      expect(webhook.created_at).toBeTruthy();
      expect(webhook.updated_at).toBeTruthy();
    });

    it('gets webhook by ID', () => {
      const created = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const found = getWebhookById(db, created.id);
      expect(found).toBeTruthy();
      expect(found!.id).toBe(created.id);
      expect(found!.events).toEqual(['invoice.created']);
    });

    it('returns null for non-existent webhook', () => {
      expect(getWebhookById(db, 'nonexistent')).toBeNull();
    });

    it('lists webhooks for an API key', () => {
      createWebhook(db, apiKeyId, { url: 'https://a.com/hook', events: ['invoice.created'] });
      createWebhook(db, apiKeyId, { url: 'https://b.com/hook', events: ['expense.created'] });

      // Create a webhook for a different API key
      const { apiKey: otherKey } = generateApiKey(db, 'other-key');
      createWebhook(db, otherKey.id, { url: 'https://c.com/hook', events: ['*'] });

      const webhooks = listWebhooks(db, apiKeyId);
      expect(webhooks).toHaveLength(2);
      expect(webhooks.every(w => w.api_key_id === apiKeyId)).toBe(true);
    });

    it('updates webhook URL', () => {
      const created = createWebhook(db, apiKeyId, {
        url: 'https://old.com/hook',
        events: ['invoice.created'],
      });

      const updated = updateWebhook(db, created.id, apiKeyId, {
        url: 'https://new.com/hook',
      });

      expect(updated).toBeTruthy();
      expect(updated!.url).toBe('https://new.com/hook');
      expect(updated!.events).toEqual(['invoice.created']); // unchanged
    });

    it('updates webhook events', () => {
      const created = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const updated = updateWebhook(db, created.id, apiKeyId, {
        events: ['invoice.created', 'invoice.paid', 'expense.created'],
      });

      expect(updated!.events).toEqual(['invoice.created', 'invoice.paid', 'expense.created']);
    });

    it('updates webhook is_active', () => {
      const created = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const updated = updateWebhook(db, created.id, apiKeyId, { is_active: false });
      expect(updated!.is_active).toBe(0);
    });

    it('returns null when updating non-existent webhook', () => {
      expect(updateWebhook(db, 'nonexistent', apiKeyId, { url: 'https://x.com' })).toBeNull();
    });

    it('returns null when updating webhook owned by different API key', () => {
      const created = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const { apiKey: otherKey } = generateApiKey(db, 'other-key');
      expect(updateWebhook(db, created.id, otherKey.id, { url: 'https://hacked.com' })).toBeNull();
    });

    it('deletes webhook', () => {
      const created = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const deleted = deleteWebhook(db, created.id, apiKeyId);
      expect(deleted).toBe(true);
      expect(getWebhookById(db, created.id)).toBeNull();
    });

    it('returns false when deleting non-existent webhook', () => {
      expect(deleteWebhook(db, 'nonexistent', apiKeyId)).toBe(false);
    });

    it('returns false when deleting webhook owned by different API key', () => {
      const created = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const { apiKey: otherKey } = generateApiKey(db, 'other-key');
      expect(deleteWebhook(db, created.id, otherKey.id)).toBe(false);
    });
  });

  // ========================================================================
  // Signature Generation & Verification
  // ========================================================================

  describe('Signatures', () => {
    const secret = 'whsec_testsecret123';
    const payload = '{"event":"invoice.created","data":{"id":"inv-001"}}';
    const timestamp = 1700000000;

    it('generates deterministic HMAC-SHA256 signatures', () => {
      const sig1 = generateSignature(payload, secret, timestamp);
      const sig2 = generateSignature(payload, secret, timestamp);
      expect(sig1).toBe(sig2);
      expect(sig1).toHaveLength(64); // 256 bits = 32 bytes = 64 hex chars
    });

    it('generates different signatures for different payloads', () => {
      const sig1 = generateSignature(payload, secret, timestamp);
      const sig2 = generateSignature('different payload', secret, timestamp);
      expect(sig1).not.toBe(sig2);
    });

    it('generates different signatures for different secrets', () => {
      const sig1 = generateSignature(payload, secret, timestamp);
      const sig2 = generateSignature(payload, 'other_secret', timestamp);
      expect(sig1).not.toBe(sig2);
    });

    it('generates different signatures for different timestamps', () => {
      const sig1 = generateSignature(payload, secret, timestamp);
      const sig2 = generateSignature(payload, secret, timestamp + 1);
      expect(sig1).not.toBe(sig2);
    });

    it('verifies valid signature', () => {
      const sig = generateSignature(payload, secret, timestamp);
      // Mock Date.now to be within tolerance
      const originalNow = Date.now;
      Date.now = () => timestamp * 1000;
      try {
        expect(verifySignature(payload, secret, sig, timestamp)).toBe(true);
      } finally {
        Date.now = originalNow;
      }
    });

    it('rejects expired signature (timestamp too old)', () => {
      const sig = generateSignature(payload, secret, timestamp);
      // Set current time to 10 minutes later
      const originalNow = Date.now;
      Date.now = () => (timestamp + 600) * 1000;
      try {
        expect(verifySignature(payload, secret, sig, timestamp, 300)).toBe(false);
      } finally {
        Date.now = originalNow;
      }
    });

    it('rejects invalid signature', () => {
      const originalNow = Date.now;
      Date.now = () => timestamp * 1000;
      try {
        expect(verifySignature(payload, secret, 'a'.repeat(64), timestamp)).toBe(false);
      } finally {
        Date.now = originalNow;
      }
    });

    it('accepts signature within tolerance window', () => {
      const sig = generateSignature(payload, secret, timestamp);
      // Set current time to 4 minutes later (within 5 min default tolerance)
      const originalNow = Date.now;
      Date.now = () => (timestamp + 240) * 1000;
      try {
        expect(verifySignature(payload, secret, sig, timestamp)).toBe(true);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  // ========================================================================
  // Retry Logic
  // ========================================================================

  describe('Retry Logic', () => {
    it('calculates exponential backoff delays', () => {
      expect(getRetryDelay(1)).toBe(10_000);       // 10s
      expect(getRetryDelay(2)).toBe(30_000);       // 30s
      expect(getRetryDelay(3)).toBe(90_000);       // 90s
      expect(getRetryDelay(4)).toBe(270_000);      // 270s
      expect(getRetryDelay(5)).toBe(810_000);      // 810s
    });
  });

  // ========================================================================
  // Event Dispatch
  // ========================================================================

  describe('Event Dispatch', () => {
    it('creates delivery records for matching webhooks', () => {
      createWebhook(db, apiKeyId, {
        url: 'https://a.com/hook',
        events: ['invoice.created', 'invoice.paid'],
      });
      createWebhook(db, apiKeyId, {
        url: 'https://b.com/hook',
        events: ['expense.created'],
      });

      const deliveries = dispatchEvent(db, 'invoice.created', { id: 'inv-001' });
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0].event_type).toBe('invoice.created');
      expect(deliveries[0].status).toBe('pending');
      expect(deliveries[0].attempts).toBe(0);
    });

    it('dispatches to wildcard subscribers', () => {
      createWebhook(db, apiKeyId, {
        url: 'https://all-events.com/hook',
        events: ['*'],
      });

      const deliveries = dispatchEvent(db, 'expense.created', { id: 'exp-001' });
      expect(deliveries).toHaveLength(1);
    });

    it('skips inactive webhooks', () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://inactive.com/hook',
        events: ['invoice.created'],
      });
      updateWebhook(db, webhook.id, apiKeyId, { is_active: false });

      const deliveries = dispatchEvent(db, 'invoice.created', { id: 'inv-001' });
      expect(deliveries).toHaveLength(0);
    });

    it('creates delivery with correct payload structure', () => {
      createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['task.completed'],
      });

      const deliveries = dispatchEvent(db, 'task.completed', { id: 'task-001', title: 'Test' });
      expect(deliveries).toHaveLength(1);

      const payload = JSON.parse(deliveries[0].payload);
      expect(payload.event).toBe('task.completed');
      expect(payload.data).toEqual({ id: 'task-001', title: 'Test' });
      expect(payload.timestamp).toBeTruthy();
    });

    it('dispatches to multiple matching webhooks', () => {
      createWebhook(db, apiKeyId, { url: 'https://a.com/hook', events: ['invoice.created'] });
      createWebhook(db, apiKeyId, { url: 'https://b.com/hook', events: ['invoice.created'] });
      createWebhook(db, apiKeyId, { url: 'https://c.com/hook', events: ['*'] });

      const deliveries = dispatchEvent(db, 'invoice.created', { id: 'inv-001' });
      expect(deliveries).toHaveLength(3);
    });
  });

  // ========================================================================
  // Delivery Attempts
  // ========================================================================

  describe('Delivery Attempts', () => {
    it('marks delivery as success on 2xx response', async () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const delivery = createDelivery(db, webhook.id, 'invoice.created', { test: true });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });

      const result = await attemptDelivery(db, delivery.id, mockFetch as any);
      expect(result.status).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.response_status).toBe(200);
      expect(result.completed_at).toBeTruthy();
    });

    it('sends correct headers including signature', async () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const delivery = createDelivery(db, webhook.id, 'invoice.created', { test: true });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('OK'),
      });

      await attemptDelivery(db, delivery.id, mockFetch as any);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://example.com/hook');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['X-Webhook-Id']).toBe(webhook.id);
      expect(options.headers['X-Webhook-Signature']).toBeTruthy();
      expect(options.headers['X-Webhook-Timestamp']).toBeTruthy();
      expect(options.headers['X-Webhook-Event']).toBe('invoice.created');
      expect(options.headers['User-Agent']).toBe('officeOS-Webhooks/1.0');
    });

    it('retries on HTTP error (non-2xx)', async () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const delivery = createDelivery(db, webhook.id, 'invoice.created', { test: true });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await attemptDelivery(db, delivery.id, mockFetch as any);
      expect(result.status).toBe('pending'); // pending for retry
      expect(result.attempts).toBe(1);
      expect(result.response_status).toBe(500);
      expect(result.next_retry_at).toBeTruthy();
      expect(result.error_message).toContain('HTTP 500');
    });

    it('retries on network error', async () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const delivery = createDelivery(db, webhook.id, 'invoice.created', { test: true });

      const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await attemptDelivery(db, delivery.id, mockFetch as any);
      expect(result.status).toBe('pending');
      expect(result.attempts).toBe(1);
      expect(result.error_message).toBe('ECONNREFUSED');
      expect(result.next_retry_at).toBeTruthy();
    });

    it('marks as failed after max attempts (HTTP error)', async () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const delivery = createDelivery(db, webhook.id, 'invoice.created', { test: true });

      // Simulate 4 previous attempts
      db.prepare('UPDATE webhook_deliveries SET attempts = 4 WHERE id = ?').run(delivery.id);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable'),
      });

      const result = await attemptDelivery(db, delivery.id, mockFetch as any);
      expect(result.status).toBe('failed');
      expect(result.attempts).toBe(5);
      expect(result.completed_at).toBeTruthy();
    });

    it('marks as failed after max attempts (network error)', async () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      const delivery = createDelivery(db, webhook.id, 'invoice.created', { test: true });

      // Simulate 4 previous attempts
      db.prepare('UPDATE webhook_deliveries SET attempts = 4 WHERE id = ?').run(delivery.id);

      const mockFetch = vi.fn().mockRejectedValue(new Error('Timeout'));

      const result = await attemptDelivery(db, delivery.id, mockFetch as any);
      expect(result.status).toBe('failed');
      expect(result.attempts).toBe(5);
      expect(result.completed_at).toBeTruthy();
    });

    it('handles deleted webhook gracefully', async () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });
      const delivery = createDelivery(db, webhook.id, 'invoice.created', { test: true });

      // Deactivate webhook (soft-delete, keeps delivery intact unlike CASCADE delete)
      db.prepare('UPDATE webhooks SET is_active = 0 WHERE id = ?').run(webhook.id);
      // Simulate hard-delete of webhook row while keeping delivery (disable FK temporarily)
      db.pragma('foreign_keys = OFF');
      db.prepare('DELETE FROM webhooks WHERE id = ?').run(webhook.id);
      db.pragma('foreign_keys = ON');

      const result = await attemptDelivery(db, delivery.id);
      expect(result.status).toBe('failed');
      expect(result.error_message).toBe('Webhook not found');
    });

    it('throws for non-existent delivery', async () => {
      await expect(attemptDelivery(db, 'nonexistent')).rejects.toThrow('Delivery nonexistent not found');
    });
  });

  // ========================================================================
  // Delivery History & Pending
  // ========================================================================

  describe('Delivery History', () => {
    it('returns delivery history for a webhook', () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      createDelivery(db, webhook.id, 'invoice.created', { id: '1' });
      createDelivery(db, webhook.id, 'invoice.created', { id: '2' });
      createDelivery(db, webhook.id, 'invoice.created', { id: '3' });

      const history = getDeliveryHistory(db, webhook.id);
      expect(history).toHaveLength(3);
    });

    it('respects limit parameter', () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      for (let i = 0; i < 5; i++) {
        createDelivery(db, webhook.id, 'invoice.created', { id: String(i) });
      }

      const history = getDeliveryHistory(db, webhook.id, 2);
      expect(history).toHaveLength(2);
    });

    it('returns pending deliveries ready for retry', () => {
      const webhook = createWebhook(db, apiKeyId, {
        url: 'https://example.com/hook',
        events: ['invoice.created'],
      });

      // Pending with no retry time (should be returned)
      createDelivery(db, webhook.id, 'invoice.created', { id: '1' });

      // Pending with past retry time (should be returned)
      const d2 = createDelivery(db, webhook.id, 'invoice.created', { id: '2' });
      db.prepare('UPDATE webhook_deliveries SET next_retry_at = ? WHERE id = ?')
        .run(new Date(Date.now() - 60000).toISOString(), d2.id);

      // Pending with future retry time (should NOT be returned)
      const d3 = createDelivery(db, webhook.id, 'invoice.created', { id: '3' });
      db.prepare('UPDATE webhook_deliveries SET next_retry_at = ? WHERE id = ?')
        .run(new Date(Date.now() + 60000).toISOString(), d3.id);

      // Success (should NOT be returned)
      const d4 = createDelivery(db, webhook.id, 'invoice.created', { id: '4' });
      db.prepare("UPDATE webhook_deliveries SET status = 'success' WHERE id = ?").run(d4.id);

      const pending = getPendingDeliveries(db);
      expect(pending).toHaveLength(2);
    });
  });

  // ========================================================================
  // Event Types
  // ========================================================================

  describe('Event Types', () => {
    it('has well-defined event types', () => {
      expect(WEBHOOK_EVENT_TYPES.length).toBeGreaterThan(10);
      expect(WEBHOOK_EVENT_TYPES).toContain('invoice.created');
      expect(WEBHOOK_EVENT_TYPES).toContain('invoice.paid');
      expect(WEBHOOK_EVENT_TYPES).toContain('expense.created');
      expect(WEBHOOK_EVENT_TYPES).toContain('task.completed');
      expect(WEBHOOK_EVENT_TYPES).toContain('client.created');
      expect(WEBHOOK_EVENT_TYPES).toContain('project.created');
    });

    it('all event types follow entity.action pattern', () => {
      for (const event of WEBHOOK_EVENT_TYPES) {
        expect(event).toMatch(/^[a-z]+\.[a-z]+$/);
      }
    });
  });

  // ========================================================================
  // Table Setup Idempotency
  // ========================================================================

  describe('ensureWebhookTables', () => {
    it('is idempotent (can be called multiple times)', () => {
      expect(() => {
        ensureWebhookTables(db);
        ensureWebhookTables(db);
        ensureWebhookTables(db);
      }).not.toThrow();
    });
  });
});
