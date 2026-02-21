/**
 * Missing Receipt Service — Tests
 *
 * Covers:
 * ✅ Creates low severity alert for expense < €150, < 30 days
 * ✅ Creates medium severity alert for expense €150-€1000
 * ✅ Creates high severity alert for expense > €1000
 * ✅ Upgrades severity when expense ages (low → medium at 30 days)
 * ✅ Dismisses alert when receipt is uploaded
 * ✅ Does not create alert for expense with receipt
 * ✅ Does not create duplicate alerts for same expense
 * ✅ Excludes soft-deleted expenses
 * ✅ Excludes duplicate-marked expenses
 * ✅ Returns stats grouped by severity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  checkExpenseForMissingReceipt,
  checkMissingReceipts,
  dismissAlert,
  restoreAlert,
  getAlertStats,
  getActiveAlerts,
  dailyScan,
  removeAlertForExpense,
} from '../missingReceiptService.js';

// ============================================================================
// Test Helpers
// ============================================================================

let db: Database.Database;

function freshDb(): Database.Database {
  const d = new Database(':memory:');
  d.pragma('foreign_keys = ON');
  d.exec(`
    CREATE TABLE expenses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      vendor TEXT,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'software',
      net_amount REAL NOT NULL,
      vat_rate REAL DEFAULT 19,
      vat_amount REAL NOT NULL,
      gross_amount REAL NOT NULL,
      euer_line INTEGER DEFAULT 27,
      euer_category TEXT,
      payment_method TEXT,
      receipt_path TEXT,
      ust_period TEXT,
      ust_reported INTEGER DEFAULT 0,
      deductible_percent INTEGER DEFAULT 100,
      vorsteuer_claimed INTEGER DEFAULT 0,
      is_recurring INTEGER DEFAULT 0,
      recurring_frequency TEXT,
      is_gwg INTEGER DEFAULT 0,
      asset_id TEXT,
      reference_number TEXT,
      is_deleted INTEGER DEFAULT 0,
      is_duplicate BOOLEAN DEFAULT FALSE,
      duplicate_of_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE missing_receipt_alerts (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
      reason TEXT NOT NULL,
      dismissed BOOLEAN DEFAULT FALSE,
      dismissed_at TEXT,
      dismissed_by TEXT
    );
    CREATE INDEX idx_missing_receipt_alerts_expense ON missing_receipt_alerts(expense_id);
    CREATE INDEX idx_missing_receipt_alerts_severity ON missing_receipt_alerts(severity, dismissed);
  `);
  return d;
}

/** Insert a test expense and return its ID */
function insertExpense(
  d: Database.Database,
  overrides: Partial<{
    id: string;
    date: string;
    vendor: string;
    description: string;
    gross_amount: number;
    net_amount: number;
    vat_amount: number;
    receipt_path: string | null;
    is_deleted: number;
    is_duplicate: number;
  }> = {},
): string {
  const id = overrides.id ?? `exp-${Math.random().toString(36).slice(2, 8)}`;
  const grossAmount = overrides.gross_amount ?? 100;
  const netAmount = overrides.net_amount ?? grossAmount / 1.19;
  const vatAmount = overrides.vat_amount ?? grossAmount - netAmount;

  d.prepare(`
    INSERT INTO expenses (id, date, vendor, description, category, net_amount, vat_rate, vat_amount, gross_amount, receipt_path, is_deleted, is_duplicate, created_at)
    VALUES (?, ?, ?, ?, 'software', ?, 19, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    id,
    overrides.date ?? new Date().toISOString().slice(0, 10),
    overrides.vendor ?? 'Test Vendor',
    overrides.description ?? 'Test Expense',
    netAmount,
    vatAmount,
    grossAmount,
    overrides.receipt_path ?? null,
    overrides.is_deleted ?? 0,
    overrides.is_duplicate ?? 0,
  );
  return id;
}

/** Helper to create a date string N days ago */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  db = freshDb();
});

describe('missingReceiptService', () => {
  // --------------------------------------------------------------------------
  // Severity Rules
  // --------------------------------------------------------------------------

  describe('severity classification', () => {
    it('creates LOW severity alert for expense < €150, < 30 days', () => {
      const expId = insertExpense(db, {
        gross_amount: 99.99,
        date: daysAgo(5),
        vendor: 'Coffee Shop',
      });

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('low');
      expect(alerts[0].expense_id).toBe(expId);
      expect(alerts[0].amount).toBe(99.99);
      expect(alerts[0].vendor).toBe('Coffee Shop');
    });

    it('creates MEDIUM severity alert for expense €150-€1000, < 30 days', () => {
      const expId = insertExpense(db, {
        gross_amount: 500,
        date: daysAgo(10),
        vendor: 'Office Depot',
      });

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('medium');
    });

    it('creates MEDIUM severity alert for expense < €150 but > 30 days', () => {
      const expId = insertExpense(db, {
        gross_amount: 80,
        date: daysAgo(35),
        vendor: 'Bakery',
      });

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('medium');
    });

    it('creates HIGH severity alert for expense > €1000', () => {
      const expId = insertExpense(db, {
        gross_amount: 1234.56,
        date: daysAgo(3),
        vendor: 'AWS EMEA',
      });

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('high');
      expect(alerts[0].reason).toContain('1234.56');
      expect(alerts[0].reason).toContain('AWS EMEA');
    });

    it('creates HIGH severity alert for expense > 60 days old', () => {
      const expId = insertExpense(db, {
        gross_amount: 50,
        date: daysAgo(65),
        vendor: 'Old Purchase',
      });

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('high');
    });
  });

  // --------------------------------------------------------------------------
  // Severity Upgrades
  // --------------------------------------------------------------------------

  describe('severity upgrades', () => {
    it('upgrades severity when expense ages (low → medium at 30 days)', () => {
      // First insert with a date 5 days ago → low
      const expId = insertExpense(db, {
        gross_amount: 80,
        date: daysAgo(5),
        vendor: 'Test',
      });

      checkExpenseForMissingReceipt(db, expId);
      let alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('low');

      // Now update the expense date to 35 days ago and re-check
      db.prepare('UPDATE expenses SET date = ? WHERE id = ?').run(daysAgo(35), expId);

      checkExpenseForMissingReceipt(db, expId);
      alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('medium');
    });

    it('upgrades severity from medium → high at 60 days', () => {
      const expId = insertExpense(db, {
        gross_amount: 80,
        date: daysAgo(35),
        vendor: 'Test',
      });

      checkExpenseForMissingReceipt(db, expId);
      let alerts = getActiveAlerts(db);
      expect(alerts[0].severity).toBe('medium');

      // Age it to 65 days
      db.prepare('UPDATE expenses SET date = ? WHERE id = ?').run(daysAgo(65), expId);

      checkExpenseForMissingReceipt(db, expId);
      alerts = getActiveAlerts(db);
      expect(alerts[0].severity).toBe('high');
    });
  });

  // --------------------------------------------------------------------------
  // Receipt Handling
  // --------------------------------------------------------------------------

  describe('receipt handling', () => {
    it('does NOT create alert for expense with receipt', () => {
      const expId = insertExpense(db, {
        gross_amount: 500,
        receipt_path: '/path/to/receipt.pdf',
      });

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(0);
    });

    it('removes alert when receipt is uploaded (auto-dismiss)', () => {
      const expId = insertExpense(db, {
        gross_amount: 500,
        date: daysAgo(5),
      });

      // Create alert
      checkExpenseForMissingReceipt(db, expId);
      expect(getActiveAlerts(db)).toHaveLength(1);

      // Simulate receipt upload
      db.prepare('UPDATE expenses SET receipt_path = ? WHERE id = ?').run('/receipts/invoice.pdf', expId);

      // Re-check should remove the alert
      checkExpenseForMissingReceipt(db, expId);
      expect(getActiveAlerts(db)).toHaveLength(0);
    });

    it('removeAlertForExpense removes alert when receipt is uploaded', () => {
      const expId = insertExpense(db, {
        gross_amount: 500,
        date: daysAgo(5),
      });

      checkExpenseForMissingReceipt(db, expId);
      expect(getActiveAlerts(db)).toHaveLength(1);

      removeAlertForExpense(db, expId);
      expect(getActiveAlerts(db)).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Deduplication & Filtering
  // --------------------------------------------------------------------------

  describe('deduplication and filtering', () => {
    it('does NOT create duplicate alerts for the same expense', () => {
      const expId = insertExpense(db, {
        gross_amount: 200,
        date: daysAgo(5),
      });

      checkExpenseForMissingReceipt(db, expId);
      checkExpenseForMissingReceipt(db, expId);
      checkExpenseForMissingReceipt(db, expId);

      // Should still only have one alert row
      const allAlerts = db.prepare('SELECT * FROM missing_receipt_alerts WHERE expense_id = ?').all(expId);
      expect(allAlerts).toHaveLength(1);
    });

    it('excludes soft-deleted expenses', () => {
      const expId = insertExpense(db, {
        gross_amount: 200,
        date: daysAgo(5),
        is_deleted: 1,
      });

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(0);
    });

    it('excludes duplicate-marked expenses', () => {
      const expId = insertExpense(db, {
        gross_amount: 200,
        date: daysAgo(5),
        is_duplicate: 1,
      });

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Dismiss / Restore
  // --------------------------------------------------------------------------

  describe('dismiss and restore', () => {
    it('dismisses an alert', () => {
      const expId = insertExpense(db, { gross_amount: 200, date: daysAgo(5) });
      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);

      dismissAlert(db, alerts[0].id);

      expect(getActiveAlerts(db)).toHaveLength(0);

      // But it still exists in DB
      const all = db.prepare('SELECT * FROM missing_receipt_alerts WHERE id = ?').get(alerts[0].id) as any;
      expect(all.dismissed).toBeTruthy();
      expect(all.dismissed_at).toBeTruthy();
    });

    it('restores a dismissed alert', () => {
      const expId = insertExpense(db, { gross_amount: 200, date: daysAgo(5) });
      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      dismissAlert(db, alerts[0].id);
      expect(getActiveAlerts(db)).toHaveLength(0);

      restoreAlert(db, alerts[0].id);
      expect(getActiveAlerts(db)).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  describe('stats', () => {
    it('returns stats grouped by severity', () => {
      // Low
      insertExpense(db, { id: 'e1', gross_amount: 50, date: daysAgo(2) });
      insertExpense(db, { id: 'e2', gross_amount: 80, date: daysAgo(3) });
      // Medium
      insertExpense(db, { id: 'e3', gross_amount: 500, date: daysAgo(5) });
      insertExpense(db, { id: 'e4', gross_amount: 999, date: daysAgo(10) });
      insertExpense(db, { id: 'e5', gross_amount: 40, date: daysAgo(35) });
      // High
      insertExpense(db, { id: 'e6', gross_amount: 1500, date: daysAgo(1) });
      insertExpense(db, { id: 'e7', gross_amount: 20, date: daysAgo(65) });

      // Run scan on all
      for (const eid of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7']) {
        checkExpenseForMissingReceipt(db, eid);
      }

      const stats = getAlertStats(db);
      expect(stats.total).toBe(7);
      expect(stats.low).toBe(2);
      expect(stats.medium).toBe(3);
      expect(stats.high).toBe(2);
    });

    it('excludes dismissed alerts from stats', () => {
      insertExpense(db, { id: 'e1', gross_amount: 50, date: daysAgo(2) });
      insertExpense(db, { id: 'e2', gross_amount: 1500, date: daysAgo(1) });

      checkExpenseForMissingReceipt(db, 'e1');
      checkExpenseForMissingReceipt(db, 'e2');

      const alerts = getActiveAlerts(db);
      dismissAlert(db, alerts[0].id);

      const stats = getAlertStats(db);
      expect(stats.total).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Bulk Scan
  // --------------------------------------------------------------------------

  describe('bulk scan (checkMissingReceipts / dailyScan)', () => {
    it('checkMissingReceipts returns all active alerts with enriched data', () => {
      insertExpense(db, { id: 'e1', gross_amount: 50, date: daysAgo(2), vendor: 'Vendor A' });
      insertExpense(db, { id: 'e2', gross_amount: 500, date: daysAgo(10), vendor: 'Vendor B' });
      // This one has a receipt — should not generate alert
      insertExpense(db, { id: 'e3', gross_amount: 999, receipt_path: '/receipt.pdf' });

      checkExpenseForMissingReceipt(db, 'e1');
      checkExpenseForMissingReceipt(db, 'e2');
      checkExpenseForMissingReceipt(db, 'e3');

      const alerts = checkMissingReceipts(db);
      expect(alerts).toHaveLength(2);

      const a1 = alerts.find(a => a.expense_id === 'e1')!;
      expect(a1).toBeDefined();
      expect(a1.amount).toBe(50);
      expect(a1.vendor).toBe('Vendor A');
      expect(a1.days_outstanding).toBeGreaterThanOrEqual(2);
      expect(a1.dismissed).toBe(false);
    });

    it('dailyScan scans all expenses without receipts', () => {
      insertExpense(db, { id: 'e1', gross_amount: 50, date: daysAgo(2) });
      insertExpense(db, { id: 'e2', gross_amount: 500, date: daysAgo(10) });
      insertExpense(db, { id: 'e3', gross_amount: 100, receipt_path: '/r.pdf' });
      insertExpense(db, { id: 'e4', gross_amount: 200, is_deleted: 1 });

      dailyScan(db);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles expense with null vendor gracefully', () => {
      const expId = insertExpense(db, {
        gross_amount: 100,
        date: daysAgo(5),
        vendor: undefined as any, // Will be NULL in DB
      });
      // Override vendor to NULL
      db.prepare('UPDATE expenses SET vendor = NULL WHERE id = ?').run(expId);

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].vendor).toBe('');
    });

    it('handles expense at exact €150 threshold as medium', () => {
      const expId = insertExpense(db, {
        gross_amount: 150,
        date: daysAgo(5),
      });

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('medium');
    });

    it('handles expense at exact €1000 threshold as medium (not high)', () => {
      const expId = insertExpense(db, {
        gross_amount: 1000,
        date: daysAgo(5),
      });

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);
      // €1000 is ≤ €1000, so medium (high is > €1000)
      expect(alerts[0].severity).toBe('medium');
    });

    it('handles expense with empty string receipt_path as missing receipt', () => {
      const expId = insertExpense(db, {
        gross_amount: 200,
        date: daysAgo(5),
        receipt_path: '',
      });

      checkExpenseForMissingReceipt(db, expId);

      const alerts = getActiveAlerts(db);
      expect(alerts).toHaveLength(1);
    });
  });
});
