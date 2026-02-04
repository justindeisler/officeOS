/**
 * Web-based PRD Service using REST API
 * PRDs are stored in the backend database
 */

import type { PRD } from "@/types/prd";

const API_BASE = import.meta.env.VITE_API_URL || '';

// Get auth token from localStorage (zustand persist)
function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem('pa-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.token || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

class PRDService {
  async getAll(): Promise<PRD[]> {
    const response = await fetch(`${API_BASE}/prds`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch PRDs");
    }
    return response.json();
  }

  async getById(id: string): Promise<PRD | null> {
    const response = await fetch(`${API_BASE}/prds/${id}`, {
      headers: getAuthHeaders(),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("Failed to fetch PRD");
    }
    return response.json();
  }

  async getByProject(projectId: string): Promise<PRD[]> {
    const response = await fetch(`${API_BASE}/prds?projectId=${projectId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch PRDs");
    }
    return response.json();
  }

  async create(item: Omit<PRD, "id" | "createdAt" | "updatedAt">): Promise<PRD> {
    const response = await fetch(`${API_BASE}/prds`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      throw new Error("Failed to create PRD");
    }
    return response.json();
  }

  async update(id: string, updates: Partial<PRD>): Promise<PRD | null> {
    const response = await fetch(`${API_BASE}/prds/${id}`, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error("Failed to update PRD");
    }
    return response.json();
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/prds/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error("Failed to delete PRD");
    }
  }
}

export const prdService = new PRDService();
