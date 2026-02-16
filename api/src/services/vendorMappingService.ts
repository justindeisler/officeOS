/**
 * Vendor Mapping Service
 *
 * Normalizes vendor names from OCR results, suggests categories
 * based on historical data, and learns from user corrections.
 */

import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { createLogger } from "../logger.js";

const log = createLogger("vendor-mapping");

// ============================================================================
// Types
// ============================================================================

export interface VendorMapping {
  id: string;
  ocrName: string;
  displayName: string;
  defaultCategory: string | null;
  defaultVatRate: number | null;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VendorSuggestion {
  displayName: string;
  category: string | null;
  vatRate: number | null;
  confidence: number;
  source: "mapping" | "history";
}

interface VendorMappingRow {
  id: string;
  ocr_name: string;
  display_name: string;
  default_category: string | null;
  default_vat_rate: number | null;
  use_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Normalize a vendor name for matching (lowercase, trim, collapse spaces)
 */
export function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[,.\-_/\\]+/g, " ")
    .trim();
}

/**
 * Look up a vendor by OCR name (exact match first, then fuzzy)
 */
export function lookupVendor(ocrName: string): VendorSuggestion | null {
  const db = getDb();
  const normalized = normalizeVendorName(ocrName);

  // Exact match
  const exact = db
    .prepare("SELECT * FROM vendor_mappings WHERE LOWER(ocr_name) = ?")
    .get(normalized) as VendorMappingRow | undefined;

  if (exact) {
    // Increment use count
    db.prepare("UPDATE vendor_mappings SET use_count = use_count + 1, updated_at = ? WHERE id = ?")
      .run(getCurrentTimestamp(), exact.id);

    return {
      displayName: exact.display_name,
      category: exact.default_category,
      vatRate: exact.default_vat_rate,
      confidence: 0.99,
      source: "mapping",
    };
  }

  // Fuzzy match: check if ocrName contains or is contained in existing mappings
  const all = db
    .prepare("SELECT * FROM vendor_mappings ORDER BY use_count DESC")
    .all() as VendorMappingRow[];

  for (const mapping of all) {
    const mappingNormalized = normalizeVendorName(mapping.ocr_name);
    if (
      normalized.includes(mappingNormalized) ||
      mappingNormalized.includes(normalized)
    ) {
      db.prepare("UPDATE vendor_mappings SET use_count = use_count + 1, updated_at = ? WHERE id = ?")
        .run(getCurrentTimestamp(), mapping.id);

      return {
        displayName: mapping.display_name,
        category: mapping.default_category,
        vatRate: mapping.default_vat_rate,
        confidence: 0.75,
        source: "mapping",
      };
    }
  }

  // Check expense history for the vendor name
  const historyMatch = db
    .prepare(
      "SELECT vendor, category, vat_rate, COUNT(*) as cnt FROM expenses WHERE LOWER(vendor) LIKE ? GROUP BY vendor, category, vat_rate ORDER BY cnt DESC LIMIT 1"
    )
    .get(`%${normalized.substring(0, 10)}%`) as { vendor: string; category: string; vat_rate: number; cnt: number } | undefined;

  if (historyMatch && historyMatch.cnt >= 1) {
    return {
      displayName: historyMatch.vendor,
      category: historyMatch.category,
      vatRate: historyMatch.vat_rate,
      confidence: 0.5,
      source: "history",
    };
  }

  return null;
}

/**
 * Create or update a vendor mapping
 */
export function saveVendorMapping(
  ocrName: string,
  displayName: string,
  defaultCategory?: string,
  defaultVatRate?: number
): VendorMapping {
  const db = getDb();
  const now = getCurrentTimestamp();
  const normalized = normalizeVendorName(ocrName);

  // Check for existing
  const existing = db
    .prepare("SELECT * FROM vendor_mappings WHERE LOWER(ocr_name) = ?")
    .get(normalized) as VendorMappingRow | undefined;

  if (existing) {
    db.prepare(
      "UPDATE vendor_mappings SET display_name = ?, default_category = ?, default_vat_rate = ?, updated_at = ? WHERE id = ?"
    ).run(displayName, defaultCategory || null, defaultVatRate || null, now, existing.id);

    return {
      id: existing.id,
      ocrName: existing.ocr_name,
      displayName,
      defaultCategory: defaultCategory || null,
      defaultVatRate: defaultVatRate || null,
      useCount: existing.use_count,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }

  const id = generateId();
  db.prepare(
    "INSERT INTO vendor_mappings (id, ocr_name, display_name, default_category, default_vat_rate, use_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)"
  ).run(id, ocrName, displayName, defaultCategory || null, defaultVatRate || null, now, now);

  return {
    id,
    ocrName,
    displayName,
    defaultCategory: defaultCategory || null,
    defaultVatRate: defaultVatRate || null,
    useCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get all vendor mappings
 */
export function getAllVendorMappings(): VendorMapping[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM vendor_mappings ORDER BY use_count DESC, display_name ASC")
    .all() as VendorMappingRow[];

  return rows.map((r) => ({
    id: r.id,
    ocrName: r.ocr_name,
    displayName: r.display_name,
    defaultCategory: r.default_category,
    defaultVatRate: r.default_vat_rate,
    useCount: r.use_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Delete a vendor mapping
 */
export function deleteVendorMapping(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM vendor_mappings WHERE id = ?").run(id);
  return result.changes > 0;
}

/**
 * Check for duplicate uploads by checksum
 */
export function checkDuplicateUpload(checksum: string): { expenseId: string; date: string } | null {
  const db = getDb();
  const existing = db
    .prepare(
      "SELECT a.expense_id, e.date FROM attachments a JOIN expenses e ON e.id = a.expense_id WHERE a.checksum = ? AND a.expense_id IS NOT NULL LIMIT 1"
    )
    .get(checksum) as { expense_id: string; date: string } | undefined;

  if (existing) {
    return { expenseId: existing.expense_id, date: existing.date };
  }
  return null;
}
