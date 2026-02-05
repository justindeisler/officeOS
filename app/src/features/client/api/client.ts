/**
 * Client Portal API
 *
 * Uses the centralized client portal HTTP client for auth and error handling.
 */

import { clientPortalClient, getClientToken } from '@/api';

export interface ClientInfo {
  id: string;
  name: string;
  email: string;
  company?: string;
  assignedProjects: string[];
}

export interface LoginResponse {
  token: string;
  client: ClientInfo;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  in_progress_count: number;
  backlog_count: number;
  done_count: number;
  last_update?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'in_progress' | 'done';
  priority: number;
  created_by?: string;
  quick_capture?: boolean;
  ai_processed?: boolean;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface KanbanData {
  tasks: Task[];
  kanban: {
    backlog: Task[];
    queue: Task[];
    in_progress: Task[];
    done: Task[];
  };
}

export async function clientLogin(email: string, password: string): Promise<LoginResponse> {
  const data = await clientPortalClient.post<LoginResponse>(
    '/api/auth/client/login',
    { email, password },
  );
  // Store token
  localStorage.setItem('client-auth', JSON.stringify({ token: data.token, client: data.client }));
  return data;
}

export async function getClientInfo(): Promise<ClientInfo> {
  return clientPortalClient.get<ClientInfo>('/api/auth/client/me');
}

export async function getDashboard(): Promise<{ projects: ProjectSummary[] }> {
  return clientPortalClient.get<{ projects: ProjectSummary[] }>('/api/client/dashboard');
}

export async function getProjectTasks(projectId: string): Promise<KanbanData> {
  return clientPortalClient.get<KanbanData>(`/api/client/projects/${projectId}/tasks`);
}

export async function getTask(taskId: string): Promise<Task> {
  return clientPortalClient.get<Task>(`/api/client/tasks/${taskId}`);
}

export async function createTask(
  projectId: string,
  title: string,
  description?: string,
  quickCapture = false,
  originalCapture?: string
): Promise<Task> {
  return clientPortalClient.post<Task>('/api/client/tasks', {
    project_id: projectId,
    title,
    description,
    quick_capture: quickCapture,
    original_capture: originalCapture,
  });
}

export async function updateTask(
  taskId: string,
  updates: { title?: string; description?: string }
): Promise<Task> {
  return clientPortalClient.patch<Task>(`/api/client/tasks/${taskId}`, updates);
}

export interface PendingRequest {
  id: string;
  content: string;
  created_at: string;
  metadata: {
    original_title: string;
    original_description?: string;
    project_id: string;
  } | null;
}

export async function getPendingRequests(): Promise<{ requests: PendingRequest[] }> {
  return clientPortalClient.get<{ requests: PendingRequest[] }>('/api/client/pending-requests');
}

export function clientLogout() {
  localStorage.removeItem('client-auth');
}

export function isClientAuthenticated(): boolean {
  return getClientToken() !== null;
}
