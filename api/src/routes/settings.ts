/**
 * Settings API routes
 *
 * Provides access to app settings stored in the SQLite database.
 * Used by the PDF service to fetch business profile for invoices.
 */

import { Router, type Request, type Response } from "express";
import { getDb } from "../database.js";

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface BusinessProfile {
  fullName: string;
  jobTitle: string;
  email: string;
  phone?: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  vatId?: string;
  taxId?: string;
  bankAccountHolder: string;
  bankName: string;
  bankIban: string;
  bankBic: string;
}

interface SettingRow {
  key: string;
  value: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get a setting value from the database
 */
function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as SettingRow | undefined;
  return row?.value ?? null;
}

/**
 * Parse a JSON setting value
 */
function getJsonSetting<T>(key: string): T | null {
  const value = getSetting(key);
  if (!value) return null;
  
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * Get all settings
 */
router.get("/", (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as SettingRow[];
  
  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  }
  
  res.json(settings);
});

/**
 * Get a specific setting
 */
router.get("/:key", (req: Request, res: Response) => {
  const { key } = req.params;
  const value = getSetting(key);
  
  if (value === null) {
    return res.status(404).json({ error: "Setting not found" });
  }
  
  try {
    res.json({ key, value: JSON.parse(value) });
  } catch {
    res.json({ key, value });
  }
});

/**
 * Get business profile (formatted for invoice generation)
 */
router.get("/invoice/seller", (_req: Request, res: Response) => {
  const profile = getJsonSetting<BusinessProfile>("businessProfile");
  
  if (!profile) {
    return res.status(404).json({ 
      error: "Business profile not configured",
      message: "Please configure your business profile in Settings"
    });
  }
  
  // Transform to seller format expected by PDF service
  const seller = {
    name: profile.fullName,
    title: profile.jobTitle,
    address: {
      street: profile.street,
      zip: profile.postalCode,
      city: profile.city,
      country: profile.country,
    },
    email: profile.email,
    phone: profile.phone,
    vatId: profile.vatId,
    taxId: profile.taxId,
    bank: {
      name: profile.bankName,
      iban: formatIban(profile.bankIban),
      bic: profile.bankBic,
    },
  };
  
  res.json(seller);
});

/**
 * Format IBAN with spaces for display
 */
function formatIban(iban: string): string {
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  return cleaned.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Set a specific setting
 */
router.put("/:key", (req: Request, res: Response) => {
  const { key } = req.params;
  const { value } = req.body;
  
  if (value === undefined) {
    return res.status(400).json({ error: "Value is required" });
  }
  
  const db = getDb();
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  
  // Upsert the setting
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, stringValue);
  
  res.json({ key, value });
});

/**
 * Set multiple settings at once
 */
router.put("/", (req: Request, res: Response) => {
  const settings = req.body;
  
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: "Settings object is required" });
  }
  
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  
  for (const [key, value] of Object.entries(settings)) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    stmt.run(key, stringValue);
  }
  
  res.json({ success: true });
});

export default router;
