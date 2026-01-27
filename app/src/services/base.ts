import { getDb, generateId, formatDate } from "@/lib/db";

// Map camelCase to snake_case for database columns
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// Map snake_case to camelCase for TypeScript
function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Transform object keys from camelCase to snake_case
export function toDbFormat<T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

// Transform object keys from snake_case to camelCase
export function fromDbFormat<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toCamelCase(key)] = value;
  }
  return result as T;
}

export interface BaseEntity {
  id: string;
  createdAt: string;
}

export abstract class BaseService<T extends BaseEntity> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  async getAll(): Promise<T[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM ${this.tableName}`
    );
    return rows.map((row) => fromDbFormat<T>(row));
  }

  async getById(id: string): Promise<T | null> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return rows[0] ? fromDbFormat<T>(rows[0]) : null;
  }

  async create(item: Omit<T, "id" | "createdAt">): Promise<T> {
    const db = await getDb();
    const id = generateId();
    const createdAt = formatDate(new Date());

    const fullItem = {
      ...item,
      id,
      createdAt,
    } as T;

    const dbItem = toDbFormat(fullItem as unknown as Record<string, unknown>);
    const columns = Object.keys(dbItem);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(dbItem);

    await db.execute(
      `INSERT INTO ${this.tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    return fullItem;
  }

  async update(id: string, updates: Partial<T>): Promise<void> {
    const db = await getDb();
    const dbUpdates = toDbFormat(updates as Record<string, unknown>);

    // Add updated_at if the table has it
    if (!("updatedAt" in updates)) {
      dbUpdates.updated_at = formatDate(new Date());
    }

    const entries = Object.entries(dbUpdates).filter(
      ([, value]) => value !== undefined
    );
    if (entries.length === 0) return;

    const setClause = entries.map(([key]) => `${key} = ?`).join(", ");
    const values = [...entries.map(([, value]) => value), id];

    await db.execute(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`,
      values
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.execute(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  async deleteAll(): Promise<void> {
    const db = await getDb();
    await db.execute(`DELETE FROM ${this.tableName}`);
  }

  async count(): Promise<number> {
    const db = await getDb();
    const result = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM ${this.tableName}`
    );
    return result[0]?.count || 0;
  }
}
