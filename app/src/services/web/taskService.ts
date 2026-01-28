/**
 * Web-based Task Service using REST API
 */

import { api } from "@/lib/api";
import type { Task, TaskStatus, Area } from "@/types";

// Transform snake_case to camelCase
function toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// Transform camelCase to snake_case
function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

class TaskService {
  async getAll(): Promise<Task[]> {
    const tasks = await api.getTasks();
    return tasks.map(t => toCamelCase(t as Record<string, unknown>) as unknown as Task);
  }

  async getById(id: string): Promise<Task | null> {
    try {
      const task = await api.getTask(id);
      return toCamelCase(task as Record<string, unknown>) as unknown as Task;
    } catch {
      return null;
    }
  }

  async getByStatus(status: TaskStatus): Promise<Task[]> {
    const tasks = await api.getTasks({ status });
    return tasks.map(t => toCamelCase(t as Record<string, unknown>) as unknown as Task);
  }

  async getByArea(area: Area): Promise<Task[]> {
    const tasks = await api.getTasks({ area });
    return tasks.map(t => toCamelCase(t as Record<string, unknown>) as unknown as Task);
  }

  async getByProject(projectId: string): Promise<Task[]> {
    const tasks = await api.getTasks({ project_id: projectId });
    return tasks.map(t => toCamelCase(t as Record<string, unknown>) as unknown as Task);
  }

  async create(item: Omit<Task, "id" | "createdAt" | "updatedAt" | "sortOrder">): Promise<Task> {
    const snakeItem = toSnakeCase(item as unknown as Record<string, unknown>);
    const task = await api.createTask(snakeItem);
    return toCamelCase(task as Record<string, unknown>) as unknown as Task;
  }

  async update(id: string, updates: Partial<Task>): Promise<void> {
    const snakeUpdates = toSnakeCase(updates as unknown as Record<string, unknown>);
    await api.updateTask(id, snakeUpdates);
  }

  async delete(id: string): Promise<void> {
    await api.deleteTask(id);
  }

  async moveTask(taskId: string, newStatus: TaskStatus, _newIndex: number): Promise<void> {
    // Web API simplified - just moves status, doesn't handle complex reordering yet
    await api.moveTask(taskId, newStatus);
  }

  async reorderTasks(_taskIds: string[], _status: TaskStatus): Promise<void> {
    // TODO: Implement reorder endpoint in API
    console.warn("Task reordering not yet implemented in web API");
  }

  async getOverdueTasks(): Promise<Task[]> {
    const tasks = await api.getOverdueTasks();
    return tasks.map(t => toCamelCase(t as Record<string, unknown>) as unknown as Task);
  }
}

export const taskService = new TaskService();
