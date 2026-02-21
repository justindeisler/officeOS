/**
 * Missing Receipt Alerts API Routes
 *
 * Provides endpoints for managing missing receipt alerts
 * (GoBD compliance tracking).
 */

import { Router, type Request, type Response } from 'express';
import { getDb } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError } from '../errors.js';
import {
  checkMissingReceipts,
  getAlertStats,
  dismissAlert,
  restoreAlert,
  dailyScan,
} from '../services/missingReceiptService.js';

const router = Router();

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/missing-receipts
 * List all active alerts (not dismissed) with stats.
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const db = getDb();
    const alerts = checkMissingReceipts(db);
    const stats = getAlertStats(db);

    res.json({ alerts, stats });
  }),
);

/**
 * GET /api/missing-receipts/stats
 * Summary: count by severity.
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const db = getDb();
    const stats = getAlertStats(db);
    res.json(stats);
  }),
);

/**
 * POST /api/missing-receipts/:id/dismiss
 * Dismiss an alert.
 */
router.post(
  '/:id/dismiss',
  asyncHandler(async (req: Request, res: Response) => {
    const db = getDb();
    const { id } = req.params;

    // Verify alert exists
    const alert = db.prepare('SELECT id FROM missing_receipt_alerts WHERE id = ?').get(id);
    if (!alert) {
      throw new NotFoundError('Missing receipt alert', id);
    }

    dismissAlert(db, id);
    res.json({ success: true, message: `Alert ${id} dismissed` });
  }),
);

/**
 * POST /api/missing-receipts/:id/restore
 * Restore a dismissed alert.
 */
router.post(
  '/:id/restore',
  asyncHandler(async (req: Request, res: Response) => {
    const db = getDb();
    const { id } = req.params;

    // Verify alert exists
    const alert = db.prepare('SELECT id FROM missing_receipt_alerts WHERE id = ?').get(id);
    if (!alert) {
      throw new NotFoundError('Missing receipt alert', id);
    }

    restoreAlert(db, id);
    res.json({ success: true, message: `Alert ${id} restored` });
  }),
);

/**
 * POST /api/missing-receipts/scan
 * Manual trigger to scan for missing receipts.
 */
router.post(
  '/scan',
  asyncHandler(async (_req: Request, res: Response) => {
    const db = getDb();
    dailyScan(db);

    const alerts = checkMissingReceipts(db);
    const stats = getAlertStats(db);

    res.json({
      success: true,
      message: 'Missing receipt scan completed',
      alerts,
      stats,
    });
  }),
);

export default router;
