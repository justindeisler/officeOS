import { BaseService, fromDbFormat, toDbFormat } from "./base";
import { getDb, generateId, formatDate } from "@/lib/db";
import type { Capture, CaptureType } from "@/types";

class CaptureService extends BaseService<Capture> {
  constructor() {
    super("captures");
  }

  async getAll(): Promise<Capture[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM captures ORDER BY created_at DESC"
    );
    return rows.map((row) => ({
      ...fromDbFormat<Capture>(row),
      processed: Boolean(row.processed),
    }));
  }

  async getUnprocessed(): Promise<Capture[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM captures WHERE processed = 0 ORDER BY created_at DESC"
    );
    return rows.map((row) => ({
      ...fromDbFormat<Capture>(row),
      processed: false,
    }));
  }

  async getByType(type: CaptureType): Promise<Capture[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM captures WHERE type = ? ORDER BY created_at DESC",
      [type]
    );
    return rows.map((row) => ({
      ...fromDbFormat<Capture>(row),
      processed: Boolean(row.processed),
    }));
  }

  async create(
    item: Omit<Capture, "id" | "createdAt" | "processed">
  ): Promise<Capture> {
    const db = await getDb();
    const id = generateId();
    const createdAt = formatDate(new Date());

    const fullCapture: Capture = {
      ...item,
      id,
      processed: false,
      createdAt,
    };

    const dbCapture = toDbFormat(
      fullCapture as unknown as Record<string, unknown>
    );
    // Convert boolean to integer for SQLite
    dbCapture.processed = 0;

    const columns = Object.keys(dbCapture);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(dbCapture);

    await db.execute(
      `INSERT INTO captures (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    return fullCapture;
  }

  async markProcessed(id: string, processedTo?: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "UPDATE captures SET processed = 1, processed_to = ? WHERE id = ?",
      [processedTo || null, id]
    );
  }

  async getUnprocessedCount(): Promise<number> {
    const db = await getDb();
    const result = await db.select<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM captures WHERE processed = 0"
    );
    return result[0]?.count || 0;
  }
}

export const captureService = new CaptureService();
