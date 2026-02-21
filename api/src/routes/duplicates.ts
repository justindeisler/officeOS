/**
 * Duplicate Detection API Routes
 *
 * Provides endpoints to check for, mark, and unmark duplicate
 * expense and income records.
 */

import { Router, type Request, type Response } from 'express';
import { getDb } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError, ValidationError } from '../errors.js';
import {
  findDuplicates,
  markAsDuplicate,
  unmarkAsDuplicate,
  listMarkedDuplicates,
} from '../services/duplicateDetectionService.js';

const router = Router();

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/duplicates/check/:type/:recordId
 * Check if a record has potential duplicates.
 */
router.get(
  '/check/:type/:recordId',
  asyncHandler(async (req: Request, res: Response) => {
    const { type, recordId } = req.params;

    if (type !== 'income' && type !== 'expense') {
      throw new ValidationError('type must be "income" or "expense"');
    }

    const db = getDb();
    const table = type === 'expense' ? 'expenses' : 'income';
    const partnerCol = type === 'expense' ? 'vendor' : 'description';

    const record = db
      .prepare(
        `SELECT id, date, ${partnerCol} AS partner, description, net_amount
         FROM ${table}
         WHERE id = ? AND (is_deleted IS NULL OR is_deleted = 0)`,
      )
      .get(recordId) as
      | { id: string; date: string; partner: string | null; description: string; net_amount: number }
      | undefined;

    if (!record) {
      throw new NotFoundError(`${type} record`, recordId);
    }

    const partner = record.partner || record.description || '';
    const duplicates = findDuplicates(db, type, record.net_amount, record.date, partner, recordId);

    res.json({
      record_id: recordId,
      type,
      duplicates,
      has_duplicates: duplicates.length > 0,
    });
  }),
);

/**
 * POST /api/duplicates/mark
 * Mark a record as a duplicate of another record.
 *
 * Body: { type: 'income'|'expense', recordId: string, duplicateOfId: string }
 */
router.post(
  '/mark',
  asyncHandler(async (req: Request, res: Response) => {
    const { type, recordId, duplicateOfId } = req.body;

    if (!type || !recordId || !duplicateOfId) {
      throw new ValidationError('type, recordId, and duplicateOfId are required');
    }
    if (type !== 'income' && type !== 'expense') {
      throw new ValidationError('type must be "income" or "expense"');
    }
    if (recordId === duplicateOfId) {
      throw new ValidationError('A record cannot be a duplicate of itself');
    }

    const db = getDb();
    markAsDuplicate(db, type, recordId, duplicateOfId);

    res.json({ success: true, message: `${type} ${recordId} marked as duplicate of ${duplicateOfId}` });
  }),
);

/**
 * POST /api/duplicates/unmark
 * Unmark a record that was previously marked as a duplicate.
 *
 * Body: { type: 'income'|'expense', recordId: string }
 */
router.post(
  '/unmark',
  asyncHandler(async (req: Request, res: Response) => {
    const { type, recordId } = req.body;

    if (!type || !recordId) {
      throw new ValidationError('type and recordId are required');
    }
    if (type !== 'income' && type !== 'expense') {
      throw new ValidationError('type must be "income" or "expense"');
    }

    const db = getDb();
    unmarkAsDuplicate(db, type, recordId);

    res.json({ success: true, message: `${type} ${recordId} unmarked as duplicate` });
  }),
);

/**
 * GET /api/duplicates/list
 * List all records currently marked as duplicates.
 * Optional query param: ?type=income|expense
 */
router.get(
  '/list',
  asyncHandler(async (req: Request, res: Response) => {
    const typeParam = req.query.type as string | undefined;

    if (typeParam && typeParam !== 'income' && typeParam !== 'expense') {
      throw new ValidationError('type must be "income" or "expense"');
    }

    const db = getDb();
    const duplicates = listMarkedDuplicates(
      db,
      typeParam as 'income' | 'expense' | undefined,
    );

    res.json({ duplicates, total: duplicates.length });
  }),
);

export default router;
