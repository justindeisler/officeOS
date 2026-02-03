import { BaseService, fromDbFormat, toDbFormat } from "./base";
import { getDb, generateId, formatDate } from "@/lib/db";
import type { TimeEntry } from "@/types";

class TimeEntryService extends BaseService<TimeEntry> {
  constructor() {
    super("time_entries");
  }

  async getAll(): Promise<TimeEntry[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM time_entries ORDER BY start_time DESC"
    );
    return rows.map((row) => ({
      ...fromDbFormat<TimeEntry>(row),
      isRunning: Boolean(row.is_running),
    }));
  }

  async getRunning(): Promise<TimeEntry | null> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM time_entries WHERE is_running = 1 LIMIT 1"
    );
    if (!rows[0]) return null;
    return {
      ...fromDbFormat<TimeEntry>(rows[0]),
      isRunning: true,
    };
  }

  async getByDateRange(startDate: string, endDate: string): Promise<TimeEntry[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM time_entries
       WHERE start_time >= ? AND start_time <= ?
       ORDER BY start_time DESC`,
      [startDate, endDate]
    );
    return rows.map((row) => ({
      ...fromDbFormat<TimeEntry>(row),
      isRunning: Boolean(row.is_running),
    }));
  }

  async getByProject(projectId: string): Promise<TimeEntry[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM time_entries WHERE project_id = ? ORDER BY start_time DESC",
      [projectId]
    );
    return rows.map((row) => ({
      ...fromDbFormat<TimeEntry>(row),
      isRunning: Boolean(row.is_running),
    }));
  }

  async getByTask(taskId: string): Promise<TimeEntry[]> {
    const db = await getDb();
    const rows = await db.select<Record<string, unknown>[]>(
      "SELECT * FROM time_entries WHERE task_id = ? ORDER BY start_time DESC",
      [taskId]
    );
    return rows.map((row) => ({
      ...fromDbFormat<TimeEntry>(row),
      isRunning: Boolean(row.is_running),
    }));
  }

  async startTimer(
    entry: Omit<TimeEntry, "id" | "createdAt" | "endTime" | "durationMinutes" | "isRunning">
  ): Promise<TimeEntry> {
    // Stop any running timer first
    await this.stopRunningTimer();

    const db = await getDb();
    const id = generateId();
    const createdAt = formatDate(new Date());

    const fullEntry: TimeEntry = {
      ...entry,
      id,
      isRunning: true,
      createdAt,
    };

    const dbEntry = toDbFormat(fullEntry as unknown as Record<string, unknown>);
    // Convert boolean to integer for SQLite
    dbEntry.is_running = 1;

    const columns = Object.keys(dbEntry);
    const placeholders = columns.map(() => "?").join(", ");
    const values = Object.values(dbEntry);

    await db.execute(
      `INSERT INTO time_entries (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    return fullEntry;
  }

  async stopTimer(id: string): Promise<TimeEntry | null> {
    const db = await getDb();
    const entry = await this.getById(id);
    if (!entry || !entry.isRunning) return null;

    const endTime = formatDate(new Date());
    const durationMinutes = Math.round(
      (new Date(endTime).getTime() - new Date(entry.startTime).getTime()) / 60000
    );

    await db.execute(
      `UPDATE time_entries SET end_time = ?, duration_minutes = ?, is_running = 0 WHERE id = ?`,
      [endTime, durationMinutes, id]
    );

    return {
      ...entry,
      endTime,
      durationMinutes,
      isRunning: false,
    };
  }

  async stopRunningTimer(): Promise<TimeEntry | null> {
    const running = await this.getRunning();
    if (!running) return null;
    return this.stopTimer(running.id);
  }

  async getTotalMinutesToday(): Promise<number> {
    const db = await getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = formatDate(today);

    const result = await db.select<{ total: number | null }[]>(
      `SELECT SUM(duration_minutes) as total FROM time_entries
       WHERE start_time >= ? AND is_running = 0`,
      [startOfDay]
    );

    return result[0]?.total || 0;
  }

  async update(id: string, updates: Partial<TimeEntry>): Promise<void> {
    const db = await getDb();
    const dbUpdates = toDbFormat(updates as Record<string, unknown>);
    
    // Handle isRunning boolean conversion for SQLite
    if ('isRunning' in updates) {
      dbUpdates.is_running = updates.isRunning ? 1 : 0;
      delete dbUpdates.isRunning;
    }
    
    // Build SET clause dynamically
    const setClauses = Object.keys(dbUpdates).map(key => `${key} = ?`).join(", ");
    const values = [...Object.values(dbUpdates), id];

    await db.execute(
      `UPDATE time_entries SET ${setClauses} WHERE id = ?`,
      values
    );
  }
}

export const timeEntryService = new TimeEntryService();
