/**
 * Assets API routes
 *
 * Handles asset CRUD operations and depreciation schedules for accounting/EÜR.
 */

import { Router, type Request, type Response } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";

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
      const rate = 2 / usefulLifeYears;
      const bookValueStart = purchasePrice - accumulated;
      depreciationAmount = Math.round(bookValueStart * rate * 100) / 100;
      if (purchasePrice - accumulated - depreciationAmount < salvageValue) {
        depreciationAmount = purchasePrice - accumulated - salvageValue;
      }
    } else {
      depreciationAmount = Math.round((depreciableAmount / usefulLifeYears) * 100) / 100;
    }

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

function getCurrentBookValue(db: ReturnType<typeof getDb>, assetId: string): number | null {
  const currentYear = new Date().getFullYear();
  
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

router.get("/", asyncHandler(async (req: Request, res: Response) => {
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

  const result = assets.map(asset => ({
    ...asset,
    current_value: getCurrentBookValue(db, asset.id) ?? asset.purchase_price,
  }));

  res.json(result);
}));

router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!asset) {
    throw new NotFoundError("Asset", id);
  }

  const schedule = db.prepare(
    "SELECT * FROM depreciation_schedule WHERE asset_id = ? ORDER BY year"
  ).all(id) as DepreciationRow[];

  res.json({
    ...asset,
    current_value: getCurrentBookValue(db, id) ?? asset.purchase_price,
    depreciation_schedule: schedule,
  });
}));

router.get("/:id/schedule", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!asset) {
    throw new NotFoundError("Asset", id);
  }

  const schedule = db.prepare(
    "SELECT * FROM depreciation_schedule WHERE asset_id = ? ORDER BY year"
  ).all(id) as DepreciationRow[];

  res.json(schedule);
}));

router.post("/", asyncHandler(async (req: Request, res: Response) => {
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
    throw new ValidationError("name, category, purchase_date, purchase_price, and useful_life_years are required");
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
    purchase_price,
    now
  );

  const schedule = generateDepreciationSchedule(
    db, id, purchase_date, purchase_price, useful_life_years, salvage_value, depreciation_method
  );

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as AssetRow;
  res.status(201).json({
    ...asset,
    depreciation_schedule: schedule,
  });
}));

router.patch("/:id", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!existing) {
    throw new NotFoundError("Asset", id);
  }

  const fields = ["name", "description", "category", "status"];
  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

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
      "purchase_date = ?", "purchase_price = ?", "useful_life_years = ?",
      "depreciation_method = ?", "salvage_value = ?", "current_value = ?"
    );
    params.push(purchaseDate, purchasePrice, usefulLifeYears, depreciationMethod, salvageValue, purchasePrice);

    db.prepare("DELETE FROM depreciation_schedule WHERE asset_id = ?").run(id);

    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE assets SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    }

    generateDepreciationSchedule(db, id, purchaseDate, purchasePrice, usefulLifeYears, salvageValue, depreciationMethod);
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
}));

router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!existing) {
    throw new NotFoundError("Asset", id);
  }

  db.prepare("DELETE FROM depreciation_schedule WHERE asset_id = ?").run(id);
  db.prepare("DELETE FROM assets WHERE id = ?").run(id);

  res.json({ success: true, message: `Asset "${existing.name}" deleted` });
}));

router.post("/:id/depreciate", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { year } = req.body;

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!asset) {
    throw new NotFoundError("Asset", id);
  }

  const targetYear = year || new Date().getFullYear();

  const entry = db.prepare(
    "SELECT * FROM depreciation_schedule WHERE asset_id = ? AND year = ?"
  ).get(id, targetYear) as DepreciationRow | undefined;

  if (!entry) {
    throw new NotFoundError(`Depreciation entry for year ${targetYear}`);
  }

  db.prepare("UPDATE assets SET current_value = ? WHERE id = ?").run(entry.book_value, id);

  res.json({
    success: true,
    year: targetYear,
    depreciation_amount: entry.depreciation_amount,
    new_book_value: entry.book_value,
  });
}));

export default router;
