/**
 * Public REST API v1 — Assets
 *
 * CRUD endpoints for assets with depreciation schedule access.
 */

import { Router, type Request, type Response } from 'express';
import { getDb, generateId, getCurrentTimestamp } from '../../database.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { sendSuccess, sendError } from '../../middleware/responseFormatter.js';
import { paginate } from '../../utils/pagination.js';

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
  vendor: string | null;
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

function getCurrentBookValue(db: ReturnType<typeof getDb>, assetId: string): number | null {
  const currentYear = new Date().getFullYear();
  const entry = db.prepare(
    `SELECT book_value FROM depreciation_schedule WHERE asset_id = ? AND year <= ? ORDER BY year DESC LIMIT 1`
  ).get(assetId, currentYear) as { book_value: number } | undefined;
  return entry?.book_value ?? null;
}

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
  const startMonth = startDate.getMonth() + 1;
  const depreciableAmount = purchasePrice - salvageValue;
  const firstYearMonths = 13 - startMonth;
  const firstYearFraction = firstYearMonths / 12;
  const needsExtraYear = firstYearFraction < 1;
  const totalYears = usefulLifeYears + (needsExtraYear ? 1 : 0);
  let accumulated = 0;

  // Linear depreciation
  const annualAmount = depreciableAmount / usefulLifeYears;
  const firstYearAmount = Math.round(annualAmount * firstYearFraction * 100) / 100;

  for (let i = 0; i < totalYears; i++) {
    const year = startYear + i;
    let depreciationAmount: number;

    if (i === 0 && needsExtraYear) {
      depreciationAmount = firstYearAmount;
    } else if (i === totalYears - 1 && needsExtraYear) {
      depreciationAmount = Math.round((depreciableAmount - accumulated) * 100) / 100;
    } else {
      depreciationAmount = Math.round(annualAmount * 100) / 100;
    }

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

  const insertStmt = db.prepare(
    `INSERT INTO depreciation_schedule (id, asset_id, year, depreciation_amount, accumulated_depreciation, book_value)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const row of schedule) {
    insertStmt.run(row.id, row.asset_id, row.year, row.depreciation_amount, row.accumulated_depreciation, row.book_value);
  }

  return schedule;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/v1/assets — List all assets (paginated)
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { page, limit, status, category } = req.query;

  let sql = 'SELECT * FROM assets WHERE 1=1';
  const params: unknown[] = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY purchase_date DESC';

  const assets = db.prepare(sql).all(...params) as AssetRow[];
  const withValues = assets.map(a => ({
    ...a,
    current_value: getCurrentBookValue(db, a.id) ?? a.purchase_price,
  }));

  const result = paginate(withValues, { page: page as string, limit: limit as string });
  sendSuccess(res, result.items, 200, result.meta);
}));

/**
 * GET /api/v1/assets/:id — Get single asset with depreciation schedule
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow | undefined;
  if (!asset) {
    return sendError(res, 'Asset not found', 'NOT_FOUND', 404);
  }

  const schedule = db.prepare(
    'SELECT * FROM depreciation_schedule WHERE asset_id = ? ORDER BY year'
  ).all(id) as DepreciationRow[];

  sendSuccess(res, {
    ...asset,
    current_value: getCurrentBookValue(db, id) ?? asset.purchase_price,
    depreciation_schedule: schedule,
  });
}));

/**
 * POST /api/v1/assets — Create asset
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const {
    name, description, category, purchase_date, purchase_price,
    useful_life_years, depreciation_method = 'linear',
    salvage_value = 0, vendor,
  } = req.body;

  if (!name || !category || !purchase_date || purchase_price === undefined || !useful_life_years) {
    return sendError(res, 'name, category, purchase_date, purchase_price, and useful_life_years are required', 'VALIDATION_ERROR', 400);
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  db.prepare(
    `INSERT INTO assets (id, name, description, category, purchase_date, purchase_price,
     useful_life_years, depreciation_method, salvage_value, current_value, status, vendor, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).run(
    id, name, description || null, category, purchase_date, purchase_price,
    useful_life_years, depreciation_method, salvage_value, purchase_price,
    vendor || null, now
  );

  const schedule = generateDepreciationSchedule(
    db, id, purchase_date, purchase_price, useful_life_years, salvage_value, depreciation_method
  );

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow;
  sendSuccess(res, { ...asset, depreciation_schedule: schedule }, 201);
}));

/**
 * PATCH /api/v1/assets/:id — Update asset
 */
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow | undefined;
  if (!existing) {
    return sendError(res, 'Asset not found', 'NOT_FOUND', 404);
  }

  const fields = ['name', 'description', 'category', 'status', 'vendor'];
  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow;
  const schedule = db.prepare(
    'SELECT * FROM depreciation_schedule WHERE asset_id = ? ORDER BY year'
  ).all(id) as DepreciationRow[];

  sendSuccess(res, {
    ...updated,
    current_value: getCurrentBookValue(db, id) ?? updated.purchase_price,
    depreciation_schedule: schedule,
  });
}));

/**
 * DELETE /api/v1/assets/:id — Delete asset
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow | undefined;
  if (!existing) {
    return sendError(res, 'Asset not found', 'NOT_FOUND', 404);
  }

  db.prepare('DELETE FROM depreciation_schedule WHERE asset_id = ?').run(id);
  db.prepare('DELETE FROM assets WHERE id = ?').run(id);
  sendSuccess(res, { id, deleted: true });
}));

/**
 * GET /api/v1/assets/:id/depreciation — Get depreciation schedule
 */
router.get('/:id/depreciation', asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow | undefined;
  if (!asset) {
    return sendError(res, 'Asset not found', 'NOT_FOUND', 404);
  }

  const schedule = db.prepare(
    'SELECT * FROM depreciation_schedule WHERE asset_id = ? ORDER BY year'
  ).all(id) as DepreciationRow[];

  sendSuccess(res, schedule);
}));

export default router;
