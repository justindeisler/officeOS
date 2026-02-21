/**
 * Public REST API v1 Router
 *
 * Aggregates all v1 endpoints under a single versioned namespace.
 * Mounted at /api/v1 in the main app.
 *
 * All routes require API key authentication (Bearer token).
 * Rate limiting is applied per-key based on the key's rate_limit setting.
 */

import express from 'express';
import { apiAuthMiddleware } from '../../middleware/apiAuth.js';
import { rateLimiterMiddleware } from '../../middleware/rateLimiter.js';
import invoicesRouter from './invoices.js';
import incomeRouter from './income.js';
import expensesRouter from './expenses.js';
import assetsRouter from './assets.js';
import reportsRouter from './reports.js';
import exportsRouter from './exports.js';
import webhooksRouter from './webhooks.js';

const v1Router = express.Router();

// Read-only routes (scope: read) — auth then rate limit
v1Router.use('/reports', apiAuthMiddleware(['read']), rateLimiterMiddleware, reportsRouter);
v1Router.use('/exports', apiAuthMiddleware(['read']), rateLimiterMiddleware, exportsRouter);

// Write routes (scope: write) — also allow read for GET endpoints
v1Router.use('/invoices', apiAuthMiddleware(['read', 'write']), rateLimiterMiddleware, invoicesRouter);
v1Router.use('/income', apiAuthMiddleware(['read', 'write']), rateLimiterMiddleware, incomeRouter);
v1Router.use('/expenses', apiAuthMiddleware(['read', 'write']), rateLimiterMiddleware, expensesRouter);
v1Router.use('/assets', apiAuthMiddleware(['read', 'write']), rateLimiterMiddleware, assetsRouter);

// Webhook routes (scope: write for mutations, read for listing)
v1Router.use('/webhooks', apiAuthMiddleware(['read', 'write']), rateLimiterMiddleware, webhooksRouter);

export default v1Router;
