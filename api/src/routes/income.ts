/**
 * Income API routes
 *
 * Handles income CRUD operations for accounting/EÜR.
 */

import { Router, type Request, type Response } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { cache, cacheKey, TTL } from "../cache.js";

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface IncomeRow {
  id: string;
  date: string;
  client_id: string | null;
  invoice_id: string | null;
  description: string;
  net_amount: number;
  vat_rate: number;
  vat_amount: number;
  gross_amount: number;
  euer_line: number;
  euer_category: string;
  payment_method: string | null;
  bank_reference: string | null;
  ust_period: string | null;
  ust_reported: number;
  created_at: string;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * List all income records
 */
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { start_date, end_date, client_id, ust_period, ust_reported } = req.query;
  const key = cacheKey("income", "list", start_date as string, end_date as string, client_id as string, ust_period as string, ust_reported as string);

  const cached = cache.get(key);
  if (cached) {
    return res.json(cached);
  }

  const db = getDb();

  let sql = "SELECT * FROM income WHERE 1=1";
  const params: unknown[] = [];

  if (start_date) {
    sql += " AND date >= ?";
    params.push(start_date);
  }

  if (end_date) {
    sql += " AND date <= ?";
    params.push(end_date);
  }

  if (client_id) {
    sql += " AND client_id = ?";
    params.push(client_id);
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

  const income = db.prepare(sql).all(...params) as IncomeRow[];
  cache.set(key, income, TTL.INCOME);
  res.json(income);
}));

/**
 * Get single income record by ID
 */
router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const income = db.prepare("SELECT * FROM income WHERE id = ?").get(
    req.params.id
  ) as IncomeRow | undefined;

  if (!income) {
    throw new NotFoundError("Income record", req.params.id);
  }

  res.json(income);
}));

/**
 * Create a new income record
 */
router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const {
    date,
    client_id,
    invoice_id,
    description,
    net_amount,
    vat_rate = 19,
    euer_line = 14,
    euer_category = "services",
    payment_method,
    bank_reference,
    ust_period,
  } = req.body;

  if (!date || !description || net_amount === undefined) {
    throw new ValidationError("date, description, and net_amount are required");
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  // Auto-calculate VAT amounts
  const vatAmount = Math.round(net_amount * (vat_rate / 100) * 100) / 100;
  const grossAmount = Math.round((net_amount + vatAmount) * 100) / 100;

  db.prepare(
    `INSERT INTO income (
      id, date, client_id, invoice_id, description, net_amount, vat_rate,
      vat_amount, gross_amount, euer_line, euer_category, payment_method,
      bank_reference, ust_period, ust_reported, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    id,
    date,
    client_id || null,
    invoice_id || null,
    description,
    net_amount,
    vat_rate,
    vatAmount,
    grossAmount,
    euer_line,
    euer_category,
    payment_method || null,
    bank_reference || null,
    ust_period || null,
    now
  );

  const income = db.prepare("SELECT * FROM income WHERE id = ?").get(id);
  cache.invalidate("income:*");
  res.status(201).json(income);
}));

/**
 * Update an income record
 */
router.patch("/:id", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM income WHERE id = ?").get(id) as
    | IncomeRow
    | undefined;

  if (!existing) {
    throw new NotFoundError("Income record", id);
  }

  const fields = [
    "date",
    "client_id",
    "invoice_id",
    "description",
    "euer_line",
    "euer_category",
    "payment_method",
    "bank_reference",
    "ust_period",
    "ust_reported",
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
    db.prepare(`UPDATE income SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  const income = db.prepare("SELECT * FROM income WHERE id = ?").get(id);
  cache.invalidate("income:*");
  res.json(income);
}));

/**
 * Delete an income record
 */
router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM income WHERE id = ?").get(id) as
    | IncomeRow
    | undefined;

  if (!existing) {
    throw new NotFoundError("Income record", id);
  }

  db.prepare("DELETE FROM income WHERE id = ?").run(id);
  cache.invalidate("income:*");
  res.json({ success: true, message: "Income record deleted" });
}));

/**
 * Mark multiple income records as USt reported
 */
router.post("/mark-reported", asyncHandler(async (req: Request, res: Response) => {
  const db = getDb();
  const { ids, ust_period } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ValidationError("ids array is required");
  }

  const placeholders = ids.map(() => "?").join(", ");
  const params = [...ids];

  if (ust_period) {
    db.prepare(
      `UPDATE income SET ust_reported = 1, ust_period = ? WHERE id IN (${placeholders})`
    ).run(ust_period, ...params);
  } else {
    db.prepare(
      `UPDATE income SET ust_reported = 1 WHERE id IN (${placeholders})`
    ).run(...params);
  }

  cache.invalidate("income:*");
  res.json({ success: true, updated: ids.length });
}));

export default router;
