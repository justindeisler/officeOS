/**
 * Web-based Project Service using REST API
 */

import { api } from "@/lib/api";
import type { Project, Area } from "@/types";

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

class ProjectService {
  async getAll(): Promise<Project[]> {
    const projects = await api.getProjects();
    return projects.map(p => toCamelCase(p as Record<string, unknown>) as unknown as Project);
  }

  async getById(id: string): Promise<Project | null> {
    try {
      const project = await api.getProject(id);
      return toCamelCase(project as Record<string, unknown>) as unknown as Project;
    } catch {
      return null;
    }
  }

  async getByArea(area: Area): Promise<Project[]> {
    const projects = await api.getProjects({ area });
    return projects.map(p => toCamelCase(p as Record<string, unknown>) as unknown as Project);
  }

  async getByClient(clientId: string): Promise<Project[]> {
    const projects = await api.getProjects({ client_id: clientId });
    return projects.map(p => toCamelCase(p as Record<string, unknown>) as unknown as Project);
  }

  async create(item: Omit<Project, "id" | "createdAt" | "updatedAt">): Promise<Project> {
    const snakeItem = toSnakeCase(item as unknown as Record<string, unknown>);
    const project = await api.createProject(snakeItem);
    return toCamelCase(project as Record<string, unknown>) as unknown as Project;
  }

  async update(id: string, updates: Partial<Project>): Promise<void> {
    const snakeUpdates = toSnakeCase(updates as unknown as Record<string, unknown>);
    await api.updateProject(id, snakeUpdates);
  }

  async delete(id: string): Promise<void> {
    await api.deleteProject(id);
  }
}

export const projectService = new ProjectService();
