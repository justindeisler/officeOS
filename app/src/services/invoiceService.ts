import { BaseService, fromDbFormat, toDbFormat } from "./base";
import { getDb, generateId, formatDate } from "@/lib/db";
import type { Invoice, InvoiceStatus } from "@/types";

// Helper to transform invoice from DB format (deserialize lineItems)
function fromDbInvoice(row: Record<string, unknown>): Invoice {
  const invoice = fromDbFormat<Invoice>(row);
  // Parse line_items JSON
  if (typeof row.line_items === "string") {
    invoice.lineItems = JSON.parse(row.line_items || "[]");
  } else {
    invoice.lineItems = [];
  }
  return invoice;
}

class InvoiceService extends BaseService<Invoice> {
  constructor() {
    super("invoices");
  }

  async getAll(): Promise<Invoice[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM invoices ORDER BY created_at DESC"
    );
    return rows.map(fromDbInvoice);
  }

  async getById(id: string): Promise<Invoice | null> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM invoices WHERE id = ?",
      [id]
    );
    return rows[0] ? fromDbInvoice(rows[0]) : null;
  }

  async getByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM invoices WHERE status = ? ORDER BY created_at DESC",
      [status]
    );
    return rows.map(fromDbInvoice);
  }

  async getByClient(clientId: string): Promise<Invoice[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM invoices WHERE client_id = ? ORDER BY created_at DESC",
      [clientId]
    );
    return rows.map(fromDbInvoice);
  }

  async getOverdue(): Promise<Invoice[]> {
    const db = await getDb();
    const today = formatDate(new Date()).split("T")[0];
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM invoices
       WHERE status = 'sent' AND due_date < ?
       ORDER BY due_date ASC`,
      [today]
    );
    return rows.map(fromDbInvoice);
  }

  async create(
    item: Omit<Invoice, "id" | "createdAt" | "updatedAt">
  ): Promise<Invoice> {
    const db = await getDb();
    const id = generateId();
    const now = formatDate(new Date());

    const fullInvoice: Invoice = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Serialize lineItems to JSON
    const dbInvoice = toDbFormat(
      fullInvoice as unknown as Record<string, unknown>
    );
    dbInvoice.line_items = JSON.stringify(item.lineItems || []);

    const columns = Object.keys(dbInvoice);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(dbInvoice);

    await db.execute(
      `INSERT INTO invoices (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    return fullInvoice;
  }

  async update(id: string, updates: Partial<Invoice>): Promise<void> {
    const db = await getDb();
    const dbUpdates: Record<string, unknown> = {};

    // Convert camelCase to snake_case and handle lineItems
    for (const [key, value] of Object.entries(updates)) {
      if (key === "lineItems") {
        dbUpdates.line_items = JSON.stringify(value);
      } else {
        const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
        dbUpdates[snakeKey] = value;
      }
    }

    dbUpdates.updated_at = formatDate(new Date());

    const entries = Object.entries(dbUpdates).filter(
      ([, value]) => value !== undefined
    );
    if (entries.length === 0) return;

    const setClause = entries.map(([key]) => `${key} = ?`).join(", ");
    const values = [...entries.map(([, value]) => value), id];

    await db.execute(
      `UPDATE invoices SET ${setClause} WHERE id = ?`,
      values
    );
  }

  async markAsPaid(id: string, paidDate?: string): Promise<void> {
    const db = await getDb();
    const date = paidDate || formatDate(new Date()).split("T")[0];
    await db.execute(
      `UPDATE invoices SET status = 'paid', paid_date = ?, updated_at = ? WHERE id = ?`,
      [date, formatDate(new Date()), id]
    );
  }

  async getNextInvoiceNumber(): Promise<string> {
    const db = await getDb();
    const year = new Date().getFullYear();
    const result = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE ?`,
      [`${year}-%`]
    );
    const count = (result[0]?.count || 0) + 1;
    return `${year}-${String(count).padStart(4, "0")}`;
  }

  async getRevenueByDateRange(
    startDate: string,
    endDate: string
  ): Promise<number> {
    const db = await getDb();
    const result = await db.select<{ total: number | null }[]>(
      `SELECT SUM(total_amount) as total FROM invoices
       WHERE status = 'paid' AND paid_date >= ? AND paid_date <= ?`,
      [startDate, endDate]
    );
    return result[0]?.total || 0;
  }
}

export const invoiceService = new InvoiceService();
