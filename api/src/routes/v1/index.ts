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

const v1Router = express.Router();

// Apply auth + rate limiting to ALL v1 routes
v1Router.use(apiAuthMiddleware());   // Validates key (no specific scope required)
v1Router.use(rateLimiterMiddleware); // Enforces per-key rate limits

// Read-only routes (scope: read)
v1Router.use('/reports', apiAuthMiddleware(['read']), reportsRouter);
v1Router.use('/exports', apiAuthMiddleware(['read']), exportsRouter);

// Write routes (scope: write) — also allow read for GET endpoints
v1Router.use('/invoices', apiAuthMiddleware(['read', 'write']), invoicesRouter);
v1Router.use('/income', apiAuthMiddleware(['read', 'write']), incomeRouter);
v1Router.use('/expenses', apiAuthMiddleware(['read', 'write']), expensesRouter);
v1Router.use('/assets', apiAuthMiddleware(['read', 'write']), assetsRouter);

export default v1Router;
