/**
 * Web-based Time Entry Service using REST API
 */

import { api } from "@/lib/api";
import type { TimeEntry } from "@/types";

function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

class TimeEntryService {
  async getAll(): Promise<TimeEntry[]> {
    const entries = await api.getTimeEntries();
    return entries.map(e => toCamelCase(e as Record<string, unknown>) as unknown as TimeEntry);
  }

  async getById(id: string): Promise<TimeEntry | null> {
    // API doesn't have single entry endpoint yet, fetch all and filter
    const entries = await this.getAll();
    return entries.find(e => e.id === id) || null;
  }

  async getToday(): Promise<TimeEntry[]> {
    const entries = await api.getTodayTimeEntries();
    return entries.map(e => toCamelCase(e as Record<string, unknown>) as unknown as TimeEntry);
  }

  async getByTask(taskId: string): Promise<TimeEntry[]> {
    const entries = await api.getTimeEntries({ task_id: taskId });
    return entries.map(e => toCamelCase(e as Record<string, unknown>) as unknown as TimeEntry);
  }

  async getByProject(projectId: string): Promise<TimeEntry[]> {
    const entries = await api.getTimeEntries({ project_id: projectId });
    return entries.map(e => toCamelCase(e as Record<string, unknown>) as unknown as TimeEntry);
  }

  async getRunning(): Promise<TimeEntry | null> {
    const entry = await api.getRunningTimer();
    return entry ? toCamelCase(entry as Record<string, unknown>) as unknown as TimeEntry : null;
  }

  async getSummary(startDate: string, endDate: string) {
    return api.getTimeSummary(startDate, endDate);
  }

  async create(item: Omit<TimeEntry, "id" | "createdAt">): Promise<TimeEntry> {
    const snakeItem = toSnakeCase(item as unknown as Record<string, unknown>);
    const entry = await api.logTime(snakeItem);
    return toCamelCase(entry as Record<string, unknown>) as unknown as TimeEntry;
  }

  async startTimer(item: { category: string; taskId?: string; projectId?: string; clientId?: string; description?: string }): Promise<TimeEntry> {
    const snakeItem = toSnakeCase(item as unknown as Record<string, unknown>);
    const entry = await api.startTimer(snakeItem);
    return toCamelCase(entry as Record<string, unknown>) as unknown as TimeEntry;
  }

  async stopTimer(): Promise<TimeEntry> {
    const entry = await api.stopTimer();
    return toCamelCase(entry as Record<string, unknown>) as unknown as TimeEntry;
  }

  async delete(id: string): Promise<void> {
    await api.deleteTimeEntry(id);
  }
}

export const timeEntryService = new TimeEntryService();
