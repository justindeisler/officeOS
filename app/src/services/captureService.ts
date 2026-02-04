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
    return rows.map((row) => {
      const capture = {
        ...fromDbFormat<Capture>(row),
        processed: Boolean(row.processed),
      };
      // Parse metadata JSON if present
      if (row.metadata && typeof row.metadata === 'string') {
        try {
          capture.metadata = JSON.parse(row.metadata);
        } catch (e) {
          console.warn('Failed to parse capture metadata:', e);
        }
      }
      return capture;
    });
  }

  async getUnprocessed(): Promise<Capture[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM captures WHERE processed = 0 ORDER BY created_at DESC"
    );
    return rows.map((row) => {
      const capture = {
        ...fromDbFormat<Capture>(row),
        processed: false,
      };
      // Parse metadata JSON if present
      if (row.metadata && typeof row.metadata === 'string') {
        try {
          capture.metadata = JSON.parse(row.metadata);
        } catch (e) {
          console.warn('Failed to parse capture metadata:', e);
        }
      }
      return capture;
    });
  }

  async getByType(type: CaptureType): Promise<Capture[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM captures WHERE type = ? ORDER BY created_at DESC",
      [type]
    );
    return rows.map((row) => {
      const capture = {
        ...fromDbFormat<Capture>(row),
        processed: Boolean(row.processed),
      };
      // Parse metadata JSON if present
      if (row.metadata && typeof row.metadata === 'string') {
        try {
          capture.metadata = JSON.parse(row.metadata);
        } catch (e) {
          console.warn('Failed to parse capture metadata:', e);
        }
      }
      return capture;
    });
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

  async processWithJames(_id: string): Promise<{ status: string; message: string; captureId: string }> {
    // Tauri app doesn't support James processing yet
    throw new Error("James processing is not available in the desktop app");
  }

  async getProcessingStatus(captureId: string): Promise<{
    captureId: string;
    processingStatus: string;
    processedBy?: string;
    artifactType?: string;
    artifactId?: string;
    processed: boolean;
  }> {
    // Tauri app doesn't track processing status yet
    const capture = await this.getById(captureId);
    if (!capture) {
      throw new Error(`Capture ${captureId} not found`);
    }
    return {
      captureId,
      processingStatus: capture.processed ? "completed" : "pending",
      processed: capture.processed,
    };
  }
}

export const captureService = new CaptureService();
