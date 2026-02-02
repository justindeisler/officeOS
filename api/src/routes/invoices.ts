/**
 * Invoices API routes
 *
 * Handles invoice CRUD operations and PDF generation.
 */

import { Router, type Request, type Response } from "express";
import { getDb, generateId, getCurrentTimestamp } from "../database.js";
import {
  generateInvoicePdf,
  generateInvoicePdfBuffer,
  getInvoicePdfPath,
  invoicePdfExists,
  deleteInvoicePdf,
  type InvoiceData,
  type ClientInfo,
  type InvoiceItem,
  getDefaultSeller,
} from "../services/pdfService.js";

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  client_id: string | null;
  project_id: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  pdf_path: string | null;
  created_at: string;
}

interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
}

interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  contact_info: string | null;
  notes: string | null;
  status: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the next invoice number
 */
function getNextInvoiceNumber(db: ReturnType<typeof getDb>): string {
  const year = new Date().getFullYear();
  const prefix = `RE-${year}-`;

  const result = db
    .prepare(
      `SELECT invoice_number FROM invoices
       WHERE invoice_number LIKE ?
       ORDER BY invoice_number DESC
       LIMIT 1`
    )
    .get(`${prefix}%`) as { invoice_number: string } | undefined;

  if (!result) {
    return `${prefix}001`;
  }

  const lastNumber = result.invoice_number;
  const lastSequence = parseInt(lastNumber.replace(prefix, ""), 10);
  const nextSequence = lastSequence + 1;

  return `${prefix}${String(nextSequence).padStart(3, "0")}`;
}

/**
 * Get invoice items for an invoice
 */
function getInvoiceItems(
  db: ReturnType<typeof getDb>,
  invoiceId: string
): InvoiceItemRow[] {
  return db
    .prepare("SELECT * FROM invoice_items WHERE invoice_id = ?")
    .all(invoiceId) as InvoiceItemRow[];
}

/**
 * Get client by ID
 */
function getClientById(
  db: ReturnType<typeof getDb>,
  clientId: string
): ClientRow | undefined {
  return db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId) as
    | ClientRow
    | undefined;
}

/**
 * Convert database row to InvoiceData for PDF generation
 */
function rowToInvoiceData(
  row: InvoiceRow,
  items: InvoiceItemRow[],
  client: ClientRow | undefined
): InvoiceData {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceDate: new Date(row.invoice_date),
    dueDate: new Date(row.due_date),
    status: row.status as InvoiceData["status"],
    client: {
      name: client?.name || "Unknown Client",
      company: client?.company || undefined,
      email: client?.email || undefined,
      // Address would need to be parsed from contact_info or a separate field
      address: parseClientAddress(client?.contact_info),
    },
    items: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unit_price,
      amount: item.amount,
    })),
    subtotal: row.subtotal,
    vatRate: row.vat_rate,
    vatAmount: row.vat_amount,
    total: row.total,
    notes: row.notes || undefined,
    paymentDate: row.payment_date ? new Date(row.payment_date) : undefined,
  };
}

/**
 * Parse client address from contact_info field (JSON or plain text)
 */
function parseClientAddress(
  contactInfo: string | null | undefined
): ClientInfo["address"] | undefined {
  if (!contactInfo) return undefined;

  try {
    // Try parsing as JSON
    const parsed = JSON.parse(contactInfo);
    if (parsed.address) {
      return {
        street: parsed.address.street || "",
        zip: parsed.address.zip || "",
        city: parsed.address.city || "",
        country: parsed.address.country,
      };
    }
  } catch {
    // Not JSON, treat as plain address text
    const lines = contactInfo.split("\n").filter((l) => l.trim());
    if (lines.length >= 2) {
      // Assume last line is city/zip, rest is street
      const lastLine = lines[lines.length - 1];
      const zipMatch = lastLine.match(/(\d{5})\s+(.+)/);
      if (zipMatch) {
        return {
          street: lines.slice(0, -1).join(", "),
          zip: zipMatch[1],
          city: zipMatch[2],
        };
      }
    }
  }

  return undefined;
}

/**
 * Generate PDF for an invoice and update the database
 */
async function generateAndSavePdf(
  db: ReturnType<typeof getDb>,
  invoiceId: string
): Promise<string | null> {
  const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId) as
    | InvoiceRow
    | undefined;

  if (!row) return null;

  const items = getInvoiceItems(db, invoiceId);
  const client = row.client_id ? getClientById(db, row.client_id) : undefined;
  const invoiceData = rowToInvoiceData(row, items, client);

  try {
    const pdfPath = await generateInvoicePdf(invoiceData);

    // Update the invoice with the PDF path
    db.prepare("UPDATE invoices SET pdf_path = ? WHERE id = ?").run(
      pdfPath,
      invoiceId
    );

    return pdfPath;
  } catch (error) {
    console.error("[Invoices] Failed to generate PDF:", error);
    return null;
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * List all invoices
 */
router.get("/", (req: Request, res: Response) => {
  const db = getDb();
  const { status, client_id } = req.query;

  let sql = "SELECT * FROM invoices WHERE 1=1";
  const params: unknown[] = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  if (client_id) {
    sql += " AND client_id = ?";
    params.push(client_id);
  }

  sql += " ORDER BY invoice_date DESC";

  const invoices = db.prepare(sql).all(...params) as InvoiceRow[];

  // Include items with each invoice
  const result = invoices.map((invoice) => ({
    ...invoice,
    items: getInvoiceItems(db, invoice.id),
  }));

  res.json(result);
});

/**
 * Get single invoice by ID
 */
router.get("/:id", (req: Request, res: Response) => {
  const db = getDb();
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(
    req.params.id
  ) as InvoiceRow | undefined;

  if (!invoice) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  const items = getInvoiceItems(db, invoice.id);
  res.json({ ...invoice, items });
});

/**
 * Create a new invoice
 */
router.post("/", async (req: Request, res: Response) => {
  const db = getDb();
  const {
    client_id,
    project_id,
    invoice_date,
    due_date,
    vat_rate = 19,
    notes,
    items = [],
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "At least one line item is required" });
  }

  const id = generateId();
  const invoiceNumber = getNextInvoiceNumber(db);
  const now = getCurrentTimestamp();

  // Calculate totals
  const subtotal = items.reduce(
    (sum: number, item: { quantity: number; unit_price: number }) =>
      sum + item.quantity * item.unit_price,
    0
  );
  const vatAmount = Math.round(subtotal * (vat_rate / 100) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  // Insert invoice
  db.prepare(
    `INSERT INTO invoices (
      id, invoice_number, invoice_date, due_date, status, client_id, project_id,
      subtotal, vat_rate, vat_amount, total, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    invoiceNumber,
    invoice_date || new Date().toISOString().split("T")[0],
    due_date ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    "draft",
    client_id || null,
    project_id || null,
    subtotal,
    vat_rate,
    vatAmount,
    total,
    notes || null,
    now
  );

  // Insert invoice items
  const insertItem = db.prepare(
    `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit, unit_price, amount)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const item of items) {
    const itemAmount =
      Math.round(item.quantity * item.unit_price * 100) / 100;
    insertItem.run(
      generateId(),
      id,
      item.description,
      item.quantity,
      item.unit || "hours",
      item.unit_price,
      itemAmount
    );
  }

  // Auto-generate PDF
  const pdfPath = await generateAndSavePdf(db, id);

  // Return the created invoice
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as InvoiceRow;
  const invoiceItems = getInvoiceItems(db, id);

  res.status(201).json({
    ...invoice,
    items: invoiceItems,
    pdf_path: pdfPath,
  });
});

/**
 * Update an invoice
 */
router.patch("/:id", async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as
    | InvoiceRow
    | undefined;

  if (!existing) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  // Only allow updates for draft invoices
  if (existing.status !== "draft") {
    return res.status(400).json({ error: "Can only update draft invoices" });
  }

  const fields = [
    "client_id",
    "project_id",
    "invoice_date",
    "due_date",
    "vat_rate",
    "notes",
  ];
  const updates: string[] = [];
  const params: unknown[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  // If items are provided, update them and recalculate totals
  if (req.body.items && req.body.items.length > 0) {
    // Delete existing items
    db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(id);

    // Insert new items
    const insertItem = db.prepare(
      `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit, unit_price, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const vatRate = req.body.vat_rate ?? existing.vat_rate;
    let subtotal = 0;

    for (const item of req.body.items) {
      const itemAmount =
        Math.round(item.quantity * item.unit_price * 100) / 100;
      subtotal += itemAmount;
      insertItem.run(
        generateId(),
        id,
        item.description,
        item.quantity,
        item.unit || "hours",
        item.unit_price,
        itemAmount
      );
    }

    const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;

    updates.push("subtotal = ?", "vat_amount = ?", "total = ?");
    params.push(subtotal, vatAmount, total);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE invoices SET ${updates.join(", ")} WHERE id = ?`).run(
      ...params
    );

    // Regenerate PDF after update
    await generateAndSavePdf(db, id);
  }

  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as InvoiceRow;
  const items = getInvoiceItems(db, id);
  res.json({ ...invoice, items });
});

/**
 * Delete an invoice
 */
router.delete("/:id", async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as
    | InvoiceRow
    | undefined;

  if (!existing) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  // Delete PDF if exists
  if (existing.pdf_path) {
    await deleteInvoicePdf(existing.pdf_path);
  }

  // Delete items
  db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(id);

  // Delete invoice
  db.prepare("DELETE FROM invoices WHERE id = ?").run(id);

  res.json({ success: true, message: `Invoice ${existing.invoice_number} deleted` });
});

/**
 * Mark invoice as sent
 */
router.post("/:id/send", (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as
    | InvoiceRow
    | undefined;

  if (!existing) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  if (existing.status !== "draft") {
    return res.status(400).json({ error: "Can only send draft invoices" });
  }

  db.prepare("UPDATE invoices SET status = 'sent' WHERE id = ?").run(id);

  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
  res.json(invoice);
});

/**
 * Mark invoice as paid
 */
router.post("/:id/pay", (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { payment_date, payment_method } = req.body;

  const existing = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as
    | InvoiceRow
    | undefined;

  if (!existing) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  if (existing.status === "paid") {
    return res.status(400).json({ error: "Invoice is already paid" });
  }

  if (existing.status === "cancelled") {
    return res.status(400).json({ error: "Cannot pay cancelled invoices" });
  }

  db.prepare(
    "UPDATE invoices SET status = 'paid', payment_date = ?, payment_method = ? WHERE id = ?"
  ).run(
    payment_date || new Date().toISOString().split("T")[0],
    payment_method || null,
    id
  );

  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
  res.json(invoice);
});

/**
 * Cancel an invoice
 */
router.post("/:id/cancel", (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as
    | InvoiceRow
    | undefined;

  if (!existing) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  if (existing.status === "paid") {
    return res.status(400).json({ error: "Cannot cancel paid invoices" });
  }

  db.prepare("UPDATE invoices SET status = 'cancelled' WHERE id = ?").run(id);

  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
  res.json(invoice);
});

/**
 * Download invoice PDF
 */
router.get("/:id/pdf", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    console.log("[Invoices] PDF download requested for:", id);

    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as
      | InvoiceRow
      | undefined;

    if (!invoice) {
      console.log("[Invoices] Invoice not found:", id);
      return res.status(404).json({ error: "Invoice not found" });
    }

    console.log("[Invoices] Found invoice:", invoice.invoice_number);

    // Check if PDF exists
    let pdfPath = invoice.pdf_path;

    if (!pdfPath || !invoicePdfExists(pdfPath)) {
      console.log("[Invoices] Generating PDF on the fly...");
      // Generate PDF on the fly
      pdfPath = await generateAndSavePdf(db, id);

      if (!pdfPath) {
        console.error("[Invoices] Failed to generate PDF");
        return res.status(500).json({ error: "Failed to generate PDF" });
      }
      console.log("[Invoices] PDF generated:", pdfPath);
    }

    const fullPath = getInvoicePdfPath(pdfPath);
    console.log("[Invoices] Sending PDF from:", fullPath);

    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${invoice.invoice_number}.pdf"`
    );

    // Send file
    res.sendFile(fullPath, (err) => {
      if (err) {
        console.error("[Invoices] Error sending PDF:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to send PDF" });
        }
      }
    });
  } catch (error) {
    console.error("[Invoices] PDF download error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * Regenerate invoice PDF
 */
router.post("/:id/regenerate-pdf", async (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as
    | InvoiceRow
    | undefined;

  if (!invoice) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  // Delete old PDF if exists
  if (invoice.pdf_path) {
    await deleteInvoicePdf(invoice.pdf_path);
  }

  // Generate new PDF
  const pdfPath = await generateAndSavePdf(db, id);

  if (!pdfPath) {
    return res.status(500).json({ error: "Failed to generate PDF" });
  }

  res.json({ success: true, pdf_path: pdfPath });
});

/**
 * Get seller configuration
 */
router.get("/config/seller", (_req: Request, res: Response) => {
  res.json(getDefaultSeller());
});

export default router;
