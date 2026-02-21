/**
 * Auto-Categorization Service
 *
 * ML-based expense categorization that learns from historical data to
 * suggest categories for new expenses. Uses:
 *
 * 1. Exact vendor matching (highest confidence)
 * 2. Fuzzy vendor matching via Levenshtein similarity
 * 3. TF-IDF keyword matching on descriptions
 * 4. Amount range boosting
 * 5. Rule-based fallback for common vendors
 *
 * No external ML libraries — pure string matching + TF-IDF.
 */

import type Database from 'better-sqlite3';
import { createLogger } from '../logger.js';
import { matchVendorRule } from '../constants/vendor-rules.js';
import { normalisePartner, levenshtein } from './duplicateDetectionService.js';

const log = createLogger('auto-categorize');

// ============================================================================
// Types
// ============================================================================

export interface CategorySuggestion {
  category: string;
  confidence: number; // 0–1
  reason: string;
}

interface TrainingRecord {
  vendor: string;
  description: string;
  category: string;
  amount: number;
}

/** In-memory TF-IDF model built from historical data */
interface TfIdfModel {
  /** Per-category: keyword → TF-IDF weight */
  categoryVectors: Map<string, Map<string, number>>;
  /** Document frequency: keyword → number of categories it appears in */
  df: Map<string, number>;
  /** Total number of categories (used for IDF calculation) */
  totalCategories: number;
  /** Per-vendor: normalised vendor → { category → count } */
  vendorCategoryCounts: Map<string, Map<string, number>>;
  /** Per-vendor per category: normalised vendor → { category → amounts[] } */
  vendorCategoryAmounts: Map<string, Map<string, number[]>>;
  /** Total training records */
  totalRecords: number;
  /** Timestamp of last training */
  trainedAt: Date | null;
}

// Singleton model — rebuilt via trainModel()
let model: TfIdfModel = createEmptyModel();

// ============================================================================
// Stop Words (German + English common words to exclude from TF-IDF)
// ============================================================================

const STOP_WORDS = new Set([
  // German
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines',
  'und', 'oder', 'aber', 'für', 'von', 'zu', 'mit', 'auf', 'an', 'in', 'aus',
  'bei', 'nach', 'über', 'unter', 'vor', 'zwischen', 'durch', 'gegen', 'ohne',
  'um', 'bis', 'seit', 'ab', 'ist', 'sind', 'war', 'hat', 'haben', 'wird',
  'werden', 'nicht', 'auch', 'noch', 'schon', 'nur', 'sehr', 'mehr',
  'nr', 'nummer', 'vom', 'zum', 'zur', 'im', 'am',
  // English
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'of', 'to', 'with', 'on',
  'at', 'in', 'from', 'by', 'is', 'are', 'was', 'has', 'have', 'not',
  // Date/number fragments
  'januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august',
  'september', 'oktober', 'november', 'dezember',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez',
  '2023', '2024', '2025', '2026',
]);

// ============================================================================
// Helper Functions
// ============================================================================

function createEmptyModel(): TfIdfModel {
  return {
    categoryVectors: new Map(),
    df: new Map(),
    totalCategories: 0,
    vendorCategoryCounts: new Map(),
    vendorCategoryAmounts: new Map(),
    totalRecords: 0,
    trainedAt: null,
  };
}

/**
 * Extract meaningful keywords from a text string.
 * Lowercases, removes punctuation, filters stop words, filters short tokens.
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Compute cosine similarity between two keyword frequency maps.
 */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, val] of a) {
    normA += val * val;
    const bVal = b.get(key);
    if (bVal !== undefined) {
      dotProduct += val * bVal;
    }
  }

  for (const [, val] of b) {
    normB += val * val;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Compute Levenshtein similarity (0–1) between two normalised strings.
 */
function vendorSimilarity(a: string, b: string): number {
  const na = normalisePartner(a);
  const nb = normalisePartner(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshtein(na, nb);
  return Math.max(0, 1 - dist / maxLen);
}

// ============================================================================
// Training
// ============================================================================

/**
 * Rebuild the TF-IDF model from historical expense data.
 *
 * Reads all non-deleted, non-duplicate expenses with confirmed categories
 * and builds:
 * - Vendor → category frequency maps
 * - TF-IDF vectors per category from descriptions
 * - Amount ranges per vendor-category pair
 */
export function trainModel(db: Database.Database): void {
  const startTime = Date.now();

  const records = db.prepare(`
    SELECT vendor, description, category, net_amount as amount
    FROM expenses
    WHERE (is_deleted IS NULL OR is_deleted = 0)
      AND (is_duplicate IS NULL OR is_duplicate = 0)
      AND category IS NOT NULL
      AND category != ''
  `).all() as TrainingRecord[];

  const newModel = createEmptyModel();
  newModel.totalRecords = records.length;

  if (records.length === 0) {
    newModel.trainedAt = new Date();
    model = newModel;
    log.info('Model trained with 0 records');
    return;
  }

  // 1. Build vendor → category counts and amounts
  for (const record of records) {
    if (record.vendor) {
      const normVendor = normalisePartner(record.vendor);
      if (normVendor) {
        // Category counts
        if (!newModel.vendorCategoryCounts.has(normVendor)) {
          newModel.vendorCategoryCounts.set(normVendor, new Map());
        }
        const catMap = newModel.vendorCategoryCounts.get(normVendor)!;
        catMap.set(record.category, (catMap.get(record.category) || 0) + 1);

        // Amounts
        if (!newModel.vendorCategoryAmounts.has(normVendor)) {
          newModel.vendorCategoryAmounts.set(normVendor, new Map());
        }
        const amtMap = newModel.vendorCategoryAmounts.get(normVendor)!;
        if (!amtMap.has(record.category)) {
          amtMap.set(record.category, []);
        }
        amtMap.get(record.category)!.push(record.amount);
      }
    }
  }

  // 2. Build TF-IDF vectors per category from descriptions
  // First, collect term frequencies per category
  const categoryTermFreqs: Map<string, Map<string, number>> = new Map();
  const categoryDocCounts: Map<string, number> = new Map();

  for (const record of records) {
    const keywords = extractKeywords(record.description);
    if (keywords.length === 0) continue;

    if (!categoryTermFreqs.has(record.category)) {
      categoryTermFreqs.set(record.category, new Map());
    }
    categoryDocCounts.set(record.category, (categoryDocCounts.get(record.category) || 0) + 1);

    const tf = categoryTermFreqs.get(record.category)!;
    // Use unique keywords per document to compute TF correctly
    const uniqueKeywords = [...new Set(keywords)];
    for (const kw of uniqueKeywords) {
      tf.set(kw, (tf.get(kw) || 0) + 1);
    }
  }

  // Compute document frequency (how many categories use each keyword)
  const allKeywords = new Set<string>();
  for (const [, tf] of categoryTermFreqs) {
    for (const kw of tf.keys()) {
      allKeywords.add(kw);
    }
  }

  for (const kw of allKeywords) {
    let count = 0;
    for (const [, tf] of categoryTermFreqs) {
      if (tf.has(kw)) count++;
    }
    newModel.df.set(kw, count);
  }

  newModel.totalCategories = categoryTermFreqs.size;

  // Compute TF-IDF weights per category
  for (const [category, tf] of categoryTermFreqs) {
    const docCount = categoryDocCounts.get(category) || 1;
    const tfidf = new Map<string, number>();

    for (const [term, freq] of tf) {
      // TF: normalized by documents in this category
      const termFreq = freq / docCount;
      // IDF: log(total categories / categories containing this term)
      const docFreq = newModel.df.get(term) || 1;
      const idf = Math.log(1 + newModel.totalCategories / docFreq);
      tfidf.set(term, termFreq * idf);
    }

    newModel.categoryVectors.set(category, tfidf);
  }

  newModel.trainedAt = new Date();
  model = newModel;

  const elapsed = Date.now() - startTime;
  log.info({
    records: records.length,
    categories: newModel.totalCategories,
    vendors: newModel.vendorCategoryCounts.size,
    elapsed_ms: elapsed,
  }, 'Model trained successfully');
}

// ============================================================================
// Suggestion
// ============================================================================

/**
 * Suggest categories for an expense based on vendor, description, and amount.
 *
 * Returns suggestions sorted by confidence (highest first).
 * Deduplicates by category, keeping the highest confidence for each.
 */
export function suggestCategory(
  db: Database.Database,
  vendor: string,
  description: string,
  amount: number,
): CategorySuggestion[] {
  // Auto-train if model hasn't been trained yet
  if (!model.trainedAt) {
    trainModel(db);
  }

  const suggestions: CategorySuggestion[] = [];
  const normVendor = vendor ? normalisePartner(vendor) : '';

  // --------------------------------------------------------------------------
  // 1. Exact vendor match
  // --------------------------------------------------------------------------
  if (normVendor && model.vendorCategoryCounts.has(normVendor)) {
    const catMap = model.vendorCategoryCounts.get(normVendor)!;
    const totalForVendor = [...catMap.values()].reduce((a, b) => a + b, 0);

    for (const [category, count] of catMap) {
      if (count >= 5) {
        let confidence = 0.95;

        // Amount range boost
        confidence = applyAmountBoost(confidence, normVendor, category, amount);

        suggestions.push({
          category,
          confidence: Math.min(confidence, 1.0),
          reason: `Matched ${totalForVendor} historical transactions to '${vendor}'`,
        });
      } else if (count >= 2) {
        // Moderate confidence for fewer matches
        let confidence = 0.7;
        confidence = applyAmountBoost(confidence, normVendor, category, amount);

        suggestions.push({
          category,
          confidence: Math.min(confidence, 1.0),
          reason: `Matched ${count} historical transactions to '${vendor}'`,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. Fuzzy vendor match (Levenshtein similarity ≥ 0.8)
  // --------------------------------------------------------------------------
  if (normVendor) {
    for (const [knownVendor, catMap] of model.vendorCategoryCounts) {
      // Skip exact matches (already handled above)
      if (knownVendor === normVendor) continue;

      const sim = vendorSimilarity(vendor, knownVendor);
      if (sim >= 0.8) {
        const totalForVendor = [...catMap.values()].reduce((a, b) => a + b, 0);
        // Only consider categories with at least 2 occurrences for fuzzy match
        for (const [category, count] of catMap) {
          if (count >= 2) {
            let confidence = 0.75;
            confidence = applyAmountBoost(confidence, knownVendor, category, amount);

            suggestions.push({
              category,
              confidence: Math.min(confidence, 1.0),
              reason: `Fuzzy match (${Math.round(sim * 100)}% similar) to '${knownVendor}' with ${totalForVendor} transactions`,
            });
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. TF-IDF keyword match from description
  // --------------------------------------------------------------------------
  if (description && model.categoryVectors.size > 0) {
    const keywords = extractKeywords(description);
    if (keywords.length > 0) {
      // Build query vector (simple TF, no IDF needed for query)
      const queryVector = new Map<string, number>();
      for (const kw of keywords) {
        queryVector.set(kw, (queryVector.get(kw) || 0) + 1);
      }
      // Normalize query TF
      for (const [term, freq] of queryVector) {
        const idf = Math.log(1 + model.totalCategories / (model.df.get(term) || 1));
        queryVector.set(term, (freq / keywords.length) * idf);
      }

      // Compute similarity against each category
      for (const [category, catVector] of model.categoryVectors) {
        const sim = cosineSimilarity(queryVector, catVector);
        if (sim > 0.05) {
          // Find matching keywords for the reason
          const matchedKeywords = keywords.filter(kw => catVector.has(kw));
          const topKeywords = matchedKeywords.slice(0, 3).join(', ');

          suggestions.push({
            category,
            confidence: Math.min(sim * 0.6, 0.6), // Cap at 0.6 for keyword-only match
            reason: topKeywords
              ? `Keyword match: '${topKeywords}'`
              : `Description similarity`,
          });
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. Rule-based fallback
  // --------------------------------------------------------------------------
  const rule = matchVendorRule(vendor || '');
  if (rule) {
    // Only add if we don't already have a high-confidence suggestion for this category
    const existingForCategory = suggestions.find(s => s.category === rule.category && s.confidence >= 0.5);
    if (!existingForCategory) {
      suggestions.push({
        category: rule.category,
        confidence: 0.5,
        reason: `Rule-based match: ${rule.label}`,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 5. Deduplicate & sort
  // --------------------------------------------------------------------------
  return deduplicateAndSort(suggestions);
}

/**
 * Apply amount range boost: if historical amounts for this vendor-category
 * are within ±20% of the given amount, boost confidence by 0.1.
 */
function applyAmountBoost(
  confidence: number,
  normVendor: string,
  category: string,
  amount: number,
): number {
  if (!amount || amount <= 0) return confidence;

  const amtMap = model.vendorCategoryAmounts.get(normVendor);
  if (!amtMap) return confidence;

  const amounts = amtMap.get(category);
  if (!amounts || amounts.length === 0) return confidence;

  // Check if any historical amount is within ±20%
  const lower = amount * 0.8;
  const upper = amount * 1.2;
  const matchingAmounts = amounts.filter(a => a >= lower && a <= upper);

  if (matchingAmounts.length > 0) {
    return confidence + 0.1;
  }

  return confidence;
}

/**
 * Deduplicate suggestions by category (keep highest confidence),
 * then sort by confidence descending.
 */
function deduplicateAndSort(suggestions: CategorySuggestion[]): CategorySuggestion[] {
  const byCategory = new Map<string, CategorySuggestion>();

  for (const s of suggestions) {
    const existing = byCategory.get(s.category);
    if (!existing || s.confidence > existing.confidence) {
      byCategory.set(s.category, s);
    }
  }

  return [...byCategory.values()]
    .sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// Stats
// ============================================================================

export interface ModelStats {
  totalRecords: number;
  totalCategories: number;
  totalVendors: number;
  trainedAt: string | null;
  topVendors: Array<{ vendor: string; count: number; topCategory: string }>;
  categoryCoverage: Array<{ category: string; records: number }>;
}

/**
 * Get statistics about the current model.
 */
export function getModelStats(db: Database.Database): ModelStats {
  // Auto-train if needed
  if (!model.trainedAt) {
    trainModel(db);
  }

  // Top vendors (by total transactions)
  const topVendors: Array<{ vendor: string; count: number; topCategory: string }> = [];
  for (const [vendor, catMap] of model.vendorCategoryCounts) {
    const total = [...catMap.values()].reduce((a, b) => a + b, 0);
    // Find top category for this vendor
    let topCat = '';
    let topCount = 0;
    for (const [cat, count] of catMap) {
      if (count > topCount) {
        topCount = count;
        topCat = cat;
      }
    }
    topVendors.push({ vendor, count: total, topCategory: topCat });
  }
  topVendors.sort((a, b) => b.count - a.count);

  // Category coverage
  const categoryCoverage: Array<{ category: string; records: number }> = [];
  const categoryTotals = new Map<string, number>();
  for (const [, catMap] of model.vendorCategoryCounts) {
    for (const [cat, count] of catMap) {
      categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + count);
    }
  }
  for (const [category, records] of categoryTotals) {
    categoryCoverage.push({ category, records });
  }
  categoryCoverage.sort((a, b) => b.records - a.records);

  return {
    totalRecords: model.totalRecords,
    totalCategories: model.totalCategories,
    totalVendors: model.vendorCategoryCounts.size,
    trainedAt: model.trainedAt?.toISOString() ?? null,
    topVendors: topVendors.slice(0, 10),
    categoryCoverage,
  };
}

/**
 * Reset the model (useful for testing).
 */
export function resetModel(): void {
  model = createEmptyModel();
}
