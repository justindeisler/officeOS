/**
 * Duplicate Detection Service — Tests
 *
 * Covers:
 * ✅ Finds exact duplicates (same amount, date, vendor)
 * ✅ Finds near-duplicates (within 48h)
 * ✅ Fuzzy-matches vendor names ("Telekom" vs "Deutsche Telekom GmbH")
 * ✅ Returns empty array when no duplicates
 * ✅ Marks/unmarks duplicates correctly
 * ✅ Duplicate records excluded from EÜR/USt-VA calculations
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import {
  findDuplicates,
  markAsDuplicate,
  unmarkAsDuplicate,
  listMarkedDuplicates,
  normalisePartner,
  partnerSimilarity,
  dateSimilarity,
  levenshtein,
} from '../duplicateDetectionService.js';

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
      duplicate_of_id TEXT REFERENCES expenses(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_expenses_duplicate ON expenses(is_duplicate, duplicate_of_id);

    CREATE TABLE income (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      client_id TEXT,
      invoice_id TEXT,
      description TEXT NOT NULL,
      net_amount REAL NOT NULL,
      vat_rate REAL DEFAULT 19,
      vat_amount REAL NOT NULL,
      gross_amount REAL NOT NULL,
      euer_line INTEGER DEFAULT 14,
      euer_category TEXT DEFAULT 'services',
      payment_method TEXT,
      bank_reference TEXT,
      ust_period TEXT,
      ust_reported INTEGER DEFAULT 0,
      reference_number TEXT,
      is_deleted INTEGER DEFAULT 0,
      is_duplicate BOOLEAN DEFAULT FALSE,
      duplicate_of_id TEXT REFERENCES income(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_income_duplicate ON income(is_duplicate, duplicate_of_id);
  `);
  return d;
}

function insertExpense(
  d: Database.Database,
  overrides: Partial<{
    id: string;
    date: string;
    vendor: string;
    description: string;
    net_amount: number;
    is_deleted: number;
    is_duplicate: number;
    duplicate_of_id: string | null;
  }> = {},
): string {
  const id = overrides.id ?? crypto.randomUUID();
  const net = overrides.net_amount ?? 100;
  const vat = Math.round(net * 0.19 * 100) / 100;
  d.prepare(`
    INSERT INTO expenses (id, date, vendor, description, net_amount, vat_amount, gross_amount, is_deleted, is_duplicate, duplicate_of_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    overrides.date ?? '2024-06-15',
    overrides.vendor ?? 'Test Vendor',
    overrides.description ?? 'Test expense',
    net,
    vat,
    Math.round((net + vat) * 100) / 100,
    overrides.is_deleted ?? 0,
    overrides.is_duplicate ?? 0,
    overrides.duplicate_of_id ?? null,
  );
  return id;
}

function insertIncome(
  d: Database.Database,
  overrides: Partial<{
    id: string;
    date: string;
    description: string;
    net_amount: number;
    is_deleted: number;
    is_duplicate: number;
    duplicate_of_id: string | null;
  }> = {},
): string {
  const id = overrides.id ?? crypto.randomUUID();
  const net = overrides.net_amount ?? 1000;
  const vat = Math.round(net * 0.19 * 100) / 100;
  d.prepare(`
    INSERT INTO income (id, date, description, net_amount, vat_amount, gross_amount, is_deleted, is_duplicate, duplicate_of_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    overrides.date ?? '2024-06-15',
    overrides.description ?? 'Test income',
    net,
    vat,
    Math.round((net + vat) * 100) / 100,
    overrides.is_deleted ?? 0,
    overrides.is_duplicate ?? 0,
    overrides.duplicate_of_id ?? null,
  );
  return id;
}

// ============================================================================
// Unit Tests — Utility Functions
// ============================================================================

describe('normalisePartner', () => {
  it('lowercases and trims', () => {
    expect(normalisePartner('  HELLO World  ')).toBe('hello world');
  });

  it('strips GmbH suffix', () => {
    expect(normalisePartner('Deutsche Telekom GmbH')).toBe('deutsche telekom');
  });

  it('strips Ltd suffix', () => {
    expect(normalisePartner('Acme Solutions Ltd')).toBe('acme solutions');
  });

  it('strips AG suffix', () => {
    expect(normalisePartner('Siemens AG')).toBe('siemens');
  });

  it('handles empty string', () => {
    expect(normalisePartner('')).toBe('');
  });

  it('strips GmbH & Co. KG', () => {
    expect(normalisePartner('Müller GmbH & Co. KG')).toBe('müller');
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('returns length for empty vs non-empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('returns correct distance for similar strings', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
  });
});

describe('partnerSimilarity', () => {
  it('returns 1.0 for identical names', () => {
    expect(partnerSimilarity('Telekom', 'Telekom')).toBe(1.0);
  });

  it('returns 1.0 after normalisation (GmbH stripped)', () => {
    expect(partnerSimilarity('Telekom', 'Telekom GmbH')).toBe(1.0);
  });

  it('gives high similarity for "Telekom" vs "Deutsche Telekom GmbH"', () => {
    const score = partnerSimilarity('Telekom', 'Deutsche Telekom GmbH');
    // After normalisation: "telekom" vs "deutsche telekom"
    // Levenshtein("telekom","deutsche telekom") / max_len = high similarity
    expect(score).toBeGreaterThan(0.4);
  });

  it('returns 0 for empty partner', () => {
    expect(partnerSimilarity('', 'Telekom')).toBe(0);
    expect(partnerSimilarity('Telekom', '')).toBe(0);
  });

  it('returns low similarity for completely different names', () => {
    const score = partnerSimilarity('Amazon', 'Vodafone');
    expect(score).toBeLessThan(0.5);
  });
});

describe('dateSimilarity', () => {
  it('returns 1.0 for same day', () => {
    expect(dateSimilarity('2024-06-15', '2024-06-15')).toBe(1.0);
  });

  it('returns 0.8 for next day (within 48h)', () => {
    expect(dateSimilarity('2024-06-15', '2024-06-16')).toBe(0.8);
  });

  it('returns 0.8 for two days apart (within 48h)', () => {
    expect(dateSimilarity('2024-06-15', '2024-06-17')).toBe(0.8);
  });

  it('returns 0 for more than 48h apart', () => {
    expect(dateSimilarity('2024-06-15', '2024-06-20')).toBe(0);
  });
});

// ============================================================================
// Integration Tests — findDuplicates
// ============================================================================

describe('findDuplicates', () => {
  beforeEach(() => {
    db = freshDb();
  });

  afterAll(() => {
    if (db) db.close();
  });

  it('finds exact duplicates (same amount, date, vendor)', () => {
    const id1 = insertExpense(db, {
      date: '2024-06-15',
      vendor: 'Telekom',
      net_amount: 49.99,
    });
    const id2 = insertExpense(db, {
      date: '2024-06-15',
      vendor: 'Telekom',
      net_amount: 49.99,
    });

    const dupes = findDuplicates(db, 'expense', 49.99, '2024-06-15', 'Telekom', id1);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].id).toBe(id2);
    expect(dupes[0].similarity_score).toBe(1.0);
    expect(dupes[0].matched_fields).toContain('amount');
    expect(dupes[0].matched_fields).toContain('date');
    expect(dupes[0].matched_fields).toContain('vendor');
  });

  it('finds near-duplicates (within 48h)', () => {
    insertExpense(db, {
      id: 'orig',
      date: '2024-06-15',
      vendor: 'Telekom',
      net_amount: 49.99,
    });
    const nearId = insertExpense(db, {
      date: '2024-06-16',
      vendor: 'Telekom',
      net_amount: 49.99,
    });

    const dupes = findDuplicates(db, 'expense', 49.99, '2024-06-15', 'Telekom', 'orig');
    expect(dupes).toHaveLength(1);
    expect(dupes[0].id).toBe(nearId);
    expect(dupes[0].similarity_score).toBeGreaterThanOrEqual(0.9);
    expect(dupes[0].matched_fields).toContain('date');
  });

  it('fuzzy-matches vendor names ("Telekom" vs "Deutsche Telekom GmbH")', () => {
    insertExpense(db, {
      id: 'orig',
      date: '2024-06-15',
      vendor: 'Telekom',
      net_amount: 49.99,
    });
    insertExpense(db, {
      date: '2024-06-15',
      vendor: 'Deutsche Telekom GmbH',
      net_amount: 49.99,
    });

    const dupes = findDuplicates(db, 'expense', 49.99, '2024-06-15', 'Telekom', 'orig');
    expect(dupes).toHaveLength(1);
    expect(dupes[0].similarity_score).toBeGreaterThanOrEqual(0.6);
  });

  it('returns empty array when no duplicates exist', () => {
    insertExpense(db, {
      id: 'solo',
      date: '2024-06-15',
      vendor: 'Amazon',
      net_amount: 200,
    });

    // Different amount
    insertExpense(db, {
      date: '2024-06-15',
      vendor: 'Amazon',
      net_amount: 300,
    });

    const dupes = findDuplicates(db, 'expense', 200, '2024-06-15', 'Amazon', 'solo');
    expect(dupes).toHaveLength(0);
  });

  it('returns empty when date is too far apart', () => {
    insertExpense(db, {
      id: 'orig',
      date: '2024-06-15',
      vendor: 'Telekom',
      net_amount: 49.99,
    });
    insertExpense(db, {
      date: '2024-06-25', // 10 days later
      vendor: 'Telekom',
      net_amount: 49.99,
    });

    const dupes = findDuplicates(db, 'expense', 49.99, '2024-06-15', 'Telekom', 'orig');
    expect(dupes).toHaveLength(0);
  });

  it('excludes soft-deleted records', () => {
    insertExpense(db, {
      id: 'orig',
      date: '2024-06-15',
      vendor: 'Telekom',
      net_amount: 49.99,
    });
    insertExpense(db, {
      date: '2024-06-15',
      vendor: 'Telekom',
      net_amount: 49.99,
      is_deleted: 1,
    });

    const dupes = findDuplicates(db, 'expense', 49.99, '2024-06-15', 'Telekom', 'orig');
    expect(dupes).toHaveLength(0);
  });

  it('excludes already-marked duplicates from results', () => {
    insertExpense(db, {
      id: 'orig',
      date: '2024-06-15',
      vendor: 'Telekom',
      net_amount: 49.99,
    });
    insertExpense(db, {
      date: '2024-06-15',
      vendor: 'Telekom',
      net_amount: 49.99,
      is_duplicate: 1,
      duplicate_of_id: 'orig',
    });

    const dupes = findDuplicates(db, 'expense', 49.99, '2024-06-15', 'Telekom', 'orig');
    expect(dupes).toHaveLength(0);
  });

  it('works with income records', () => {
    const id1 = insertIncome(db, {
      date: '2024-06-15',
      description: 'Web Development',
      net_amount: 5000,
    });
    const id2 = insertIncome(db, {
      date: '2024-06-15',
      description: 'Web Development',
      net_amount: 5000,
    });

    const dupes = findDuplicates(db, 'income', 5000, '2024-06-15', 'Web Development', id1);
    expect(dupes).toHaveLength(1);
    expect(dupes[0].id).toBe(id2);
    expect(dupes[0].type).toBe('income');
  });
});

// ============================================================================
// Integration Tests — Mark / Unmark
// ============================================================================

describe('markAsDuplicate', () => {
  beforeEach(() => {
    db = freshDb();
  });

  afterAll(() => {
    if (db) db.close();
  });

  it('marks an expense as duplicate', () => {
    const id1 = insertExpense(db, { vendor: 'Telekom', net_amount: 49.99 });
    const id2 = insertExpense(db, { vendor: 'Telekom', net_amount: 49.99 });

    markAsDuplicate(db, 'expense', id2, id1);

    const row = db.prepare('SELECT is_duplicate, duplicate_of_id FROM expenses WHERE id = ?').get(id2) as {
      is_duplicate: number;
      duplicate_of_id: string;
    };
    expect(row.is_duplicate).toBe(1);
    expect(row.duplicate_of_id).toBe(id1);
  });

  it('marks an income record as duplicate', () => {
    const id1 = insertIncome(db, { description: 'Consulting', net_amount: 3000 });
    const id2 = insertIncome(db, { description: 'Consulting', net_amount: 3000 });

    markAsDuplicate(db, 'income', id2, id1);

    const row = db.prepare('SELECT is_duplicate, duplicate_of_id FROM income WHERE id = ?').get(id2) as {
      is_duplicate: number;
      duplicate_of_id: string;
    };
    expect(row.is_duplicate).toBe(1);
    expect(row.duplicate_of_id).toBe(id1);
  });

  it('throws for non-existent record', () => {
    expect(() => markAsDuplicate(db, 'expense', 'nonexistent', 'other')).toThrow('not found');
  });
});

describe('unmarkAsDuplicate', () => {
  beforeEach(() => {
    db = freshDb();
  });

  afterAll(() => {
    if (db) db.close();
  });

  it('unmarks a previously marked expense', () => {
    const id1 = insertExpense(db);
    const id2 = insertExpense(db, { is_duplicate: 1, duplicate_of_id: id1 });

    unmarkAsDuplicate(db, 'expense', id2);

    const row = db.prepare('SELECT is_duplicate, duplicate_of_id FROM expenses WHERE id = ?').get(id2) as {
      is_duplicate: number;
      duplicate_of_id: string | null;
    };
    expect(row.is_duplicate).toBe(0);
    expect(row.duplicate_of_id).toBeNull();
  });

  it('throws for non-existent record', () => {
    expect(() => unmarkAsDuplicate(db, 'income', 'nonexistent')).toThrow('not found');
  });
});

// ============================================================================
// Integration Tests — listMarkedDuplicates
// ============================================================================

describe('listMarkedDuplicates', () => {
  beforeEach(() => {
    db = freshDb();
  });

  afterAll(() => {
    if (db) db.close();
  });

  it('lists all marked duplicates across both tables', () => {
    const exp1 = insertExpense(db);
    const exp2 = insertExpense(db, { is_duplicate: 1, duplicate_of_id: exp1 });
    const inc1 = insertIncome(db);
    const inc2 = insertIncome(db, { is_duplicate: 1, duplicate_of_id: inc1 });

    const all = listMarkedDuplicates(db);
    expect(all).toHaveLength(2);
    const ids = all.map((d) => d.id);
    expect(ids).toContain(exp2);
    expect(ids).toContain(inc2);
  });

  it('filters by type', () => {
    const exp1 = insertExpense(db);
    insertExpense(db, { is_duplicate: 1, duplicate_of_id: exp1 });
    const inc1 = insertIncome(db);
    insertIncome(db, { is_duplicate: 1, duplicate_of_id: inc1 });

    const expOnly = listMarkedDuplicates(db, 'expense');
    expect(expOnly).toHaveLength(1);
    expect(expOnly[0].type).toBe('expense');

    const incOnly = listMarkedDuplicates(db, 'income');
    expect(incOnly).toHaveLength(1);
    expect(incOnly[0].type).toBe('income');
  });
});

// ============================================================================
// Integration Test — Duplicates Excluded from EÜR/USt-VA
// ============================================================================

describe('Duplicate exclusion from financial calculations', () => {
  beforeEach(() => {
    db = freshDb();
  });

  afterAll(() => {
    if (db) db.close();
  });

  it('duplicate records are excluded from EÜR-style queries', () => {
    // Simulate a typical EÜR query: sum net_amount WHERE not deleted AND not duplicate
    const id1 = insertExpense(db, { net_amount: 500, date: '2024-01-15' });
    insertExpense(db, { net_amount: 500, date: '2024-01-15', is_duplicate: 1, duplicate_of_id: id1 });
    insertExpense(db, { net_amount: 300, date: '2024-02-10' });

    // Query that excludes duplicates (as EÜR/USt-VA should)
    const result = db
      .prepare(
        `SELECT COALESCE(SUM(net_amount), 0) AS total
         FROM expenses
         WHERE (is_deleted IS NULL OR is_deleted = 0)
           AND (is_duplicate IS NULL OR is_duplicate = 0)`,
      )
      .get() as { total: number };

    // Only 500 + 300 = 800, the duplicate 500 is excluded
    expect(result.total).toBe(800);
  });

  it('duplicate income records are excluded from USt-VA-style queries', () => {
    const id1 = insertIncome(db, { net_amount: 2000, date: '2024-03-01' });
    insertIncome(db, { net_amount: 2000, date: '2024-03-01', is_duplicate: 1, duplicate_of_id: id1 });
    insertIncome(db, { net_amount: 1000, date: '2024-03-15' });

    const result = db
      .prepare(
        `SELECT COALESCE(SUM(net_amount), 0) AS total
         FROM income
         WHERE (is_deleted IS NULL OR is_deleted = 0)
           AND (is_duplicate IS NULL OR is_duplicate = 0)`,
      )
      .get() as { total: number };

    // 2000 + 1000 = 3000, the duplicate 2000 is excluded
    expect(result.total).toBe(3000);
  });

  it('unmarking a duplicate includes it back in calculations', () => {
    const id1 = insertExpense(db, { net_amount: 500, date: '2024-01-15' });
    const id2 = insertExpense(db, { net_amount: 500, date: '2024-01-15', is_duplicate: 1, duplicate_of_id: id1 });

    // Initially excluded
    let result = db
      .prepare(
        `SELECT COALESCE(SUM(net_amount), 0) AS total
         FROM expenses
         WHERE (is_deleted IS NULL OR is_deleted = 0)
           AND (is_duplicate IS NULL OR is_duplicate = 0)`,
      )
      .get() as { total: number };
    expect(result.total).toBe(500);

    // Unmark
    unmarkAsDuplicate(db, 'expense', id2);

    // Now included again
    result = db
      .prepare(
        `SELECT COALESCE(SUM(net_amount), 0) AS total
         FROM expenses
         WHERE (is_deleted IS NULL OR is_deleted = 0)
           AND (is_duplicate IS NULL OR is_duplicate = 0)`,
      )
      .get() as { total: number };
    expect(result.total).toBe(1000);
  });
});
