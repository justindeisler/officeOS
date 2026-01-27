/**
 * Time tracking tools for MCP server
 */

import { getDb, generateId, getCurrentTimestamp } from "../database.js";

export interface TimeEntry {
  id: string;
  task_id: string | null;
  project_id: string | null;
  client_id: string | null;
  category: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  is_running: number;
  created_at: string;
}

export interface LogTimeParams {
  task_id?: string;
  project_id?: string;
  client_id?: string;
  category: string;
  description?: string;
  duration_minutes: number;
  start_time?: string;
}

export interface StartTimerParams {
  task_id?: string;
  project_id?: string;
  client_id?: string;
  category: string;
  description?: string;
}

/**
 * Log a time entry (for past work)
 */
export function logTime(params: LogTimeParams): TimeEntry {
  const db = getDb();
  const now = getCurrentTimestamp();

  const startTime = params.start_time || now;
  const endTime = new Date(
    new Date(startTime).getTime() + params.duration_minutes * 60 * 1000
  ).toISOString();

  const entry: TimeEntry = {
    id: generateId(),
    task_id: params.task_id || null,
    project_id: params.project_id || null,
    client_id: params.client_id || null,
    category: params.category,
    description: params.description || null,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: params.duration_minutes,
    is_running: 0,
    created_at: now,
  };

  const stmt = db.prepare(`
    INSERT INTO time_entries (
      id, task_id, project_id, client_id, category, description,
      start_time, end_time, duration_minutes, is_running, created_at
    ) VALUES (
      @id, @task_id, @project_id, @client_id, @category, @description,
      @start_time, @end_time, @duration_minutes, @is_running, @created_at
    )
  `);

  stmt.run(entry);

  return entry;
}

/**
 * Start a new timer
 */
export function startTimer(params: StartTimerParams): TimeEntry {
  const db = getDb();
  const now = getCurrentTimestamp();

  // Check for existing running timer
  const running = db
    .prepare("SELECT * FROM time_entries WHERE is_running = 1")
    .get() as TimeEntry | undefined;

  if (running) {
    throw new Error(
      `A timer is already running for "${running.category}". Stop it first.`
    );
  }

  const entry: TimeEntry = {
    id: generateId(),
    task_id: params.task_id || null,
    project_id: params.project_id || null,
    client_id: params.client_id || null,
    category: params.category,
    description: params.description || null,
    start_time: now,
    end_time: null,
    duration_minutes: null,
    is_running: 1,
    created_at: now,
  };

  const stmt = db.prepare(`
    INSERT INTO time_entries (
      id, task_id, project_id, client_id, category, description,
      start_time, end_time, duration_minutes, is_running, created_at
    ) VALUES (
      @id, @task_id, @project_id, @client_id, @category, @description,
      @start_time, @end_time, @duration_minutes, @is_running, @created_at
    )
  `);

  stmt.run(entry);

  return entry;
}

/**
 * Stop the currently running timer
 */
export function stopTimer(): TimeEntry {
  const db = getDb();
  const now = getCurrentTimestamp();

  const running = db
    .prepare("SELECT * FROM time_entries WHERE is_running = 1")
    .get() as TimeEntry | undefined;

  if (!running) {
    throw new Error("No timer is currently running");
  }

  const startTime = new Date(running.start_time);
  const endTime = new Date(now);
  const durationMinutes = Math.round(
    (endTime.getTime() - startTime.getTime()) / 60000
  );

  db.prepare(
    `UPDATE time_entries
     SET end_time = @end_time, duration_minutes = @duration_minutes, is_running = 0
     WHERE id = @id`
  ).run({
    id: running.id,
    end_time: now,
    duration_minutes: durationMinutes,
  });

  return db
    .prepare("SELECT * FROM time_entries WHERE id = ?")
    .get(running.id) as TimeEntry;
}

/**
 * Get the currently running timer
 */
export function getRunningTimer(): TimeEntry | null {
  const db = getDb();
  return (
    (db
      .prepare("SELECT * FROM time_entries WHERE is_running = 1")
      .get() as TimeEntry) || null
  );
}

/**
 * Get time entries for today
 */
export function getTodayTimeEntries(): TimeEntry[] {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];

  return db
    .prepare(
      `SELECT * FROM time_entries
       WHERE date(start_time) = @today
       ORDER BY start_time DESC`
    )
    .all({ today }) as TimeEntry[];
}

/**
 * Get time summary for a date range
 */
export function getTimeSummary(
  startDate: string,
  endDate: string
): { category: string; total_minutes: number }[] {
  const db = getDb();

  return db
    .prepare(
      `SELECT category, SUM(duration_minutes) as total_minutes
       FROM time_entries
       WHERE date(start_time) >= @startDate
       AND date(start_time) <= @endDate
       AND is_running = 0
       GROUP BY category
       ORDER BY total_minutes DESC`
    )
    .all({ startDate, endDate }) as { category: string; total_minutes: number }[];
}
