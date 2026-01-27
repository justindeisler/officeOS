import { BaseService, fromDbFormat, toDbFormat } from "./base";
import { getDb, generateId, formatDate } from "@/lib/db";
import type { Client } from "@/types";

class ClientService extends BaseService<Client> {
  constructor() {
    super("clients");
  }

  // Override create to handle updatedAt field
  async create(
    item: Omit<Client, "id" | "createdAt" | "updatedAt">
  ): Promise<Client> {
    const db = await getDb();
    const id = generateId();
    const now = formatDate(new Date());

    const fullItem: Client = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const dbItem = toDbFormat(fullItem as unknown as Record<string, unknown>);
    const columns = Object.keys(dbItem);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(dbItem);

    await db.execute(
      `INSERT INTO clients (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    return fullItem;
  }

  async getActive(): Promise<Client[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM clients WHERE status = 'active' ORDER BY name"
    );
    return rows.map((row) => fromDbFormat<Client>(row));
  }

  async getByStatus(status: Client["status"]): Promise<Client[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM clients WHERE status = ? ORDER BY name",
      [status]
    );
    return rows.map((row) => fromDbFormat<Client>(row));
  }

  async search(query: string): Promise<Client[]> {
    const db = await getDb();
    const searchTerm = `%${query}%`;
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM clients
       WHERE name LIKE ? OR email LIKE ? OR company LIKE ?
       ORDER BY name`,
      [searchTerm, searchTerm, searchTerm]
    );
    return rows.map((row) => fromDbFormat<Client>(row));
  }
}

export const clientService = new ClientService();
