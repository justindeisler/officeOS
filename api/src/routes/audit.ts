/**
 * Audit Trail API Routes
 * 
 * Provides read-only access to the GoBD audit trail.
 * No write endpoints — audit entries are created automatically
 * by the audit middleware when financial records are modified.
 */

import { Router, type Request, type Response } from 'express';
import { getDb } from '../database.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { NotFoundError } from '../errors.js';
import {
  getAuditTrail,
  searchAuditLog,
  type AuditEntityType,
  type AuditAction,
} from '../services/auditService.js';
import {
  getPeriodLocks,
  lockPeriod,
  unlockPeriod,
  checkPeriodLock,
  isPeriodLocked,
  type PeriodLock,
} from '../services/periodLockService.js';
import { extractAuditContext } from '../services/auditService.js';

const router = Router();

// ============================================================================
// Audit Trail Routes
// ============================================================================

/**
 * GET /api/audit/:entityType/:entityId
 * Get the audit trail for a specific entity.
 */
router.get('/:entityType/:entityId', asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId } = req.params;
  const limit = parseInt(req.query.limit as string) || 100;

  const validTypes = ['income', 'expense', 'invoice', 'asset', 'period_lock', 'attachment'];
  if (!validTypes.includes(entityType)) {
    return res.status(400).json({
      error: `Invalid entity type. Must be one of: ${validTypes.join(', ')}`
    });
  }

  const db = getDb();
  const entries = getAuditTrail(db, entityType as AuditEntityType, entityId, limit);

  res.json(entries);
}));

/**
 * GET /api/audit/search
 * Search audit logs with filters.
 */
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const {
    entity_type,
    action,
    user_id,
    start_date,
    end_date,
    limit: limitStr,
    offset: offsetStr,
  } = req.query;

  const db = getDb();
  const result = searchAuditLog(db, {
    entityType: entity_type as AuditEntityType,
    action: action as AuditAction | undefined,
    userId: user_id as string,
    startDate: start_date as string,
    endDate: end_date as string,
    limit: parseInt(limitStr as string) || 100,
    offset: parseInt(offsetStr as string) || 0,
  });

  res.json(result);
}));

// ============================================================================
// Period Lock Routes
// ============================================================================

/**
 * GET /api/audit/periods
 * List all period locks.
 */
router.get('/periods', asyncHandler(async (req: Request, res: Response) => {
  const { period_type, year } = req.query;
  const db = getDb();

  const locks = getPeriodLocks(db, {
    periodType: period_type as string,
    year: year ? parseInt(year as string) : undefined,
  });

  // Generate a comprehensive view of all periods for the requested year
  const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
  const periods = generatePeriodStatus(db, targetYear, locks);

  res.json({ locks, periods });
}));

/**
 * POST /api/audit/periods/:key/lock
 * Lock a period.
 */
router.post('/periods/:key/lock', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { reason } = req.body;
  const db = getDb();
  const context = extractAuditContext(req);

  // Infer period type from key format
  let periodType: 'month' | 'quarter' | 'year';
  if (/^\d{4}-\d{2}$/.test(key)) {
    periodType = 'month';
  } else if (/^\d{4}-Q[1-4]$/.test(key)) {
    periodType = 'quarter';
  } else if (/^\d{4}$/.test(key)) {
    periodType = 'year';
  } else {
    return res.status(400).json({
      error: 'Invalid period key. Use YYYY-MM (month), YYYY-Q1..Q4 (quarter), or YYYY (year)'
    });
  }

  const lock = lockPeriod(db, periodType, key, reason, context);
  res.status(201).json(lock);
}));

/**
 * POST /api/audit/periods/:key/unlock
 * Unlock a period. Requires a reason (for audit trail).
 */
router.post('/periods/:key/unlock', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const { reason } = req.body;
  const db = getDb();
  const context = extractAuditContext(req);

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({
      error: 'Reason is required when unlocking a period (GoBD documentation requirement)'
    });
  }

  unlockPeriod(db, key, reason, context);
  res.json({ success: true, message: `Period ${key} unlocked`, reason });
}));

/**
 * GET /api/audit/periods/:key/status
 * Check if a specific period is locked.
 */
router.get('/periods/:key/status', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;
  const db = getDb();

  const locked = isPeriodLocked(db, key);
  const lock = locked ? db.prepare('SELECT * FROM period_locks WHERE period_key = ?').get(key) : null;

  res.json({
    period_key: key,
    locked,
    lock: lock || null,
  });
}));

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a status overview for all periods in a year.
 */
function generatePeriodStatus(
  db: ReturnType<typeof getDb>,
  year: number,
  existingLocks: PeriodLock[]
): Array<{ key: string; type: string; locked: boolean; lock?: PeriodLock }> {
  const lockMap = new Map(existingLocks.map(l => [l.period_key, l]));
  const periods: Array<{ key: string; type: string; locked: boolean; lock?: PeriodLock }> = [];

  // Months
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    const lock = lockMap.get(key);
    periods.push({ key, type: 'month', locked: !!lock, lock });
  }

  // Quarters
  for (let q = 1; q <= 4; q++) {
    const key = `${year}-Q${q}`;
    const lock = lockMap.get(key);
    periods.push({ key, type: 'quarter', locked: !!lock, lock });
  }

  // Year
  const yearKey = String(year);
  const yearLock = lockMap.get(yearKey);
  periods.push({ key: yearKey, type: 'year', locked: !!yearLock, lock: yearLock });

  return periods;
}

export default router;
