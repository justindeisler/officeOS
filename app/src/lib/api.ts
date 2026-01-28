/**
 * REST API client for web builds
 * Mirrors the database interface but uses fetch
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const token = getAuthToken();
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Tasks
  async getTasks(filters?: { area?: string; status?: string; project_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.area) params.set('area', filters.area);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.project_id) params.set('project_id', filters.project_id);
    const query = params.toString();
    return this.request<unknown[]>(`/tasks${query ? `?${query}` : ''}`);
  }

  async getTask(id: string) {
    return this.request<unknown>(`/tasks/${id}`);
  }

  async createTask(task: Record<string, unknown>) {
    return this.request<unknown>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(id: string, updates: Record<string, unknown>) {
    return this.request<unknown>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async moveTask(id: string, status: string) {
    return this.request<unknown>(`/tasks/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async deleteTask(id: string) {
    return this.request<unknown>(`/tasks/${id}`, { method: 'DELETE' });
  }

  async getOverdueTasks() {
    return this.request<unknown[]>('/tasks/overdue');
  }

  // Projects
  async getProjects(filters?: { area?: string; status?: string; client_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.area) params.set('area', filters.area);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.client_id) params.set('client_id', filters.client_id);
    const query = params.toString();
    return this.request<unknown[]>(`/projects${query ? `?${query}` : ''}`);
  }

  async getProject(id: string) {
    return this.request<unknown>(`/projects/${id}`);
  }

  async createProject(project: Record<string, unknown>) {
    return this.request<unknown>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(id: string, updates: Record<string, unknown>) {
    return this.request<unknown>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteProject(id: string) {
    return this.request<unknown>(`/projects/${id}`, { method: 'DELETE' });
  }

  // Clients
  async getClients(filters?: { status?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    return this.request<unknown[]>(`/clients${query ? `?${query}` : ''}`);
  }

  async getClient(id: string) {
    return this.request<unknown>(`/clients/${id}`);
  }

  async createClient(client: Record<string, unknown>) {
    return this.request<unknown>('/clients', {
      method: 'POST',
      body: JSON.stringify(client),
    });
  }

  async updateClient(id: string, updates: Record<string, unknown>) {
    return this.request<unknown>(`/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteClient(id: string) {
    return this.request<unknown>(`/clients/${id}`, { method: 'DELETE' });
  }

  // Time Tracking
  async getTimeEntries(filters?: { task_id?: string; project_id?: string; client_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.task_id) params.set('task_id', filters.task_id);
    if (filters?.project_id) params.set('project_id', filters.project_id);
    if (filters?.client_id) params.set('client_id', filters.client_id);
    const query = params.toString();
    return this.request<unknown[]>(`/time${query ? `?${query}` : ''}`);
  }

  async getTodayTimeEntries() {
    return this.request<unknown[]>('/time/today');
  }

  async getRunningTimer() {
    return this.request<unknown | null>('/time/running');
  }

  async getTimeSummary(startDate: string, endDate: string) {
    return this.request<unknown[]>(`/time/summary?start_date=${startDate}&end_date=${endDate}`);
  }

  async logTime(entry: Record<string, unknown>) {
    return this.request<unknown>('/time/log', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async startTimer(entry: Record<string, unknown>) {
    return this.request<unknown>('/time/start', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async stopTimer() {
    return this.request<unknown>('/time/stop', { method: 'POST' });
  }

  async deleteTimeEntry(id: string) {
    return this.request<unknown>(`/time/${id}`, { method: 'DELETE' });
  }

  // Captures
  async getCaptures(filters?: { processed?: boolean; type?: string }) {
    const params = new URLSearchParams();
    if (filters?.processed !== undefined) params.set('processed', String(filters.processed));
    if (filters?.type) params.set('type', filters.type);
    const query = params.toString();
    return this.request<unknown[]>(`/captures${query ? `?${query}` : ''}`);
  }

  async createCapture(capture: Record<string, unknown>) {
    return this.request<unknown>('/captures', {
      method: 'POST',
      body: JSON.stringify(capture),
    });
  }

  async processCapture(id: string, processedTo?: string) {
    return this.request<unknown>(`/captures/${id}/process`, {
      method: 'POST',
      body: JSON.stringify({ processed_to: processedTo }),
    });
  }

  async deleteCapture(id: string) {
    return this.request<unknown>(`/captures/${id}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();

// Helper to check if we're in a web environment (not Tauri)
export function isWebBuild(): boolean {
  return typeof window !== 'undefined' && !('__TAURI__' in window);
}
