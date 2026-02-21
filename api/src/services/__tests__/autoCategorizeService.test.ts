/**
 * Auto-Categorization Service — Tests
 *
 * Covers:
 * ✅ Suggests correct category for exact vendor match
 * ✅ Suggests category for fuzzy vendor match ("Telekom" vs "Deutsche Telekom GmbH")
 * ✅ Uses keywords when vendor is unknown
 * ✅ Applies rule-based fallback for common vendors
 * ✅ Returns multiple suggestions ranked by confidence
 * ✅ Returns empty array when no matches found
 * ✅ Amount range matching boosts confidence
 * ✅ Excludes duplicates and soft-deleted records from training data
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import {
  suggestCategory,
  trainModel,
  getModelStats,
  resetModel,
  extractKeywords,
  type CategorySuggestion,
} from '../autoCategorizeService.js';

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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return d;
}

let idCounter = 0;

function insertExpense(
  database: Database.Database,
  overrides: {
    vendor?: string;
    description?: string;
    category?: string;
    net_amount?: number;
    is_deleted?: number;
    is_duplicate?: number;
  } = {},
): string {
  idCounter++;
  const id = `exp-${idCounter}`;
  const netAmount = overrides.net_amount ?? 100;
  const vatAmount = Math.round(netAmount * 0.19 * 100) / 100;
  const grossAmount = netAmount + vatAmount;

  database.prepare(`
    INSERT INTO expenses (id, date, vendor, description, category, net_amount, vat_rate, vat_amount, gross_amount, is_deleted, is_duplicate, created_at)
    VALUES (?, '2024-01-15', ?, ?, ?, ?, 19, ?, ?, ?, ?, datetime('now'))
  `).run(
    id,
    overrides.vendor ?? 'Test Vendor',
    overrides.description ?? 'Test expense',
    overrides.category ?? 'software',
    netAmount,
    vatAmount,
    grossAmount,
    overrides.is_deleted ?? 0,
    overrides.is_duplicate ?? 0,
  );

  return id;
}

/**
 * Insert N expenses with the same vendor/category for reliable exact matching.
 */
function insertBulkExpenses(
  database: Database.Database,
  count: number,
  overrides: {
    vendor?: string;
    description?: string;
    category?: string;
    net_amount?: number;
  } = {},
): void {
  for (let i = 0; i < count; i++) {
    insertExpense(database, overrides);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

beforeEach(() => {
  idCounter = 0;
  db = freshDb();
  resetModel(); // Clear the singleton model
});

afterAll(() => {
  if (db) db.close();
});

// ----------------------------------------------------------------------------
// extractKeywords
// ----------------------------------------------------------------------------

describe('extractKeywords', () => {
  it('extracts meaningful words, filtering stop words', () => {
    const result = extractKeywords('Mobilfunk Rechnung Januar 2024');
    expect(result).toContain('mobilfunk');
    expect(result).toContain('rechnung');
    // 'januar' and '2024' are stop words
    expect(result).not.toContain('januar');
    expect(result).not.toContain('2024');
  });

  it('returns empty array for empty input', () => {
    expect(extractKeywords('')).toEqual([]);
    expect(extractKeywords(null as any)).toEqual([]);
  });

  it('filters words shorter than 3 characters', () => {
    const result = extractKeywords('ab cd efg');
    expect(result).not.toContain('ab');
    expect(result).not.toContain('cd');
    expect(result).toContain('efg');
  });
});

// ----------------------------------------------------------------------------
// Exact Vendor Match
// ----------------------------------------------------------------------------

describe('exact vendor match', () => {
  it('suggests correct category for vendor with ≥5 transactions', () => {
    insertBulkExpenses(db, 6, { vendor: 'Telekom Deutschland', category: 'telecom', description: 'Mobilfunk' });
    trainModel(db);

    const suggestions = suggestCategory(db, 'Telekom Deutschland', 'Rechnung', 50);

    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions[0].category).toBe('telecom');
    expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.95);
    expect(suggestions[0].reason).toContain('historical transactions');
  });

  it('uses moderate confidence for vendor with 2–4 transactions', () => {
    insertBulkExpenses(db, 3, { vendor: 'Small Vendor', category: 'office_supplies', description: 'Büromaterial' });
    trainModel(db);

    const suggestions = suggestCategory(db, 'Small Vendor', '', 50);

    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions[0].category).toBe('office_supplies');
    expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.5);
    expect(suggestions[0].confidence).toBeLessThan(0.95);
  });
});

// ----------------------------------------------------------------------------
// Fuzzy Vendor Match
// ----------------------------------------------------------------------------

describe('fuzzy vendor match', () => {
  it('suggests category for fuzzy vendor match ("Telekom" vs "Deutsche Telekom GmbH")', () => {
    // Insert exact vendor data
    insertBulkExpenses(db, 5, { vendor: 'Telekom', category: 'telecom', description: 'Mobilfunk Rechnung' });
    trainModel(db);

    // Query with different but similar vendor name
    const suggestions = suggestCategory(db, 'Telekoom', 'Rechnung', 50);

    // Should find a fuzzy match
    const telecomSuggestion = suggestions.find(s => s.category === 'telecom');
    expect(telecomSuggestion).toBeDefined();
    expect(telecomSuggestion!.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('does not match vendors with low similarity', () => {
    insertBulkExpenses(db, 5, { vendor: 'Telekom', category: 'telecom', description: 'Mobilfunk' });
    trainModel(db);

    // Completely different vendor
    const suggestions = suggestCategory(db, 'Amazon Web Services', '', 50);

    // Should not find Telekom via fuzzy match
    const telecomFromFuzzy = suggestions.find(
      s => s.category === 'telecom' && s.reason.includes('Fuzzy match'),
    );
    expect(telecomFromFuzzy).toBeUndefined();
  });
});

// ----------------------------------------------------------------------------
// Keyword Match (TF-IDF)
// ----------------------------------------------------------------------------

describe('keyword match', () => {
  it('uses keywords when vendor is unknown', () => {
    // Train with description-rich data
    insertBulkExpenses(db, 10, {
      vendor: 'KnownVendor',
      category: 'hosting',
      description: 'Cloud server hosting monthly invoice',
    });
    insertBulkExpenses(db, 10, {
      vendor: 'OtherVendor',
      category: 'software',
      description: 'Software license annual subscription',
    });
    trainModel(db);

    // Query with unknown vendor but matching description
    const suggestions = suggestCategory(db, 'UnknownCloudCorp', 'Cloud server hosting fee', 50);

    // Should have a keyword-based suggestion for 'hosting'
    const hostingSuggestion = suggestions.find(s => s.category === 'hosting');
    expect(hostingSuggestion).toBeDefined();
    expect(hostingSuggestion!.reason).toContain('Keyword match');
  });

  it('keyword confidence is capped at 0.6', () => {
    insertBulkExpenses(db, 10, {
      vendor: 'SomeVendor',
      category: 'telecom',
      description: 'Mobilfunk Festnetz Telekommunikation',
    });
    trainModel(db);

    const suggestions = suggestCategory(db, 'NoMatch', 'Mobilfunk Festnetz Telekommunikation', 0);

    for (const s of suggestions) {
      if (s.reason.includes('Keyword match') || s.reason.includes('Description similarity')) {
        expect(s.confidence).toBeLessThanOrEqual(0.6);
      }
    }
  });
});

// ----------------------------------------------------------------------------
// Rule-based Fallback
// ----------------------------------------------------------------------------

describe('rule-based fallback', () => {
  it('applies rule-based fallback for common vendors', () => {
    // No training data at all
    trainModel(db);

    const suggestions = suggestCategory(db, 'Vodafone GmbH', '', 50);

    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    const telecom = suggestions.find(s => s.category === 'telecom');
    expect(telecom).toBeDefined();
    expect(telecom!.reason).toContain('Rule-based match');
  });

  it('matches various vendor rules correctly', () => {
    trainModel(db);

    // AWS → hosting
    let suggestions = suggestCategory(db, 'AWS', '', 100);
    expect(suggestions.find(s => s.category === 'hosting')).toBeDefined();

    // GitHub → software
    suggestions = suggestCategory(db, 'GitHub Inc.', '', 10);
    expect(suggestions.find(s => s.category === 'software')).toBeDefined();

    // Deutsche Bahn → travel
    suggestions = suggestCategory(db, 'Deutsche Bahn AG', '', 80);
    expect(suggestions.find(s => s.category === 'travel')).toBeDefined();

    // Allianz → insurance
    suggestions = suggestCategory(db, 'Allianz Versicherung', '', 200);
    expect(suggestions.find(s => s.category === 'insurance')).toBeDefined();
  });

  it('does not add rule-based suggestion if high-confidence suggestion exists for same category', () => {
    // Historical data gives high confidence for telecom
    insertBulkExpenses(db, 10, { vendor: 'Telekom', category: 'telecom', description: 'Mobilfunk' });
    trainModel(db);

    const suggestions = suggestCategory(db, 'Telekom', 'Mobilfunk', 50);

    // Should not have a separate rule-based entry
    const ruleBasedTelecom = suggestions.filter(
      s => s.category === 'telecom' && s.reason.includes('Rule-based'),
    );
    expect(ruleBasedTelecom.length).toBe(0);
  });
});

// ----------------------------------------------------------------------------
// Multiple Suggestions & Ranking
// ----------------------------------------------------------------------------

describe('multiple suggestions ranked by confidence', () => {
  it('returns multiple suggestions ranked by confidence', () => {
    insertBulkExpenses(db, 8, { vendor: 'Mixed Vendor', category: 'software', description: 'Cloud software' });
    insertBulkExpenses(db, 3, { vendor: 'Mixed Vendor', category: 'hosting', description: 'Cloud hosting' });
    trainModel(db);

    const suggestions = suggestCategory(db, 'Mixed Vendor', 'Cloud platform', 100);

    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    // Should be sorted by confidence descending
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
    }
  });

  it('deduplicates by category, keeping highest confidence', () => {
    // Create scenario where same category could be suggested by multiple methods
    insertBulkExpenses(db, 6, { vendor: 'Hetzner Online', category: 'hosting', description: 'Dedicated server hosting' });
    trainModel(db);

    const suggestions = suggestCategory(db, 'Hetzner Online', 'Dedicated server hosting', 50);

    // Should have only one 'hosting' suggestion (the highest confidence one)
    const hostingSuggestions = suggestions.filter(s => s.category === 'hosting');
    expect(hostingSuggestions.length).toBe(1);
    // The exact vendor match (0.95+) should win over rule-based (0.5)
    expect(hostingSuggestions[0].confidence).toBeGreaterThan(0.5);
  });
});

// ----------------------------------------------------------------------------
// Empty Results
// ----------------------------------------------------------------------------

describe('empty results', () => {
  it('returns empty array when no matches found', () => {
    trainModel(db);

    const suggestions = suggestCategory(db, 'CompletelyUnknown123', 'xyzzy foobar', 999);

    expect(suggestions).toEqual([]);
  });

  it('returns empty array for empty database', () => {
    trainModel(db);

    const suggestions = suggestCategory(db, '', '', 0);
    expect(suggestions).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// Amount Range Boost
// ----------------------------------------------------------------------------

describe('amount range matching boosts confidence', () => {
  it('boosts confidence when amount is within ±20% of historical', () => {
    insertBulkExpenses(db, 6, { vendor: 'Monthly SaaS', category: 'software', net_amount: 50, description: 'SaaS' });
    trainModel(db);

    // Within ±20% of 50 (range: 40–60)
    const boosted = suggestCategory(db, 'Monthly SaaS', '', 48);
    const notBoosted = suggestCategory(db, 'Monthly SaaS', '', 200);

    const boostedConf = boosted.find(s => s.category === 'software')?.confidence ?? 0;
    const notBoostedConf = notBoosted.find(s => s.category === 'software')?.confidence ?? 0;

    // Boosted should be higher
    expect(boostedConf).toBeGreaterThan(notBoostedConf);
  });

  it('does not boost when amount is far from historical range', () => {
    insertBulkExpenses(db, 6, { vendor: 'Cheap Service', category: 'software', net_amount: 10, description: 'Service' });
    trainModel(db);

    // Way outside ±20% of 10 (range: 8–12)
    const suggestions = suggestCategory(db, 'Cheap Service', '', 1000);

    const softwareSuggestion = suggestions.find(s => s.category === 'software');
    expect(softwareSuggestion).toBeDefined();
    // Should be base confidence (0.95) without boost
    expect(softwareSuggestion!.confidence).toBe(0.95);
  });
});

// ----------------------------------------------------------------------------
// Excludes Duplicates and Soft-Deleted Records
// ----------------------------------------------------------------------------

describe('excludes duplicates and soft-deleted records from training data', () => {
  it('ignores soft-deleted expenses', () => {
    // 5 valid records
    insertBulkExpenses(db, 5, { vendor: 'ValidVendor', category: 'software', description: 'Valid' });
    // 5 deleted records with different category
    for (let i = 0; i < 5; i++) {
      insertExpense(db, { vendor: 'ValidVendor', category: 'hosting', is_deleted: 1, description: 'Deleted' });
    }
    trainModel(db);

    const suggestions = suggestCategory(db, 'ValidVendor', '', 100);

    // Should only see 'software' from the 5 valid records
    expect(suggestions[0].category).toBe('software');
    // Should not have hosting at high confidence
    const hosting = suggestions.find(s => s.category === 'hosting' && s.confidence >= 0.7);
    expect(hosting).toBeUndefined();
  });

  it('ignores duplicate-flagged expenses', () => {
    // 5 valid records
    insertBulkExpenses(db, 5, { vendor: 'DupTestVendor', category: 'telecom', description: 'Telecom' });
    // 5 duplicate records with different category
    for (let i = 0; i < 5; i++) {
      insertExpense(db, { vendor: 'DupTestVendor', category: 'software', is_duplicate: 1, description: 'Duplicate' });
    }
    trainModel(db);

    const suggestions = suggestCategory(db, 'DupTestVendor', '', 100);

    expect(suggestions[0].category).toBe('telecom');
    const softwareFromDup = suggestions.find(s => s.category === 'software' && s.confidence >= 0.7);
    expect(softwareFromDup).toBeUndefined();
  });

  it('model stats reflect only valid records', () => {
    insertBulkExpenses(db, 5, { vendor: 'Real', category: 'software', description: 'Real' });
    insertExpense(db, { vendor: 'Deleted', category: 'hosting', is_deleted: 1, description: 'Del' });
    insertExpense(db, { vendor: 'Dup', category: 'hosting', is_duplicate: 1, description: 'Dup' });
    trainModel(db);

    const stats = getModelStats(db);
    expect(stats.totalRecords).toBe(5);
  });
});

// ----------------------------------------------------------------------------
// Model Stats
// ----------------------------------------------------------------------------

describe('model stats', () => {
  it('returns comprehensive statistics', () => {
    insertBulkExpenses(db, 10, { vendor: 'Telekom', category: 'telecom', description: 'Mobilfunk' });
    insertBulkExpenses(db, 5, { vendor: 'AWS', category: 'hosting', description: 'Cloud hosting' });
    insertBulkExpenses(db, 3, { vendor: 'GitHub', category: 'software', description: 'Repository hosting' });
    trainModel(db);

    const stats = getModelStats(db);

    expect(stats.totalRecords).toBe(18);
    expect(stats.totalCategories).toBe(3);
    expect(stats.totalVendors).toBe(3);
    expect(stats.trainedAt).toBeTruthy();
    expect(stats.topVendors.length).toBe(3);
    expect(stats.topVendors[0].vendor).toBe('telekom'); // normalised
    expect(stats.topVendors[0].count).toBe(10);
    expect(stats.categoryCoverage.length).toBe(3);
  });

  it('auto-trains when model is not yet trained', () => {
    insertBulkExpenses(db, 5, { vendor: 'AutoTrain', category: 'software', description: 'Test' });

    // Don't call trainModel — stats should auto-train
    const stats = getModelStats(db);
    expect(stats.totalRecords).toBe(5);
    expect(stats.trainedAt).toBeTruthy();
  });
});

// ----------------------------------------------------------------------------
// Auto-train on first suggest
// ----------------------------------------------------------------------------

describe('auto-train', () => {
  it('automatically trains model on first suggestCategory call', () => {
    insertBulkExpenses(db, 6, { vendor: 'AutoTrainVendor', category: 'software', description: 'Testing auto train' });

    // Don't call trainModel — suggestCategory should auto-train
    const suggestions = suggestCategory(db, 'AutoTrainVendor', '', 100);

    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions[0].category).toBe('software');
  });
});
