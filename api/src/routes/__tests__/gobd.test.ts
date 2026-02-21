/**
 * GoBD Compliance Tests
 * 
 * Tests audit trail, period locking, sequential numbering, and retention.
 * These are critical compliance features — test thoroughly.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb, resetTestDb, closeTestDb, insertTestIncome, insertTestExpense, testId, resetIdCounter } from '../../../src/test/setup.js';

// Import services directly (no HTTP needed for unit tests)
import {
  auditLog, auditCreate, auditUpdate, auditDelete, auditSoftDelete,
  getAuditTrail, searchAuditLog,
  type AuditContext,
} from '../../services/auditService.js';
import {
  checkPeriodLock, enforcePeriodLock, lockPeriod, unlockPeriod,
  getPeriodLocks, isPeriodLocked, getQuarterKey, getMonthKey,
} from '../../services/periodLockService.js';
import {
  getNextSequenceNumber, backfillReferenceNumbers,
} from '../../services/sequenceService.js';

// Mock database module
vi.mock('../../database.js', () => ({
  generateId: () => crypto.randomUUID(),
  getCurrentTimestamp: () => new Date().toISOString(),
  getDb: () => { throw new Error('Use db directly in tests'); },
  closeDb: () => {},
}));

let db: Database.Database;

beforeEach(() => {
  db = resetTestDb();
  resetIdCounter();
});

afterAll(() => {
  closeTestDb();
});

// ============================================================================
// Audit Trail Tests
// ============================================================================

describe('Audit Trail', () => {
  const ctx: AuditContext = { userId: 'test-user', sessionId: 'test-session' };

  it('should log a create action', () => {
    const record = { id: 'inc-1', date: '2025-01-15', description: 'Test', net_amount: 1000 };
    auditCreate(db, 'income', 'inc-1', record, ctx);

    const entries = getAuditTrail(db, 'income', 'inc-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('create');
    expect(entries[0].field_name).toBe('*');
    expect(entries[0].user_id).toBe('test-user');
    expect(JSON.parse(entries[0].new_value!)).toEqual(record);
    expect(entries[0].old_value).toBeNull();
  });

  it('should log an update action with changed fields only', () => {
    const oldRecord = { id: 'inc-1', description: 'Old desc', net_amount: 1000, date: '2025-01-15' };
    const newRecord = { id: 'inc-1', description: 'New desc', net_amount: 1500, date: '2025-01-15' };
    auditUpdate(db, 'income', 'inc-1', oldRecord, newRecord, ctx);

    const entries = getAuditTrail(db, 'income', 'inc-1');
    expect(entries).toHaveLength(2); // description + net_amount changes
    
    const descChange = entries.find(e => e.field_name === 'description');
    expect(descChange).toBeDefined();
    expect(JSON.parse(descChange!.old_value!)).toBe('Old desc');
    expect(JSON.parse(descChange!.new_value!)).toBe('New desc');

    const amountChange = entries.find(e => e.field_name === 'net_amount');
    expect(amountChange).toBeDefined();
    expect(JSON.parse(amountChange!.old_value!)).toBe(1000);
    expect(JSON.parse(amountChange!.new_value!)).toBe(1500);
  });

  it('should not log when no fields changed', () => {
    const record = { id: 'inc-1', description: 'Same', net_amount: 1000 };
    auditUpdate(db, 'income', 'inc-1', record, record, ctx);

    const entries = getAuditTrail(db, 'income', 'inc-1');
    expect(entries).toHaveLength(0);
  });

  it('should log a delete action with full old record', () => {
    const record = { id: 'inc-1', date: '2025-01-15', description: 'Deleted', net_amount: 1000 };
    auditDelete(db, 'income', 'inc-1', record, ctx);

    const entries = getAuditTrail(db, 'income', 'inc-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('delete');
    expect(JSON.parse(entries[0].old_value!)).toEqual(record);
    expect(entries[0].new_value).toBeNull();
  });

  it('should log a soft delete action', () => {
    const record = { id: 'inc-1', is_deleted: 0 };
    auditSoftDelete(db, 'income', 'inc-1', record, ctx);

    const entries = getAuditTrail(db, 'income', 'inc-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('soft_delete');
  });

  it('should enforce immutability via triggers', () => {
    // Add the GoBD immutability triggers to the test DB
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
        BEFORE DELETE ON audit_log
      BEGIN
        SELECT RAISE(ABORT, 'GoBD: Audit log entries cannot be deleted');
      END;
      CREATE TRIGGER IF NOT EXISTS prevent_audit_update
        BEFORE UPDATE ON audit_log
      BEGIN
        SELECT RAISE(ABORT, 'GoBD: Audit log entries cannot be modified');
      END;
    `);

    auditCreate(db, 'income', 'inc-1', { test: true }, ctx);
    const entries = getAuditTrail(db, 'income', 'inc-1');
    expect(entries).toHaveLength(1);

    // Attempt to delete should fail (trigger)
    expect(() => {
      db.prepare('DELETE FROM audit_log WHERE entity_id = ?').run('inc-1');
    }).toThrow(/cannot be deleted/);

    // Attempt to update should fail (trigger)
    expect(() => {
      db.prepare('UPDATE audit_log SET action = ? WHERE entity_id = ?').run('modified', 'inc-1');
    }).toThrow(/cannot be modified/);

    // Entries should be unchanged
    const entriesAfter = getAuditTrail(db, 'income', 'inc-1');
    expect(entriesAfter).toHaveLength(1);
    expect(entriesAfter[0].action).toBe('create');
  });

  it('should search audit logs with filters', () => {
    auditCreate(db, 'income', 'inc-1', { a: 1 }, ctx);
    auditCreate(db, 'expense', 'exp-1', { b: 2 }, ctx);
    auditCreate(db, 'income', 'inc-2', { c: 3 }, ctx);

    // Filter by entity type
    const incomeOnly = searchAuditLog(db, { entityType: 'income' });
    expect(incomeOnly.entries).toHaveLength(2);
    expect(incomeOnly.total).toBe(2);

    // Filter by action
    const creates = searchAuditLog(db, { action: 'create' });
    expect(creates.entries).toHaveLength(3);
  });

  it('should paginate search results', () => {
    for (let i = 0; i < 5; i++) {
      auditCreate(db, 'income', `inc-${i}`, { i }, ctx);
    }

    const page1 = searchAuditLog(db, { limit: 2, offset: 0 });
    expect(page1.entries).toHaveLength(2);
    expect(page1.total).toBe(5);

    const page2 = searchAuditLog(db, { limit: 2, offset: 2 });
    expect(page2.entries).toHaveLength(2);
  });
});

// ============================================================================
// Period Locking Tests
// ============================================================================

describe('Period Locking', () => {
  const ctx: AuditContext = { userId: 'test-user' };

  it('should lock a month period', () => {
    const lock = lockPeriod(db, 'month', '2025-01', 'USt-VA filed', ctx);
    expect(lock.period_type).toBe('month');
    expect(lock.period_key).toBe('2025-01');
    expect(lock.reason).toBe('USt-VA filed');
  });

  it('should lock a quarter period', () => {
    const lock = lockPeriod(db, 'quarter', '2025-Q1', 'Quarter closed', ctx);
    expect(lock.period_type).toBe('quarter');
    expect(lock.period_key).toBe('2025-Q1');
  });

  it('should lock a year period', () => {
    const lock = lockPeriod(db, 'year', '2025', 'Year-end closing', ctx);
    expect(lock.period_type).toBe('year');
    expect(lock.period_key).toBe('2025');
  });

  it('should reject invalid period key format', () => {
    expect(() => lockPeriod(db, 'month', '2025-1', 'bad', ctx)).toThrow(/Invalid period key/);
    expect(() => lockPeriod(db, 'quarter', '2025-Q5', 'bad', ctx)).toThrow(/Invalid period key/);
    expect(() => lockPeriod(db, 'year', '25', 'bad', ctx)).toThrow(/Invalid period key/);
  });

  it('should prevent double-locking', () => {
    lockPeriod(db, 'month', '2025-01', 'First lock', ctx);
    expect(() => lockPeriod(db, 'month', '2025-01', 'Second lock', ctx)).toThrow(/already locked/);
  });

  it('should detect locked period for a date', () => {
    lockPeriod(db, 'month', '2025-01', 'January locked', ctx);

    const lock = checkPeriodLock(db, '2025-01-15');
    expect(lock).not.toBeNull();
    expect(lock!.period_key).toBe('2025-01');

    // Different month should not be locked
    const noLock = checkPeriodLock(db, '2025-02-15');
    expect(noLock).toBeNull();
  });

  it('should detect quarter lock for dates within quarter', () => {
    lockPeriod(db, 'quarter', '2025-Q1', 'Q1 locked', ctx);

    expect(checkPeriodLock(db, '2025-01-15')).not.toBeNull();
    expect(checkPeriodLock(db, '2025-02-15')).not.toBeNull();
    expect(checkPeriodLock(db, '2025-03-31')).not.toBeNull();
    expect(checkPeriodLock(db, '2025-04-01')).toBeNull();
  });

  it('should detect year lock for any date in year', () => {
    lockPeriod(db, 'year', '2025', 'Year locked', ctx);

    expect(checkPeriodLock(db, '2025-01-01')).not.toBeNull();
    expect(checkPeriodLock(db, '2025-12-31')).not.toBeNull();
    expect(checkPeriodLock(db, '2026-01-01')).toBeNull();
  });

  it('should enforce period lock (throw on locked period)', () => {
    lockPeriod(db, 'month', '2025-01', 'Locked', ctx);

    expect(() => enforcePeriodLock(db, '2025-01-15', 'create')).toThrow(/gesperrt/);
    expect(() => enforcePeriodLock(db, '2025-02-15', 'create')).not.toThrow();
  });

  it('should unlock a period with reason', () => {
    lockPeriod(db, 'month', '2025-01', 'Locked', ctx);
    expect(isPeriodLocked(db, '2025-01')).toBe(true);

    unlockPeriod(db, '2025-01', 'Correction needed', ctx);
    expect(isPeriodLocked(db, '2025-01')).toBe(false);
  });

  it('should create audit trail entries for lock/unlock', () => {
    lockPeriod(db, 'month', '2025-01', 'Filed', ctx);
    
    const lockEntries = searchAuditLog(db, { action: 'lock' as any });
    expect(lockEntries.entries.length).toBeGreaterThanOrEqual(1);

    unlockPeriod(db, '2025-01', 'Need to correct', ctx);
    
    const unlockEntries = searchAuditLog(db, { action: 'unlock' as any });
    expect(unlockEntries.entries.length).toBeGreaterThanOrEqual(1);
  });

  it('should list all period locks', () => {
    lockPeriod(db, 'month', '2025-01', 'Jan', ctx);
    lockPeriod(db, 'month', '2025-02', 'Feb', ctx);
    lockPeriod(db, 'quarter', '2025-Q1', 'Q1', ctx);

    const all = getPeriodLocks(db);
    expect(all).toHaveLength(3);

    const monthsOnly = getPeriodLocks(db, { periodType: 'month' });
    expect(monthsOnly).toHaveLength(2);
  });

  it('should correctly compute quarter key', () => {
    expect(getQuarterKey('2025-01-15')).toBe('2025-Q1');
    expect(getQuarterKey('2025-03-31')).toBe('2025-Q1');
    expect(getQuarterKey('2025-04-01')).toBe('2025-Q2');
    expect(getQuarterKey('2025-06-30')).toBe('2025-Q2');
    expect(getQuarterKey('2025-07-01')).toBe('2025-Q3');
    expect(getQuarterKey('2025-10-01')).toBe('2025-Q4');
    expect(getQuarterKey('2025-12-31')).toBe('2025-Q4');
  });

  it('should correctly compute month key', () => {
    expect(getMonthKey('2025-01-15')).toBe('2025-01');
    expect(getMonthKey('2025-12-31')).toBe('2025-12');
  });
});

// ============================================================================
// Sequential Numbering Tests
// ============================================================================

describe('Sequential Numbering', () => {
  it('should generate sequential income reference numbers', () => {
    const ref1 = getNextSequenceNumber(db, 'EI', 2025);
    const ref2 = getNextSequenceNumber(db, 'EI', 2025);
    const ref3 = getNextSequenceNumber(db, 'EI', 2025);

    expect(ref1).toBe('EI-2025-001');
    expect(ref2).toBe('EI-2025-002');
    expect(ref3).toBe('EI-2025-003');
  });

  it('should generate sequential expense reference numbers', () => {
    const ref1 = getNextSequenceNumber(db, 'EA', 2025);
    const ref2 = getNextSequenceNumber(db, 'EA', 2025);

    expect(ref1).toBe('EA-2025-001');
    expect(ref2).toBe('EA-2025-002');
  });

  it('should maintain separate sequences per year', () => {
    const ref2025_1 = getNextSequenceNumber(db, 'EI', 2025);
    const ref2025_2 = getNextSequenceNumber(db, 'EI', 2025);
    const ref2026_1 = getNextSequenceNumber(db, 'EI', 2026);

    expect(ref2025_1).toBe('EI-2025-001');
    expect(ref2025_2).toBe('EI-2025-002');
    expect(ref2026_1).toBe('EI-2026-001');
  });

  it('should maintain separate sequences per type', () => {
    const income1 = getNextSequenceNumber(db, 'EI', 2025);
    const expense1 = getNextSequenceNumber(db, 'EA', 2025);
    const income2 = getNextSequenceNumber(db, 'EI', 2025);

    expect(income1).toBe('EI-2025-001');
    expect(expense1).toBe('EA-2025-001');
    expect(income2).toBe('EI-2025-002');
  });

  it('should backfill existing records without reference numbers', () => {
    // Insert records without reference numbers
    insertTestIncome(db, { date: '2025-01-10', description: 'First' });
    insertTestIncome(db, { date: '2025-01-20', description: 'Second' });
    insertTestExpense(db, { date: '2025-02-01', description: 'Expense 1' });

    const result = backfillReferenceNumbers(db);
    expect(result.income).toBe(2);
    expect(result.expenses).toBe(1);

    // Verify reference numbers were assigned
    const incomes = db.prepare(
      'SELECT reference_number FROM income ORDER BY date ASC'
    ).all() as Array<{ reference_number: string }>;
    expect(incomes[0].reference_number).toBe('EI-2025-001');
    expect(incomes[1].reference_number).toBe('EI-2025-002');

    const expenses = db.prepare(
      'SELECT reference_number FROM expenses ORDER BY date ASC'
    ).all() as Array<{ reference_number: string }>;
    expect(expenses[0].reference_number).toBe('EA-2025-001');
  });

  it('should not create gaps after backfill + new records', () => {
    insertTestIncome(db, { date: '2025-01-10' });
    insertTestIncome(db, { date: '2025-01-20' });
    backfillReferenceNumbers(db);

    // Now create a new record — should continue from where backfill left off
    const ref = getNextSequenceNumber(db, 'EI', 2025);
    expect(ref).toBe('EI-2025-003');
  });
});

// ============================================================================
// Integration: Period Lock + Financial Record Operations
// ============================================================================

describe('Period Lock + Record Operations', () => {
  const ctx: AuditContext = { userId: 'test-user' };

  it('should block income creation in locked period', () => {
    lockPeriod(db, 'month', '2025-01', 'Filed', ctx);

    // This should throw because January 2025 is locked
    expect(() => {
      enforcePeriodLock(db, '2025-01-15', 'Einnahmen erstellen');
    }).toThrow(/gesperrt/);
  });

  it('should allow income creation in unlocked period', () => {
    lockPeriod(db, 'month', '2025-01', 'Filed', ctx);

    // February should be fine
    expect(() => {
      enforcePeriodLock(db, '2025-02-15', 'Einnahmen erstellen');
    }).not.toThrow();
  });

  it('should block modification of records in locked period', () => {
    // Create income in January
    insertTestIncome(db, { date: '2025-01-15', description: 'Jan income' });

    // Lock January
    lockPeriod(db, 'month', '2025-01', 'Filed', ctx);

    // Try to modify — should fail
    expect(() => {
      enforcePeriodLock(db, '2025-01-15', 'Einnahmen ändern');
    }).toThrow(/gesperrt/);
  });
});
