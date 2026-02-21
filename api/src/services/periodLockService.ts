/**
 * Period Locking Service (Festschreibung)
 * 
 * GoBD requires that after a tax period is filed (e.g., USt-VA submitted),
 * all records in that period must be locked against modification.
 * 
 * Supports locking by month, quarter, or year.
 */

import type Database from 'better-sqlite3';
import { generateId, getCurrentTimestamp } from '../database.js';
import { createLogger } from '../logger.js';
import { auditLog, type AuditContext } from './auditService.js';
import { ValidationError } from '../errors.js';

const log = createLogger('period-lock');

// ============================================================================
// Types
// ============================================================================

export interface PeriodLock {
  id: string;
  period_type: 'month' | 'quarter' | 'year';
  period_key: string;  // '2025-01', '2025-Q1', '2025'
  locked_at: string;
  locked_by: string;
  reason: string | null;
  created_at: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the quarter key for a date string (YYYY-MM-DD)
 */
export function getQuarterKey(date: string): string {
  const month = parseInt(date.substring(5, 7), 10);
  const year = date.substring(0, 4);
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

/**
 * Get the month key for a date string (YYYY-MM-DD)
 */
export function getMonthKey(date: string): string {
  return date.substring(0, 7); // '2025-01'
}

/**
 * Get the year key for a date string (YYYY-MM-DD)
 */
export function getYearKey(date: string): string {
  return date.substring(0, 4); // '2025'
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if a date falls within any locked period.
 * Returns the lock if found, null otherwise.
 */
export function checkPeriodLock(
  db: Database.Database,
  date: string
): PeriodLock | null {
  const month = getMonthKey(date);
  const quarter = getQuarterKey(date);
  const year = getYearKey(date);

  const lock = db.prepare(
    `SELECT * FROM period_locks WHERE period_key IN (?, ?, ?) LIMIT 1`
  ).get(month, quarter, year) as PeriodLock | undefined;

  return lock || null;
}

/**
 * Enforce period lock — throws ValidationError if the date is in a locked period.
 * Call this before any write operation on financial records.
 */
export function enforcePeriodLock(
  db: Database.Database,
  date: string,
  operationDescription = 'modify records'
): void {
  const lock = checkPeriodLock(db, date);
  if (lock) {
    throw new ValidationError(
      `Zeitraum ${lock.period_key} ist seit ${lock.locked_at} gesperrt` +
      (lock.reason ? ` (${lock.reason})` : '') +
      `. ${operationDescription} ist nicht erlaubt. ` +
      `Entsperren Sie den Zeitraum zuerst, um Änderungen vorzunehmen.`
    );
  }
}

/**
 * Lock a period.
 */
export function lockPeriod(
  db: Database.Database,
  periodType: 'month' | 'quarter' | 'year',
  periodKey: string,
  reason?: string,
  context: AuditContext = {}
): PeriodLock {
  // Validate period key format
  const validFormats: Record<string, RegExp> = {
    month: /^\d{4}-\d{2}$/,
    quarter: /^\d{4}-Q[1-4]$/,
    year: /^\d{4}$/,
  };

  if (!validFormats[periodType]?.test(periodKey)) {
    throw new ValidationError(
      `Invalid period key '${periodKey}' for type '${periodType}'`
    );
  }

  // Check if already locked
  const existing = db.prepare(
    'SELECT * FROM period_locks WHERE period_key = ?'
  ).get(periodKey) as PeriodLock | undefined;

  if (existing) {
    throw new ValidationError(
      `Period ${periodKey} is already locked since ${existing.locked_at}`
    );
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO period_locks (id, period_type, period_key, locked_at, locked_by, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, periodType, periodKey, now,
    context.userId || 'system',
    reason || null, now
  );

  // Audit log the lock
  auditLog(db, 'period_lock', id, 'lock', [
    { field: 'period_key', old: null, new: periodKey },
    { field: 'period_type', old: null, new: periodType },
    { field: 'reason', old: null, new: reason || null },
  ], context);

  log.info({ periodKey, periodType, reason }, 'Period locked');

  return db.prepare('SELECT * FROM period_locks WHERE id = ?').get(id) as PeriodLock;
}

/**
 * Unlock a period. This is a sensitive operation and should require confirmation.
 */
export function unlockPeriod(
  db: Database.Database,
  periodKey: string,
  reason: string,
  context: AuditContext = {}
): void {
  const existing = db.prepare(
    'SELECT * FROM period_locks WHERE period_key = ?'
  ).get(periodKey) as PeriodLock | undefined;

  if (!existing) {
    throw new ValidationError(`Period ${periodKey} is not locked`);
  }

  // Audit log BEFORE deletion (record the unlock event)
  auditLog(db, 'period_lock', existing.id, 'unlock', [
    { field: 'period_key', old: periodKey, new: null },
    { field: 'unlock_reason', old: null, new: reason },
  ], context);

  db.prepare('DELETE FROM period_locks WHERE period_key = ?').run(periodKey);

  log.warn({ periodKey, reason }, 'Period unlocked (requires documentation)');
}

/**
 * Get all period locks, optionally filtered.
 */
export function getPeriodLocks(
  db: Database.Database,
  filters: { periodType?: string; year?: number } = {}
): PeriodLock[] {
  let sql = 'SELECT * FROM period_locks WHERE 1=1';
  const params: unknown[] = [];

  if (filters.periodType) {
    sql += ' AND period_type = ?';
    params.push(filters.periodType);
  }

  if (filters.year) {
    sql += ' AND period_key LIKE ?';
    params.push(`${filters.year}%`);
  }

  sql += ' ORDER BY period_key ASC';

  return db.prepare(sql).all(...params) as PeriodLock[];
}

/**
 * Check if a specific period is locked.
 */
export function isPeriodLocked(
  db: Database.Database,
  periodKey: string
): boolean {
  const lock = db.prepare(
    'SELECT 1 FROM period_locks WHERE period_key = ?'
  ).get(periodKey);
  return !!lock;
}
