/**
 * Assets API routes
 *
 * Handles asset CRUD operations and depreciation schedules for accounting/EÜR.
 */

import { Router, type Request, type Response } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface AssetRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  purchase_date: string;
  purchase_price: number;
  useful_life_years: number;
  depreciation_method: string;
  salvage_value: number;
  current_value: number | null;
  status: string;
  created_at: string;
}

interface DepreciationRow {
  id: string;
  asset_id: string;
  year: number;
  depreciation_amount: number;
  accumulated_depreciation: number;
  book_value: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate depreciation schedule for an asset
 */
function generateDepreciationSchedule(
  db: ReturnType<typeof getDb>,
  assetId: string,
  purchaseDate: string,
  purchasePrice: number,
  usefulLifeYears: number,
  salvageValue: number,
  method: string
): DepreciationRow[] {
  const schedule: DepreciationRow[] = [];
  const startYear = new Date(purchaseDate).getFullYear();
  const depreciableAmount = purchasePrice - salvageValue;

  let accumulated = 0;

  for (let i = 0; i < usefulLifeYears; i++) {
    const year = startYear + i;
    let depreciationAmount: number;

    if (method === "linear") {
      depreciationAmount = Math.round((depreciableAmount / usefulLifeYears) * 100) / 100;
    } else if (method === "declining") {
      // Double declining balance
      const rate = 2 / usefulLifeYears;
      const bookValueStart = purchasePrice - accumulated;
      depreciationAmount = Math.round(bookValueStart * rate * 100) / 100;
      // Don't depreciate below salvage value
      if (purchasePrice - accumulated - depreciationAmount < salvageValue) {
        depreciationAmount = purchasePrice - accumulated - salvageValue;
      }
    } else {
      // Default to linear
      depreciationAmount = Math.round((depreciableAmount / usefulLifeYears) * 100) / 100;
    }

    // Last year adjustment for rounding
    if (i === usefulLifeYears - 1) {
      depreciationAmount = depreciableAmount - accumulated;
    }

    accumulated += depreciationAmount;
    const bookValue = Math.round((purchasePrice - accumulated) * 100) / 100;

    const id = generateId();
    schedule.push({
      id,
      asset_id: assetId,
      year,
      depreciation_amount: depreciationAmount,
      accumulated_depreciation: Math.round(accumulated * 100) / 100,
      book_value: bookValue,
    });
  }

  // Insert into database
  const insertStmt = db.prepare(
    `INSERT INTO depreciation_schedule 
     (id, asset_id, year, depreciation_amount, accumulated_depreciation, book_value)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const row of schedule) {
    insertStmt.run(
      row.id,
      row.asset_id,
      row.year,
      row.depreciation_amount,
      row.accumulated_depreciation,
      row.book_value
    );
  }

  return schedule;
}

/**
 * Get current book value based on depreciation schedule
 */
function getCurrentBookValue(db: ReturnType<typeof getDb>, assetId: string): number | null {
  const currentYear = new Date().getFullYear();
  
  // Get the most recent depreciation entry up to current year
  const entry = db.prepare(
    `SELECT book_value FROM depreciation_schedule 
     WHERE asset_id = ? AND year <= ? 
     ORDER BY year DESC LIMIT 1`
  ).get(assetId, currentYear) as { book_value: number } | undefined;

  return entry?.book_value ?? null;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * List all assets
 */
router.get("/", (req: Request, res: Response) => {
  const db = getDb();
  const { status, category } = req.query;

  let sql = "SELECT * FROM assets WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }

  sql += " ORDER BY purchase_date DESC";

  const assets = db.prepare(sql).all(...params) as AssetRow[];

  // Update current values
  const result = assets.map(asset => ({
    ...asset,
    current_value: getCurrentBookValue(db, asset.id) ?? asset.purchase_price,
  }));

  res.json(result);
});

/**
 * Get single asset by ID with depreciation schedule
 */
router.get("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!asset) {
    return res.status(404).json({ error: "Asset not found" });
  }

  const schedule = db.prepare(
    "SELECT * FROM depreciation_schedule WHERE asset_id = ? ORDER BY year"
  ).all(id) as DepreciationRow[];

  res.json({
    ...asset,
    current_value: getCurrentBookValue(db, id) ?? asset.purchase_price,
    depreciation_schedule: schedule,
  });
});

/**
 * Get depreciation schedule for an asset
 */
router.get("/:id/schedule", (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!asset) {
    return res.status(404).json({ error: "Asset not found" });
  }

  const schedule = db.prepare(
    "SELECT * FROM depreciation_schedule WHERE asset_id = ? ORDER BY year"
  ).all(id) as DepreciationRow[];

  res.json(schedule);
});

/**
 * Create a new asset
 */
router.post("/", (req: Request, res: Response) => {
  const db = getDb();
  const {
    name,
    description,
    category,
    purchase_date,
    purchase_price,
    useful_life_years,
    depreciation_method = "linear",
    salvage_value = 0,
  } = req.body;

  if (!name || !category || !purchase_date || purchase_price === undefined || !useful_life_years) {
    return res.status(400).json({ 
      error: "name, category, purchase_date, purchase_price, and useful_life_years are required" 
    });
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO assets (
      id, name, description, category, purchase_date, purchase_price,
      useful_life_years, depreciation_method, salvage_value, current_value,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
  ).run(
    id,
    name,
    description || null,
    category,
    purchase_date,
    purchase_price,
    useful_life_years,
    depreciation_method,
    salvage_value,
    purchase_price, // Initial current value = purchase price
    now
  );

  // Generate depreciation schedule
  const schedule = generateDepreciationSchedule(
    db,
    id,
    purchase_date,
    purchase_price,
    useful_life_years,
    salvage_value,
    depreciation_method
  );

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as AssetRow;
  res.status(201).json({
    ...asset,
    depreciation_schedule: schedule,
  });
});

/**
 * Update an asset
 */
router.patch("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!existing) {
    return res.status(404).json({ error: "Asset not found" });
  }

  const fields = [
    "name",
    "description",
    "category",
    "status",
  ];
  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  // If key financial fields change, regenerate depreciation schedule
  const needsRecalc = 
    req.body.purchase_date !== undefined ||
    req.body.purchase_price !== undefined ||
    req.body.useful_life_years !== undefined ||
    req.body.depreciation_method !== undefined ||
    req.body.salvage_value !== undefined;

  if (needsRecalc) {
    const purchaseDate = req.body.purchase_date ?? existing.purchase_date;
    const purchasePrice = req.body.purchase_price ?? existing.purchase_price;
    const usefulLifeYears = req.body.useful_life_years ?? existing.useful_life_years;
    const depreciationMethod = req.body.depreciation_method ?? existing.depreciation_method;
    const salvageValue = req.body.salvage_value ?? existing.salvage_value;

    updates.push(
      "purchase_date = ?",
      "purchase_price = ?",
      "useful_life_years = ?",
      "depreciation_method = ?",
      "salvage_value = ?",
      "current_value = ?"
    );
    params.push(purchaseDate, purchasePrice, usefulLifeYears, depreciationMethod, salvageValue, purchasePrice);

    // Delete old schedule
    db.prepare("DELETE FROM depreciation_schedule WHERE asset_id = ?").run(id);

    // Generate new schedule after update
    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE assets SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    }

    generateDepreciationSchedule(
      db,
      id,
      purchaseDate,
      purchasePrice,
      usefulLifeYears,
      salvageValue,
      depreciationMethod
    );
  } else if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE assets SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as AssetRow;
  const schedule = db.prepare(
    "SELECT * FROM depreciation_schedule WHERE asset_id = ? ORDER BY year"
  ).all(id) as DepreciationRow[];

  res.json({
    ...asset,
    current_value: getCurrentBookValue(db, id) ?? asset.purchase_price,
    depreciation_schedule: schedule,
  });
});

/**
 * Delete an asset (cascades depreciation schedule)
 */
router.delete("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!existing) {
    return res.status(404).json({ error: "Asset not found" });
  }

  // Delete depreciation schedule first
  db.prepare("DELETE FROM depreciation_schedule WHERE asset_id = ?").run(id);

  // Delete asset
  db.prepare("DELETE FROM assets WHERE id = ?").run(id);

  res.json({ success: true, message: `Asset "${existing.name}" deleted` });
});

/**
 * Record annual depreciation (mark as booked/realized)
 */
router.post("/:id/depreciate", (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { year } = req.body;

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!asset) {
    return res.status(404).json({ error: "Asset not found" });
  }

  const targetYear = year || new Date().getFullYear();

  const entry = db.prepare(
    "SELECT * FROM depreciation_schedule WHERE asset_id = ? AND year = ?"
  ).get(id, targetYear) as DepreciationRow | undefined;

  if (!entry) {
    return res.status(404).json({ error: `No depreciation entry for year ${targetYear}` });
  }

  // Update current value on asset
  db.prepare("UPDATE assets SET current_value = ? WHERE id = ?").run(
    entry.book_value,
    id
  );

  res.json({
    success: true,
    year: targetYear,
    depreciation_amount: entry.depreciation_amount,
    new_book_value: entry.book_value,
  });
});

export default router;
