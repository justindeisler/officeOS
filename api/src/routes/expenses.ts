/**
 * Expenses API routes
 *
 * Handles expense CRUD operations for accounting/EÜR.
 */

import { Router, type Request, type Response } from "express";
import { existsSync, createReadStream } from "fs";
import { basename } from "path";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { cache, cacheKey, TTL } from "../cache.js";
import { validateBody } from "../middleware/validateBody.js";
import { CreateExpenseSchema, UpdateExpenseSchema, MarkExpensesReportedSchema } from "../schemas/index.js";
import { EXPENSE_CATEGORIES as SHARED_EXPENSE_CATEGORIES, EXPENSE_CATEGORY_MAP, LEGACY_CATEGORY_MAP } from "../constants/expense-categories.js";

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface ExpenseRow {
  id: string;
  date: string;
  vendor: string | null;
  description: string;
  category: string;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  gross_amount: number;
  euer_line: number | null;
  euer_category: string | null;
  payment_method: string | null;
  receipt_path: string | null;
  ust_period: string | null;
  ust_reported: number;
  deductible_percent: number;
  vorsteuer_claimed: number;
  is_recurring: number;
  recurring_frequency: string | null;
  is_gwg: number;
  asset_id: string | null;
  created_at: string;
}

// Expense categories from shared constant (single source of truth)
const EXPENSE_CATEGORIES = SHARED_EXPENSE_CATEGORIES;

// ============================================================================
// Routes
// ============================================================================

/**
 * Get expense categories
 */
router.get("/categories", (_req: Request, res: Response) => {
  res.json(EXPENSE_CATEGORIES);
});

/**
 * List all expenses
 */
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { start_date, end_date, category, vendor, ust_period, ust_reported } = req.query;
  const key = cacheKey("expenses", "list", start_date as string, end_date as string, category as string, vendor as string, ust_period as string, ust_reported as string);

  const cached = cache.get(key);
  if (cached) {
    return res.json(cached);
  }

  const db = getDb();

  let sql = "SELECT * FROM expenses WHERE 1=1";
  const params: unknown[] = [];

  if (start_date) {
    sql += " AND date >= ?";
    params.push(start_date);
  }

  if (end_date) {
    sql += " AND date <= ?";
    params.push(end_date);
  }

  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }

  if (vendor) {
    sql += " AND vendor LIKE ?";
    params.push(`%${vendor}%`);
  }

  if (ust_period) {
    sql += " AND ust_period = ?";
    params.push(ust_period);
  }

  if (ust_reported !== undefined) {
    sql += " AND ust_reported = ?";
    params.push(ust_reported === "true" || ust_reported === "1" ? 1 : 0);
  }

  sql += " ORDER BY date DESC";

  const expenses = db.prepare(sql).all(...params) as ExpenseRow[];
  cache.set(key, expenses, TTL.EXPENSES);
  res.json(expenses);
}));

/**
 * Get single expense by ID
 */
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(
    req.params.id
  ) as ExpenseRow | undefined;

  if (!expense) {
    throw new NotFoundError("Expense", req.params.id);
  }

  res.json(expense);
}));

/**
 * Get receipt PDF for an expense
 */
router.get("/:id/receipt", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(
    req.params.id
  ) as ExpenseRow | undefined;

  if (!expense) {
    throw new NotFoundError("Expense", req.params.id);
  }

  if (!expense.receipt_path) {
    throw new NotFoundError("Receipt (no receipt attached to this expense)");
  }

  // Check if file exists
  if (!existsSync(expense.receipt_path)) {
    throw new NotFoundError("Receipt file (not found on disk)");
  }

  const filename = basename(expense.receipt_path);
  const download = req.query.download === "true";

  // Set appropriate headers
  res.setHeader("Content-Type", "application/pdf");
  if (download) {
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  } else {
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  }

  // Stream the file
  const stream = createReadStream(expense.receipt_path);
  stream.pipe(res);
}));

/**
 * Create a new expense
 */
router.post("/", validateBody(CreateExpenseSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const {
    date,
    vendor,
    description,
    category,
    net_amount,
    vat_rate = 19,
    euer_line,
    euer_category,
    payment_method,
    receipt_path,
    ust_period,
    deductible_percent = 100,
    vorsteuer_claimed = 0,
    is_recurring = 0,
    recurring_frequency,
    is_gwg = 0,
    asset_id,
  } = req.body;

  if (!date || !description || !category || net_amount === undefined) {
    throw new ValidationError("date, description, category, and net_amount are required");
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  // Auto-calculate VAT amounts
  const vatAmount = Math.round(net_amount * (vat_rate / 100) * 100) / 100;
  const grossAmount = Math.round((net_amount + vatAmount) * 100) / 100;

  // Normalize legacy category IDs
  const normalizedCategory = LEGACY_CATEGORY_MAP[category] || category;

  // Look up euer_line from category if not provided
  const categoryInfo = EXPENSE_CATEGORY_MAP.get(normalizedCategory);
  const finalEuerLine = euer_line ?? categoryInfo?.euer_line ?? 34;

  db.prepare(
    `INSERT INTO expenses (
      id, date, vendor, description, category, net_amount, vat_rate,
      vat_amount, gross_amount, euer_line, euer_category, payment_method,
      receipt_path, ust_period, ust_reported,
      deductible_percent, vorsteuer_claimed, is_recurring, recurring_frequency,
      is_gwg, asset_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    date,
    vendor || null,
    description,
    normalizedCategory,
    net_amount,
    vat_rate,
    vatAmount,
    grossAmount,
    finalEuerLine,
    euer_category || null,
    payment_method || null,
    receipt_path || null,
    ust_period || null,
    deductible_percent,
    vorsteuer_claimed ? 1 : 0,
    is_recurring ? 1 : 0,
    recurring_frequency || null,
    is_gwg ? 1 : 0,
    asset_id || null,
    now
  );

  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  cache.invalidate("expenses:*");
  res.status(201).json(expense);
}));

/**
 * Update an expense
 */
router.patch("/:id", validateBody(UpdateExpenseSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as
    | ExpenseRow
    | undefined;

  if (!existing) {
    throw new NotFoundError("Expense", id);
  }

  const fields = [
    "date",
    "vendor",
    "description",
    "category",
    "euer_line",
    "euer_category",
    "payment_method",
    "receipt_path",
    "ust_period",
    "ust_reported",
    "deductible_percent",
    "vorsteuer_claimed",
    "is_recurring",
    "recurring_frequency",
    "is_gwg",
    "asset_id",
  ];
  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  // Recalculate VAT if amounts change
  if (req.body.net_amount !== undefined || req.body.vat_rate !== undefined) {
    const netAmount = req.body.net_amount ?? existing.net_amount;
    const vatRate = req.body.vat_rate ?? existing.vat_rate;
    const vatAmount = Math.round(netAmount * (vatRate / 100) * 100) / 100;
    const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;

    updates.push("net_amount = ?", "vat_rate = ?", "vat_amount = ?", "gross_amount = ?");
    params.push(netAmount, vatRate, vatAmount, grossAmount);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE expenses SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  cache.invalidate("expenses:*");
  res.json(expense);
}));

/**
 * Delete an expense
 */
router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as
    | ExpenseRow
    | undefined;

  if (!existing) {
    throw new NotFoundError("Expense", id);
  }

  db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
  cache.invalidate("expenses:*");
  res.json({ success: true, message: "Expense deleted" });
}));

/**
 * Mark multiple expenses as USt reported
 */
router.post("/mark-reported", validateBody(MarkExpensesReportedSchema), asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { ids, ust_period } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError("ids array is required");
  }

  const placeholders = ids.map(() => "?").join(", ");
  const params = [...ids];

  if (ust_period) {
    db.prepare(
      `UPDATE expenses SET ust_reported = 1, ust_period = ? WHERE id IN (${placeholders})`
    ).run(ust_period, ...params);
  } else {
    db.prepare(
      `UPDATE expenses SET ust_reported = 1 WHERE id IN (${placeholders})`
    ).run(...params);
  }

  cache.invalidate("expenses:*");
  res.json({ success: true, updated: ids.length });
}));

export default router;
