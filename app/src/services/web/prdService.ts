/**
 * Web-based PRD Service using REST API
 * PRDs are stored in the backend database
 *
 * Uses the centralized admin HTTP client for auth and error handling.
 */

import { adminClient, ApiError } from "@/api";
import type { PRD } from "@/types/prd";

class PRDService {
  async getAll(): Promise<PRD[]> {
    return adminClient.get<PRD[]>("/prds");
  }

  async getById(id: string): Promise<PRD | null> {
    try {
      return await adminClient.get<PRD>(`/prds/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound) {
        return null;
      }
      throw error;
    }
  }

  async getByProject(projectId: string): Promise<PRD[]> {
    return adminClient.get<PRD[]>(`/prds?projectId=${projectId}`);
  }

  async create(item: Omit<PRD, "id" | "createdAt" | "updatedAt">): Promise<PRD> {
    return adminClient.post<PRD>("/prds", item);
  }

  async update(id: string, updates: Partial<PRD>): Promise<PRD | null> {
    try {
      return await adminClient.put<PRD>(`/prds/${id}`, updates);
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound) {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await adminClient.delete(`/prds/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.isNotFound) {
        return; // Already deleted, no-op
      }
      throw error;
    }
  }
}

export const prdService = new PRDService();
