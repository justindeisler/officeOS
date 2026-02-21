/**
 * Public REST API v1 Router
 *
 * Aggregates all v1 endpoints under a single versioned namespace.
 * Mounted at /api/v1 in the main app.
 */

import express from 'express';
import invoicesRouter from './invoices.js';
import incomeRouter from './income.js';
import expensesRouter from './expenses.js';
import assetsRouter from './assets.js';
import reportsRouter from './reports.js';
import exportsRouter from './exports.js';

const v1Router = express.Router();

v1Router.use('/invoices', invoicesRouter);
v1Router.use('/income', incomeRouter);
v1Router.use('/expenses', expensesRouter);
v1Router.use('/assets', assetsRouter);
v1Router.use('/reports', reportsRouter);
v1Router.use('/exports', exportsRouter);

export default v1Router;
