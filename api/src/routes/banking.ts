/**
 * Banking API Routes
 *
 * Bank account management, transaction listing, matching, and SEPA export.
 */

import { Router } from 'express';
import { getDb, generateId, getCurrentTimestamp } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { validateBody } from '../middleware/validateBody.js';
import { cache, TTL } from '../cache.js';
import { createLogger } from '../logger.js';
import {
  autoMatchTransactions,
  createExpenseFromTransaction,
  createIncomeFromTransaction,
  confirmInvoiceMatch,
  generateSepaXml,
  type BankAccount,
  type BankTransaction,
} from '../services/bankingService.js';
import {
  CreateBankAccountSchema,
  SyncBankAccountSchema,
  CreateBankTransactionSchema,
  MatchTransactionSchema,
  CreateExpenseFromTxSchema,
  CreateIncomeFromTxSchema,
  GenerateSepaSchema,
} from '../schemas/banking.js';

const router = Router();
const log = createLogger('banking');

// ============================================================================
// Bank Account Routes
// ============================================================================

/**
 * GET /api/banking/accounts - List all bank accounts
 */
router.get('/accounts', asyncHandler(async (_req, res) => {
  const db = getDb();
  const accounts = db.prepare(
    'SELECT * FROM bank_accounts WHERE is_active = 1 ORDER BY created_at DESC'
  ).all() as BankAccount[];
  res.json(accounts);
}));

/**
 * POST /api/banking/accounts/connect - Connect a bank account
 */
router.post('/accounts/connect', validateBody(CreateBankAccountSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO bank_accounts (id, provider, bank_name, iban, bic, account_name, account_type, currency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.body.provider || 'manual',
    req.body.bank_name || null,
    req.body.iban || null,
    req.body.bic || null,
    req.body.account_name || null,
    req.body.account_type || 'checking',
    req.body.currency || 'EUR',
    now, now
  );

  const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id);
  log.info({ accountId: id }, 'Bank account connected');
  res.status(201).json(account);
}));

/**
 * POST /api/banking/accounts/:id/sync - Sync transactions for an account
 * In production, this would call FinAPI. For now, accepts manual transaction import.
 */
router.post('/accounts/:id/sync', asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id) as BankAccount | undefined;
  if (!account) throw new NotFoundError('Bank account', id);

  // Update sync status
  db.prepare(
    `UPDATE bank_accounts SET sync_status = 'syncing', updated_at = datetime('now') WHERE id = ?`
  ).run(id);

  // Create sync log entry
  const syncId = generateId();
  db.prepare(
    `INSERT INTO bank_sync_log (id, account_id, status, started_at) VALUES (?, ?, 'running', datetime('now'))`
  ).run(syncId, id);

  try {
    // Accept transactions from request body (manual import or FinAPI webhook)
    const transactions = req.body.transactions || [];
    let imported = 0;
    let duplicates = 0;

    for (const tx of transactions) {
      // Check for duplicates
      const existing = db.prepare(
        `SELECT id FROM bank_transactions WHERE account_id = ? AND provider_transaction_id = ?`
      ).get(id, tx.provider_transaction_id);

      if (existing) {
        duplicates++;
        continue;
      }

      db.prepare(
        `INSERT INTO bank_transactions (id, account_id, provider_transaction_id, amount, currency, booking_date, value_date, counterpart_name, counterpart_iban, counterpart_bic, purpose, bank_reference, type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        generateId(),
        id,
        tx.provider_transaction_id || null,
        tx.amount,
        tx.currency || 'EUR',
        tx.booking_date,
        tx.value_date || null,
        tx.counterpart_name || null,
        tx.counterpart_iban || null,
        tx.counterpart_bic || null,
        tx.purpose || null,
        tx.bank_reference || null,
        tx.type || null
      );
      imported++;
    }

    // Update account sync status
    db.prepare(
      `UPDATE bank_accounts SET sync_status = 'synced', last_sync_at = datetime('now'), last_sync_error = NULL, updated_at = datetime('now') WHERE id = ?`
    ).run(id);

    // Update sync log
    db.prepare(
      `UPDATE bank_sync_log SET status = 'completed', transactions_imported = ?, duplicates_skipped = ?, completed_at = datetime('now') WHERE id = ?`
    ).run(imported, duplicates, syncId);

    log.info({ accountId: id, imported, duplicates }, 'Bank sync completed');

    res.json({
      success: true,
      sync_id: syncId,
      transactions_imported: imported,
      duplicates_skipped: duplicates,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    db.prepare(
      `UPDATE bank_accounts SET sync_status = 'error', last_sync_error = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(errMsg, id);
    db.prepare(
      `UPDATE bank_sync_log SET status = 'failed', error_message = ?, completed_at = datetime('now') WHERE id = ?`
    ).run(errMsg, syncId);
    throw error;
  }
}));

/**
 * DELETE /api/banking/accounts/:id - Delete a bank account
 */
router.delete('/accounts/:id', asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id) as BankAccount | undefined;
  if (!account) throw new NotFoundError('Bank account', id);

  // Soft delete - just deactivate
  db.prepare('UPDATE bank_accounts SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id);
  res.json({ success: true, message: 'Bank account disconnected' });
}));

// ============================================================================
// Transaction Routes
// ============================================================================

/**
 * GET /api/banking/transactions - List transactions with filters
 */
router.get('/transactions', asyncHandler(async (req, res) => {
  const db = getDb();
  const { account_id, start_date, end_date, match_status, min_amount, max_amount, search } = req.query;

  let sql = 'SELECT bt.*, ba.bank_name, ba.iban as account_iban FROM bank_transactions bt JOIN bank_accounts ba ON bt.account_id = ba.id WHERE ba.is_active = 1';
  const params: unknown[] = [];

  if (account_id) {
    sql += ' AND bt.account_id = ?';
    params.push(account_id);
  }
  if (start_date) {
    sql += ' AND bt.booking_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND bt.booking_date <= ?';
    params.push(end_date);
  }
  if (match_status) {
    sql += ' AND bt.match_status = ?';
    params.push(match_status);
  }
  if (min_amount) {
    sql += ' AND ABS(bt.amount) >= ?';
    params.push(Number(min_amount));
  }
  if (max_amount) {
    sql += ' AND ABS(bt.amount) <= ?';
    params.push(Number(max_amount));
  }
  if (search) {
    sql += ' AND (bt.counterpart_name LIKE ? OR bt.purpose LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY bt.booking_date DESC, bt.created_at DESC';

  const transactions = db.prepare(sql).all(...params);
  res.json(transactions);
}));

/**
 * GET /api/banking/transactions/unmatched - Get unmatched transactions
 */
router.get('/transactions/unmatched', asyncHandler(async (_req, res) => {
  const db = getDb();
  const transactions = db.prepare(
    `SELECT bt.*, ba.bank_name, ba.iban as account_iban 
     FROM bank_transactions bt 
     JOIN bank_accounts ba ON bt.account_id = ba.id 
     WHERE bt.match_status = 'unmatched' AND bt.is_duplicate = 0 AND ba.is_active = 1
     ORDER BY bt.booking_date DESC`
  ).all();
  res.json(transactions);
}));

/**
 * POST /api/banking/transactions/:id/match - Manual match to invoice/expense/income
 */
router.post('/transactions/:id/match', validateBody(MatchTransactionSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { match_type, matched_id } = req.body;

  const tx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id) as BankTransaction | undefined;
  if (!tx) throw new NotFoundError('Bank transaction', id);

  if (match_type === 'invoice') {
    confirmInvoiceMatch(db, id, matched_id);
  } else {
    const field = match_type === 'expense' ? 'matched_expense_id' : 'matched_income_id';
    db.prepare(
      `UPDATE bank_transactions SET match_status = 'manual_matched', match_confidence = 1.0, ${field} = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(matched_id, id);
  }

  cache.invalidate('income:*');
  cache.invalidate('expenses:*');

  const updated = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id);
  log.info({ txId: id, matchType: match_type, matchedId: matched_id }, 'Transaction manually matched');
  res.json(updated);
}));

/**
 * POST /api/banking/transactions/auto-match - Run auto-matching algorithm
 */
router.post('/transactions/auto-match', asyncHandler(async (_req, res) => {
  const db = getDb();
  const result = autoMatchTransactions(db);
  log.info({ matched: result.matched, total: result.total_processed }, 'Auto-match completed');
  res.json(result);
}));

/**
 * POST /api/banking/transactions/:id/ignore - Ignore a transaction
 */
router.post('/transactions/:id/ignore', asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const tx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id) as BankTransaction | undefined;
  if (!tx) throw new NotFoundError('Bank transaction', id);

  db.prepare(
    `UPDATE bank_transactions SET match_status = 'ignored', notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?`
  ).run(req.body.reason || null, id);

  const updated = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id);
  res.json(updated);
}));

/**
 * POST /api/banking/transactions/:id/create-expense - Create expense from transaction
 */
router.post('/transactions/:id/create-expense', validateBody(CreateExpenseFromTxSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const tx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id) as BankTransaction | undefined;
  if (!tx) throw new NotFoundError('Bank transaction', id);

  const expenseId = createExpenseFromTransaction(db, id, {
    category: req.body.category,
    description: req.body.description,
    vat_rate: req.body.vat_rate,
  });

  cache.invalidate('expenses:*');

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
  const updatedTx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id);
  res.status(201).json({ expense, transaction: updatedTx });
}));

/**
 * POST /api/banking/transactions/:id/create-income - Create income from transaction
 */
router.post('/transactions/:id/create-income', validateBody(CreateIncomeFromTxSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const tx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id) as BankTransaction | undefined;
  if (!tx) throw new NotFoundError('Bank transaction', id);

  const incomeId = createIncomeFromTransaction(db, id, {
    description: req.body.description,
    vat_rate: req.body.vat_rate,
    client_id: req.body.client_id,
  });

  cache.invalidate('income:*');

  const income = db.prepare('SELECT * FROM income WHERE id = ?').get(incomeId);
  const updatedTx = db.prepare('SELECT * FROM bank_transactions WHERE id = ?').get(id);
  res.status(201).json({ income, transaction: updatedTx });
}));

// ============================================================================
// SEPA Export
// ============================================================================

/**
 * POST /api/banking/sepa/generate - Generate SEPA XML
 */
router.post('/sepa/generate', validateBody(GenerateSepaSchema), asyncHandler(async (req, res) => {
  const db = getDb();
  const { payments, debtor } = req.body;

  // If debtor not provided, try to get from settings
  let debtorInfo = debtor;
  if (!debtorInfo) {
    const settingRow = db.prepare("SELECT value FROM settings WHERE key = 'businessProfile'").get() as { value: string } | undefined;
    if (settingRow?.value) {
      const profile = JSON.parse(settingRow.value);
      debtorInfo = {
        name: profile.fullName || profile.bankAccountHolder,
        iban: profile.bankIban,
        bic: profile.bankBic,
      };
    }
  }

  if (!debtorInfo?.iban) {
    throw new ValidationError('Debtor IBAN is required. Set it in Settings → Business Profile or provide in request.');
  }

  const xml = generateSepaXml(db, payments, debtorInfo);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="sepa-${Date.now()}.xml"`);
  res.send(xml);
}));

export default router;
