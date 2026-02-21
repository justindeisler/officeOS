/**
 * Public REST API v1 — Webhooks
 *
 * CRUD endpoints for webhook management + delivery history.
 * All routes require API key authentication.
 */

import { Router, type Request, type Response } from 'express';
import { getDb } from '../../database.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { sendSuccess, sendError } from '../../middleware/responseFormatter.js';
import {
  createWebhook,
  listWebhooks,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  getDeliveryHistory,
  ensureWebhookTables,
  WEBHOOK_EVENT_TYPES,
  type WebhookCreateInput,
} from '../../services/webhookService.js';

const router = Router();

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/v1/webhooks — List registered webhooks
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  ensureWebhookTables(db);
  const apiKeyId = req.apiKey!.id;
  const webhooks = listWebhooks(db, apiKeyId);

  // Don't expose full secrets — only prefix
  const sanitized = webhooks.map(w => ({
    ...w,
    secret: w.secret.substring(0, 10) + '...',
  }));

  sendSuccess(res, sanitized);
}));

/**
 * GET /api/v1/webhooks/events — List available event types
 */
router.get('/events', (_req: Request, res: Response) => {
  sendSuccess(res, WEBHOOK_EVENT_TYPES);
});

/**
 * POST /api/v1/webhooks — Register a new webhook
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  ensureWebhookTables(db);
  const apiKeyId = req.apiKey!.id;
  const { url, events, description } = req.body;

  // Validate URL
  if (!url || typeof url !== 'string') {
    return sendError(res, 'URL is required', 'VALIDATION_ERROR', 400);
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return sendError(res, 'URL must use http or https protocol', 'VALIDATION_ERROR', 400);
    }
  } catch {
    return sendError(res, 'Invalid URL format', 'VALIDATION_ERROR', 400);
  }

  // Validate events
  if (!events || !Array.isArray(events) || events.length === 0) {
    return sendError(res, 'At least one event type is required', 'VALIDATION_ERROR', 400);
  }
  const validEvents = [...WEBHOOK_EVENT_TYPES, '*'] as string[];
  for (const event of events) {
    if (!validEvents.includes(event)) {
      return sendError(res, `Invalid event type: ${event}`, 'VALIDATION_ERROR', 400, {
        valid_events: WEBHOOK_EVENT_TYPES,
      });
    }
  }

  const input: WebhookCreateInput = { url, events, description };
  const webhook = createWebhook(db, apiKeyId, input);

  // Show full secret only on creation
  sendSuccess(res, webhook, 201);
}));

/**
 * GET /api/v1/webhooks/:id — Get webhook details
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  ensureWebhookTables(db);
  const webhook = getWebhookById(db, req.params.id);

  if (!webhook || webhook.api_key_id !== req.apiKey!.id) {
    return sendError(res, 'Webhook not found', 'NOT_FOUND', 404);
  }

  // Hide secret
  sendSuccess(res, { ...webhook, secret: webhook.secret.substring(0, 10) + '...' });
}));

/**
 * PATCH /api/v1/webhooks/:id — Update webhook
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  ensureWebhookTables(db);
  const apiKeyId = req.apiKey!.id;
  const { url, events, description, is_active } = req.body;

  // Validate URL if provided
  if (url !== undefined) {
    if (typeof url !== 'string' || url.trim() === '') {
      return sendError(res, 'Invalid URL', 'VALIDATION_ERROR', 400);
    }
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return sendError(res, 'URL must use http or https protocol', 'VALIDATION_ERROR', 400);
      }
    } catch {
      return sendError(res, 'Invalid URL format', 'VALIDATION_ERROR', 400);
    }
  }

  // Validate events if provided
  if (events !== undefined) {
    if (!Array.isArray(events) || events.length === 0) {
      return sendError(res, 'At least one event type is required', 'VALIDATION_ERROR', 400);
    }
    const validEvents = [...WEBHOOK_EVENT_TYPES, '*'] as string[];
    for (const event of events) {
      if (!validEvents.includes(event)) {
        return sendError(res, `Invalid event type: ${event}`, 'VALIDATION_ERROR', 400);
      }
    }
  }

  const updated = updateWebhook(db, req.params.id, apiKeyId, {
    url, events, description, is_active,
  });

  if (!updated) {
    return sendError(res, 'Webhook not found', 'NOT_FOUND', 404);
  }

  sendSuccess(res, { ...updated, secret: updated.secret.substring(0, 10) + '...' });
}));

/**
 * DELETE /api/v1/webhooks/:id — Delete webhook
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  ensureWebhookTables(db);
  const apiKeyId = req.apiKey!.id;
  const deleted = deleteWebhook(db, req.params.id, apiKeyId);

  if (!deleted) {
    return sendError(res, 'Webhook not found', 'NOT_FOUND', 404);
  }

  sendSuccess(res, { id: req.params.id, deleted: true });
}));

/**
 * GET /api/v1/webhooks/:id/deliveries — Get delivery history
 */
router.get('/:id/deliveries', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  ensureWebhookTables(db);

  const webhook = getWebhookById(db, req.params.id);
  if (!webhook || webhook.api_key_id !== req.apiKey!.id) {
    return sendError(res, 'Webhook not found', 'NOT_FOUND', 404);
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const deliveries = getDeliveryHistory(db, req.params.id, limit);

  sendSuccess(res, deliveries);
}));

export default router;
