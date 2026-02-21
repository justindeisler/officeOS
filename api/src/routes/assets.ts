/**
 * Assets API routes
 *
 * Handles asset CRUD operations and depreciation schedules for accounting/EÜR.
 */

import { Router, type Request, type Response } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { validateBody } from "../middleware/validateBody.js";
import { CreateAssetSchema, UpdateAssetSchema, DepreciateAssetSchema } from "../schemas/index.js";

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
  disposal_date: string | null;
  disposal_price: number | null;
  disposal_reason: string | null;
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
  const startDate = new Date(purchaseDate);
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1; // 1-indexed (Jan=1)
  const depreciableAmount = purchasePrice - salvageValue;

  // Pro-rata: month of acquisition counts as full month (German tax law)
  const firstYearMonths = 13 - startMonth; // e.g. Oct purchase → 3 months (Oct, Nov, Dec)
  const firstYearFraction = firstYearMonths / 12;

  // If purchased in January, no extra year needed (full first year)
  const needsExtraYear = firstYearFraction < 1;
  const totalYears = usefulLifeYears + (needsExtraYear ? 1 : 0);

  let accumulated = 0;

  if (method === "declining") {
    // Declining balance: rate = 2/usefulLifeYears, capped at 25% (German law)
    const maxRate = 0.25;
    const rate = Math.min(2 / usefulLifeYears, maxRate);

    for (let i = 0; i < totalYears; i++) {
      const year = startYear + i;
      const bookValueStart = purchasePrice - accumulated;

      // Calculate declining balance amount
      let decliningAmount = Math.round(bookValueStart * rate * 100) / 100;

      // Pro-rata for first year
      if (i === 0 && needsExtraYear) {
        decliningAmount = Math.round(decliningAmount * firstYearFraction * 100) / 100;
      }

      // Calculate linear remaining for switch-to-linear check
      const remainingYears = totalYears - i;
      const linearRemaining = Math.round(((bookValueStart - salvageValue) / remainingYears) * 100) / 100;

      // Use the higher of declining or linear (auto-switch)
      let depreciationAmount = Math.max(decliningAmount, linearRemaining);

      // Don't exceed remaining depreciable amount
      if (accumulated + depreciationAmount > depreciableAmount) {
        depreciationAmount = depreciableAmount - accumulated;
      }

      // Don't let book value go below salvage value
      if (purchasePrice - accumulated - depreciationAmount < salvageValue) {
        depreciationAmount = purchasePrice - accumulated - salvageValue;
      }

      // Final year: absorb rounding remainder
      if (i === totalYears - 1) {
        depreciationAmount = Math.round((depreciableAmount - accumulated) * 100) / 100;
      }

      accumulated += depreciationAmount;
      const bookValue = Math.round((purchasePrice - accumulated) * 100) / 100;

      schedule.push({
        id: generateId(),
        asset_id: assetId,
        year,
        depreciation_amount: Math.round(depreciationAmount * 100) / 100,
        accumulated_depreciation: Math.round(accumulated * 100) / 100,
        book_value: bookValue,
      });
    }
  } else {
    // Linear depreciation (default)
    const annualAmount = depreciableAmount / usefulLifeYears;
    const firstYearAmount = Math.round(annualAmount * firstYearFraction * 100) / 100;

    for (let i = 0; i < totalYears; i++) {
      const year = startYear + i;
      let depreciationAmount: number;

      if (i === 0 && needsExtraYear) {
        // First year: pro-rata
        depreciationAmount = firstYearAmount;
      } else if (i === totalYears - 1 && needsExtraYear) {
        // Last year: remainder (the complementary months)
        depreciationAmount = Math.round((depreciableAmount - accumulated) * 100) / 100;
      } else {
        // Full years
        depreciationAmount = Math.round(annualAmount * 100) / 100;
      }

      // Safety: don't exceed depreciable amount
      if (accumulated + depreciationAmount > depreciableAmount) {
        depreciationAmount = Math.round((depreciableAmount - accumulated) * 100) / 100;
      }

      accumulated += depreciationAmount;
      const bookValue = Math.round((purchasePrice - accumulated) * 100) / 100;

      schedule.push({
        id: generateId(),
        asset_id: assetId,
        year,
        depreciation_amount: Math.round(depreciationAmount * 100) / 100,
        accumulated_depreciation: Math.round(accumulated * 100) / 100,
        book_value: bookValue,
      });
    }
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

router.post("/", validateBody(CreateAssetSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const {
    name,
    description,
    category,
    purchase_date,
    purchase_price,
    useful_life_years: requestedUsefulLife,
    depreciation_method = "linear",
    salvage_value = 0,
  } = req.body;

  if (!name || !category || !purchase_date || purchase_price === undefined || !requestedUsefulLife) {
    throw new ValidationError("name, category, purchase_date, purchase_price, and useful_life_years are required");
  }

  // GWG detection: assets ≤€800 net get immediate write-off (1-year useful life)
  // unless the caller explicitly sets a longer useful life
  const isGwg = purchase_price <= 800;
  const isSofortabschreibung = purchase_price <= 250;
  
  // For GWG ≤€250: always immediate write-off (Sofortabschreibung)
  // For GWG €250-€800: use 1-year schedule unless caller specified > 1 year
  let useful_life_years = requestedUsefulLife;
  if (isSofortabschreibung) {
    useful_life_years = 1;
  } else if (isGwg && requestedUsefulLife <= 1) {
    useful_life_years = 1;
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

  // For GWG with immediate write-off, auto-create an expense entry
  let gwgExpenseId: string | null = null;
  if (isGwg && useful_life_years === 1) {
    gwgExpenseId = generateId();
    db.prepare(
      `INSERT INTO expenses (
        id, date, vendor, description, category, net_amount, vat_rate,
        vat_amount, gross_amount, euer_line, euer_category, is_gwg, asset_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 30, 'depreciation', 1, ?, ?)`
    ).run(
      gwgExpenseId,
      purchase_date,
      null,
      `GWG Sofortabschreibung: ${name}`,
      'depreciation',
      purchase_price,
      purchase_price,
      id,
      now
    );
  }

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as AssetRow;
  res.status(201).json({
    ...asset,
    depreciation_schedule: schedule,
    is_gwg: isGwg,
    gwg_expense_id: gwgExpenseId,
  });
}));

router.patch("/:id", validateBody(UpdateAssetSchema), asyncHandler(async (req: Request, res: Response) => {
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

router.post("/:id/depreciate", validateBody(DepreciateAssetSchema), asyncHandler(async (req: Request, res: Response) => {
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

// ============================================================================
// Dispose Asset
// ============================================================================

router.post("/:id/dispose", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { disposal_date, disposal_price, disposal_reason, status: requestedStatus } = req.body;

  if (!disposal_date) {
    throw new ValidationError("disposal_date is required");
  }
  if (disposal_price === undefined || disposal_price === null) {
    throw new ValidationError("disposal_price is required (use 0 for scrapped/donated)");
  }

  const asset = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as
    | AssetRow
    | undefined;

  if (!asset) {
    throw new NotFoundError("Asset", id);
  }

  if (asset.status !== "active") {
    throw new ValidationError(`Asset is already ${asset.status}, cannot dispose`);
  }

  // Calculate book value at disposal date
  const disposalYear = new Date(disposal_date).getFullYear();
  const entry = db.prepare(
    `SELECT book_value FROM depreciation_schedule 
     WHERE asset_id = ? AND year <= ? 
     ORDER BY year DESC LIMIT 1`
  ).get(id, disposalYear) as { book_value: number } | undefined;

  const bookValue = entry?.book_value ?? asset.purchase_price;

  // Calculate gain/loss
  const gainLoss = Math.round((disposal_price - bookValue) * 100) / 100;

  // Determine status: 'sold' if price > 0, 'disposed' if scrapped/donated
  // Allow explicit status override from frontend
  const newStatus = requestedStatus || (disposal_price > 0 ? "sold" : "disposed");

  // Update asset
  db.prepare(
    `UPDATE assets SET 
       status = ?, 
       disposal_date = ?, 
       disposal_price = ?, 
       disposal_reason = ?,
       current_value = ?
     WHERE id = ?`
  ).run(
    newStatus,
    disposal_date,
    disposal_price,
    disposal_reason || null,
    bookValue,
    id
  );

  const updated = db.prepare("SELECT * FROM assets WHERE id = ?").get(id) as AssetRow;
  const schedule = db.prepare(
    "SELECT * FROM depreciation_schedule WHERE asset_id = ? ORDER BY year"
  ).all(id) as DepreciationRow[];

  res.json({
    ...updated,
    current_value: bookValue,
    depreciation_schedule: schedule,
    disposal_gain_loss: gainLoss,
    book_value_at_disposal: bookValue,
  });
}));

export default router;
