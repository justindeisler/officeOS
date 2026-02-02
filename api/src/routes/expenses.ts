/**
 * Expenses API routes
 *
 * Handles expense CRUD operations for accounting/EÜR.
 */

import { Router, type Request, type Response } from "express";
import { existsSync, createReadStream } from "fs";
import { basename } from "path";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";

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
  created_at: string;
}

// Default expense categories for EÜR
const EXPENSE_CATEGORIES = [
  { id: "office", name: "Bürokosten", euer_line: 27 },
  { id: "software", name: "Software & Abonnements", euer_line: 27 },
  { id: "hardware", name: "Hardware & Technik", euer_line: 27 },
  { id: "communication", name: "Telefon & Internet", euer_line: 27 },
  { id: "travel", name: "Reisekosten", euer_line: 27 },
  { id: "education", name: "Fortbildung", euer_line: 27 },
  { id: "insurance", name: "Versicherungen", euer_line: 27 },
  { id: "legal", name: "Rechts- & Beratungskosten", euer_line: 27 },
  { id: "marketing", name: "Marketing & Werbung", euer_line: 27 },
  { id: "depreciation", name: "Abschreibungen", euer_line: 30 },
  { id: "other", name: "Sonstige Kosten", euer_line: 27 },
];

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
router.get("/", (req: Request, res: Response) => {
  const db = getDb();
  const { start_date, end_date, category, vendor, ust_period, ust_reported } = req.query;

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
  res.json(expenses);
});

/**
 * Get single expense by ID
 */
router.get("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(
    req.params.id
  ) as ExpenseRow | undefined;

  if (!expense) {
    return res.status(404).json({ error: "Expense not found" });
  }

  res.json(expense);
});

/**
 * Get receipt PDF for an expense
 */
router.get("/:id/receipt", (req: Request, res: Response) => {
  const db = getDb();
  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(
    req.params.id
  ) as ExpenseRow | undefined;

  if (!expense) {
    return res.status(404).json({ error: "Expense not found" });
  }

  if (!expense.receipt_path) {
    return res.status(404).json({ error: "No receipt attached to this expense" });
  }

  // Check if file exists
  if (!existsSync(expense.receipt_path)) {
    return res.status(404).json({ error: "Receipt file not found on disk" });
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
});

/**
 * Create a new expense
 */
router.post("/", (req: Request, res: Response) => {
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
  } = req.body;

  if (!date || !description || !category || net_amount === undefined) {
    return res.status(400).json({ 
      error: "date, description, category, and net_amount are required" 
    });
  }

  const id = generateId();
  const now = getCurrentTimestamp();

  // Auto-calculate VAT amounts
  const vatAmount = Math.round(net_amount * (vat_rate / 100) * 100) / 100;
  const grossAmount = Math.round((net_amount + vatAmount) * 100) / 100;

  // Look up euer_line from category if not provided
  const categoryInfo = EXPENSE_CATEGORIES.find(c => c.id === category);
  const finalEuerLine = euer_line ?? categoryInfo?.euer_line ?? null;

  db.prepare(
    `INSERT INTO expenses (
      id, date, vendor, description, category, net_amount, vat_rate,
      vat_amount, gross_amount, euer_line, euer_category, payment_method,
      receipt_path, ust_period, ust_reported, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    id,
    date,
    vendor || null,
    description,
    category,
    net_amount,
    vat_rate,
    vatAmount,
    grossAmount,
    finalEuerLine,
    euer_category || null,
    payment_method || null,
    receipt_path || null,
    ust_period || null,
    now
  );

  const expense = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  res.status(201).json(expense);
});

/**
 * Update an expense
 */
router.patch("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as
    | ExpenseRow
    | undefined;

  if (!existing) {
    return res.status(404).json({ error: "Expense not found" });
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
  res.json(expense);
});

/**
 * Delete an expense
 */
router.delete("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id) as
    | ExpenseRow
    | undefined;

  if (!existing) {
    return res.status(404).json({ error: "Expense not found" });
  }

  db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
  res.json({ success: true, message: "Expense deleted" });
});

/**
 * Mark multiple expenses as USt reported
 */
router.post("/mark-reported", (req: Request, res: Response) => {
  const db = getDb();
  const { ids, ust_period } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array is required" });
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

  res.json({ success: true, updated: ids.length });
});

export default router;
