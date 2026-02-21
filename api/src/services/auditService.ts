/**
 * GoBD Audit Trail Service
 * 
 * Provides immutable logging of all changes to financial records.
 * Required by GoBD (Grundsätze zur ordnungsmäßigen Führung und
 * Aufbewahrung von Büchern) for German accounting software.
 * 
 * The audit_log table is protected by SQLite triggers that prevent
 * UPDATE and DELETE operations, ensuring immutability.
 */

import type Database from 'better-sqlite3';
import { generateId, getCurrentTimestamp } from '../database.js';
import { createLogger } from '../logger.js';

const log = createLogger('audit');

// ============================================================================
// Types
// ============================================================================

export type AuditEntityType = 'income' | 'expense' | 'invoice' | 'asset' | 'period_lock' | 'attachment';
export type AuditAction = 'create' | 'update' | 'delete' | 'lock' | 'unlock' | 'soft_delete';

export interface AuditChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuditLogEntry {
  id: string;
  entity_type: AuditEntityType;
  entity_id: string;
  action: AuditAction;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  created_at: string;
}

// ============================================================================
// Core Audit Functions
// ============================================================================

/**
 * Log a single audit event. For 'create' and 'delete', pass the full
 * record as new_value or old_value respectively.
 */
export function auditLog(
  db: Database.Database,
  entityType: AuditEntityType,
  entityId: string,
  action: AuditAction,
  changes: AuditChange[],
  context: AuditContext = {}
): void {
  const sessionId = context.sessionId || generateId();
  const now = getCurrentTimestamp();

  const stmt = db.prepare(
    `INSERT INTO audit_log 
     (id, entity_type, entity_id, action, field_name, old_value, new_value, 
      user_id, ip_address, user_agent, session_id, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const runInTransaction = db.transaction(() => {
    for (const change of changes) {
      stmt.run(
        generateId(),
        entityType,
        entityId,
        action,
        change.field,
        change.old !== undefined && change.old !== null ? JSON.stringify(change.old) : null,
        change.new !== undefined && change.new !== null ? JSON.stringify(change.new) : null,
        context.userId || 'system',
        context.ipAddress || null,
        context.userAgent || null,
        sessionId,
        now
      );
    }
  });

  try {
    runInTransaction();
    log.debug(
      { entityType, entityId, action, changeCount: changes.length },
      'Audit log entry created'
    );
  } catch (err) {
    log.error({ err, entityType, entityId, action }, 'Failed to write audit log');
    // Don't throw — audit failures shouldn't block business operations
    // But log prominently for investigation
  }
}

/**
 * Log a CREATE action. Captures the entire new record.
 */
export function auditCreate(
  db: Database.Database,
  entityType: AuditEntityType,
  entityId: string,
  record: Record<string, unknown>,
  context: AuditContext = {}
): void {
  auditLog(db, entityType, entityId, 'create', [
    { field: '*', old: null, new: record }
  ], context);
}

/**
 * Log an UPDATE action. Compares old and new records, only logging changed fields.
 */
export function auditUpdate(
  db: Database.Database,
  entityType: AuditEntityType,
  entityId: string,
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
  context: AuditContext = {}
): void {
  const changes: AuditChange[] = [];

  for (const key of Object.keys(newRecord)) {
    // Skip non-data fields
    if (key === 'created_at' || key === 'updated_at') continue;

    const oldVal = oldRecord[key];
    const newVal = newRecord[key];

    // Compare serialized values to handle type coercion
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, old: oldVal, new: newVal });
    }
  }

  if (changes.length > 0) {
    auditLog(db, entityType, entityId, 'update', changes, context);
  }
}

/**
 * Log a DELETE action. Captures the entire deleted record.
 */
export function auditDelete(
  db: Database.Database,
  entityType: AuditEntityType,
  entityId: string,
  record: Record<string, unknown>,
  context: AuditContext = {}
): void {
  auditLog(db, entityType, entityId, 'delete', [
    { field: '*', old: record, new: null }
  ], context);
}

/**
 * Log a SOFT DELETE action.
 */
export function auditSoftDelete(
  db: Database.Database,
  entityType: AuditEntityType,
  entityId: string,
  record: Record<string, unknown>,
  context: AuditContext = {}
): void {
  auditLog(db, entityType, entityId, 'soft_delete', [
    { field: 'is_deleted', old: 0, new: 1 }
  ], context);
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get audit trail for a specific entity.
 */
export function getAuditTrail(
  db: Database.Database,
  entityType: AuditEntityType,
  entityId: string,
  limit = 100
): AuditLogEntry[] {
  return db.prepare(
    `SELECT * FROM audit_log 
     WHERE entity_type = ? AND entity_id = ? 
     ORDER BY created_at DESC 
     LIMIT ?`
  ).all(entityType, entityId, limit) as AuditLogEntry[];
}

/**
 * Search audit logs with filters.
 */
export function searchAuditLog(
  db: Database.Database,
  filters: {
    entityType?: AuditEntityType;
    action?: AuditAction;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}
): { entries: AuditLogEntry[]; total: number } {
  let countSql = 'SELECT COUNT(*) as total FROM audit_log WHERE 1=1';
  let sql = 'SELECT * FROM audit_log WHERE 1=1';
  const params: unknown[] = [];

  if (filters.entityType) {
    sql += ' AND entity_type = ?';
    countSql += ' AND entity_type = ?';
    params.push(filters.entityType);
  }

  if (filters.action) {
    sql += ' AND action = ?';
    countSql += ' AND action = ?';
    params.push(filters.action);
  }

  if (filters.userId) {
    sql += ' AND user_id = ?';
    countSql += ' AND user_id = ?';
    params.push(filters.userId);
  }

  if (filters.startDate) {
    sql += ' AND created_at >= ?';
    countSql += ' AND created_at >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    sql += ' AND created_at <= ?';
    countSql += ' AND created_at <= ?';
    params.push(filters.endDate);
  }

  const total = (db.prepare(countSql).get(...params) as { total: number }).total;

  sql += ' ORDER BY created_at DESC';
  sql += ` LIMIT ${filters.limit || 100}`;
  sql += ` OFFSET ${filters.offset || 0}`;

  const entries = db.prepare(sql).all(...params) as AuditLogEntry[];

  return { entries, total };
}

/**
 * Extract audit context from an Express request.
 */
export function extractAuditContext(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): AuditContext {
  return {
    userId: 'admin', // Single-user app, always admin
    ipAddress: req.ip || undefined,
    userAgent: (req.headers?.['user-agent'] as string) || undefined,
    sessionId: generateId(),
  };
}
