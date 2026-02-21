/**
 * Webhook Service
 *
 * Manages webhook registrations, deliveries, and signature verification.
 * Supports CRUD operations, event dispatch, retry logic, and HMAC signing.
 */

import crypto from 'crypto';
import type Database from 'better-sqlite3';

// ============================================================================
// Types
// ============================================================================

export const WEBHOOK_EVENT_TYPES = [
  'invoice.created',
  'invoice.updated',
  'invoice.sent',
  'invoice.paid',
  'invoice.deleted',
  'expense.created',
  'expense.updated',
  'expense.deleted',
  'income.created',
  'income.updated',
  'income.deleted',
  'asset.created',
  'asset.updated',
  'asset.disposed',
  'task.created',
  'task.updated',
  'task.completed',
  'task.deleted',
  'client.created',
  'client.updated',
  'project.created',
  'project.updated',
] as const;

export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number];

export interface Webhook {
  id: string;
  api_key_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean | number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface WebhookCreateInput {
  url: string;
  events: string[];
  description?: string;
}

export interface WebhookUpdateInput {
  url?: string;
  events?: string[];
  description?: string;
  is_active?: boolean;
}

// ============================================================================
// Database Schema Setup
// ============================================================================

export function ensureWebhookTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      api_key_id TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_webhooks_api_key ON webhooks(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active);

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      webhook_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      last_attempt_at TEXT,
      next_retry_at TEXT,
      response_status INTEGER,
      response_body TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at);
  `);
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new webhook registration.
 */
export function createWebhook(
  db: Database.Database,
  apiKeyId: string,
  input: WebhookCreateInput
): Webhook {
  const id = crypto.randomUUID();
  const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO webhooks (id, api_key_id, url, secret, events, is_active, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(id, apiKeyId, input.url, secret, JSON.stringify(input.events), input.description || null, now, now);

  return getWebhookById(db, id)!;
}

/**
 * Get a webhook by ID.
 */
export function getWebhookById(db: Database.Database, id: string): Webhook | null {
  const row = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as any;
  if (!row) return null;
  return { ...row, events: JSON.parse(row.events) };
}

/**
 * List webhooks for an API key.
 */
export function listWebhooks(db: Database.Database, apiKeyId: string): Webhook[] {
  const rows = db.prepare(
    'SELECT * FROM webhooks WHERE api_key_id = ? ORDER BY created_at DESC'
  ).all(apiKeyId) as any[];
  return rows.map(r => ({ ...r, events: JSON.parse(r.events) }));
}

/**
 * Update a webhook.
 */
export function updateWebhook(
  db: Database.Database,
  id: string,
  apiKeyId: string,
  input: WebhookUpdateInput
): Webhook | null {
  const existing = db.prepare(
    'SELECT * FROM webhooks WHERE id = ? AND api_key_id = ?'
  ).get(id, apiKeyId) as any;
  if (!existing) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.url !== undefined) {
    updates.push('url = ?');
    params.push(input.url);
  }
  if (input.events !== undefined) {
    updates.push('events = ?');
    params.push(JSON.stringify(input.events));
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    params.push(input.description);
  }
  if (input.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(input.is_active ? 1 : 0);
  }

  if (updates.length === 0) return getWebhookById(db, id);

  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  params.push(apiKeyId);

  db.prepare(
    `UPDATE webhooks SET ${updates.join(', ')} WHERE id = ? AND api_key_id = ?`
  ).run(...params);

  return getWebhookById(db, id);
}

/**
 * Delete a webhook.
 */
export function deleteWebhook(db: Database.Database, id: string, apiKeyId: string): boolean {
  const result = db.prepare(
    'DELETE FROM webhooks WHERE id = ? AND api_key_id = ?'
  ).run(id, apiKeyId);
  return result.changes > 0;
}

// ============================================================================
// Signature Generation
// ============================================================================

/**
 * Generate HMAC-SHA256 signature for a webhook payload.
 */
export function generateSignature(payload: string, secret: string, timestamp: number): string {
  const signedContent = `${timestamp}.${payload}`;
  return crypto.createHmac('sha256', secret).update(signedContent).digest('hex');
}

/**
 * Verify a webhook signature.
 */
export function verifySignature(
  payload: string,
  secret: string,
  signature: string,
  timestamp: number,
  toleranceSeconds = 300
): boolean {
  // Check timestamp tolerance (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }

  const expectedSignature = generateSignature(payload, secret, timestamp);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// ============================================================================
// Event Dispatch & Delivery
// ============================================================================

/**
 * Calculate the next retry delay using exponential backoff.
 * Retries at: 10s, 30s, 90s, 270s, 810s
 */
export function getRetryDelay(attempt: number): number {
  const baseDelayMs = 10_000; // 10 seconds
  return baseDelayMs * Math.pow(3, attempt - 1);
}

/**
 * Create a delivery record for an event.
 */
export function createDelivery(
  db: Database.Database,
  webhookId: string,
  eventType: string,
  payload: object
): WebhookDelivery {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, status, attempts, max_attempts, created_at)
    VALUES (?, ?, ?, ?, 'pending', 0, 5, ?)
  `).run(id, webhookId, eventType, JSON.stringify(payload), now);

  return db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(id) as WebhookDelivery;
}

/**
 * Dispatch an event to all registered webhooks for the event type.
 * Returns the created delivery records.
 */
export function dispatchEvent(
  db: Database.Database,
  eventType: WebhookEventType,
  data: object
): WebhookDelivery[] {
  // Find all active webhooks that subscribe to this event
  const webhooks = db.prepare(`
    SELECT * FROM webhooks WHERE is_active = 1
  `).all() as any[];

  const deliveries: WebhookDelivery[] = [];

  for (const webhook of webhooks) {
    const events: string[] = JSON.parse(webhook.events);
    // Match exact event or wildcard
    if (events.includes(eventType) || events.includes('*')) {
      const payload = {
        event: eventType,
        data,
        timestamp: new Date().toISOString(),
      };
      const delivery = createDelivery(db, webhook.id, eventType, payload);
      deliveries.push(delivery);
    }
  }

  return deliveries;
}

/**
 * Attempt to deliver a webhook. Uses fetch to POST to the webhook URL.
 * Updates the delivery record with the result.
 *
 * @param fetchFn - Injectable fetch function for testing
 */
export async function attemptDelivery(
  db: Database.Database,
  deliveryId: string,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<WebhookDelivery> {
  const delivery = db.prepare(
    'SELECT * FROM webhook_deliveries WHERE id = ?'
  ).get(deliveryId) as WebhookDelivery | undefined;

  if (!delivery) throw new Error(`Delivery ${deliveryId} not found`);

  const webhook = db.prepare(
    'SELECT * FROM webhooks WHERE id = ?'
  ).get(delivery.webhook_id) as any;

  if (!webhook) {
    // Webhook was deleted, mark delivery as failed
    db.prepare(`
      UPDATE webhook_deliveries
      SET status = 'failed', error_message = 'Webhook not found', completed_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), deliveryId);
    return db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(deliveryId) as WebhookDelivery;
  }

  const attempt = delivery.attempts + 1;
  const now = new Date();
  const timestamp = Math.floor(now.getTime() / 1000);
  const payload = delivery.payload;

  // Generate signature
  const signature = generateSignature(payload, webhook.secret, timestamp);

  try {
    const response = await fetchFn(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Id': webhook.id,
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': String(timestamp),
        'X-Webhook-Event': delivery.event_type,
        'User-Agent': 'officeOS-Webhooks/1.0',
      },
      body: payload,
      signal: AbortSignal.timeout(10_000), // 10 second timeout
    });

    const responseBody = await response.text().catch(() => '');

    if (response.ok) {
      // Success
      db.prepare(`
        UPDATE webhook_deliveries
        SET status = 'success', attempts = ?, last_attempt_at = ?,
            response_status = ?, response_body = ?, completed_at = ?,
            error_message = NULL
        WHERE id = ?
      `).run(attempt, now.toISOString(), response.status, responseBody.substring(0, 1000), now.toISOString(), deliveryId);
    } else {
      // HTTP error - retry if attempts remain
      const errorMsg = `HTTP ${response.status}: ${responseBody.substring(0, 200)}`;
      if (attempt >= delivery.max_attempts) {
        db.prepare(`
          UPDATE webhook_deliveries
          SET status = 'failed', attempts = ?, last_attempt_at = ?,
              response_status = ?, response_body = ?, error_message = ?,
              completed_at = ?
          WHERE id = ?
        `).run(attempt, now.toISOString(), response.status, responseBody.substring(0, 1000), errorMsg, now.toISOString(), deliveryId);
      } else {
        const retryDelay = getRetryDelay(attempt);
        const nextRetry = new Date(now.getTime() + retryDelay).toISOString();
        db.prepare(`
          UPDATE webhook_deliveries
          SET status = 'pending', attempts = ?, last_attempt_at = ?,
              response_status = ?, response_body = ?, error_message = ?,
              next_retry_at = ?
          WHERE id = ?
        `).run(attempt, now.toISOString(), response.status, responseBody.substring(0, 1000), errorMsg, nextRetry, deliveryId);
      }
    }
  } catch (err: any) {
    // Network error - retry if attempts remain
    const errorMsg = err.message || 'Network error';
    if (attempt >= delivery.max_attempts) {
      db.prepare(`
        UPDATE webhook_deliveries
        SET status = 'failed', attempts = ?, last_attempt_at = ?,
            error_message = ?, completed_at = ?
        WHERE id = ?
      `).run(attempt, now.toISOString(), errorMsg, now.toISOString(), deliveryId);
    } else {
      const retryDelay = getRetryDelay(attempt);
      const nextRetry = new Date(now.getTime() + retryDelay).toISOString();
      db.prepare(`
        UPDATE webhook_deliveries
        SET status = 'pending', attempts = ?, last_attempt_at = ?,
            error_message = ?, next_retry_at = ?
        WHERE id = ?
      `).run(attempt, now.toISOString(), errorMsg, nextRetry, deliveryId);
    }
  }

  return db.prepare('SELECT * FROM webhook_deliveries WHERE id = ?').get(deliveryId) as WebhookDelivery;
}

/**
 * Get delivery history for a webhook.
 */
export function getDeliveryHistory(
  db: Database.Database,
  webhookId: string,
  limit = 20
): WebhookDelivery[] {
  return db.prepare(`
    SELECT * FROM webhook_deliveries
    WHERE webhook_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(webhookId, limit) as WebhookDelivery[];
}

/**
 * Get pending deliveries that are ready for retry.
 */
export function getPendingDeliveries(db: Database.Database): WebhookDelivery[] {
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT * FROM webhook_deliveries
    WHERE status = 'pending'
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
    ORDER BY created_at ASC
  `).all(now) as WebhookDelivery[];
}
