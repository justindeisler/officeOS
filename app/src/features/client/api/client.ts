const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3005';

function getClientToken(): string | null {
  const stored = localStorage.getItem('client-auth');
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return parsed.token;
  } catch {
    return null;
  }
}

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
    in_progress: Task[];
    done: Task[];
  };
}

export async function clientLogin(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/client/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  const data = await response.json();
  // Store token
  localStorage.setItem('client-auth', JSON.stringify({ token: data.token, client: data.client }));
  return data;
}

export async function getClientInfo(): Promise<ClientInfo> {
  const token = getClientToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/auth/client/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Failed to get client info');
  }

  return response.json();
}

export async function getDashboard(): Promise<{ projects: ProjectSummary[] }> {
  const token = getClientToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/client/dashboard`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Failed to get dashboard');
  }

  return response.json();
}

export async function getProjectTasks(projectId: string): Promise<KanbanData> {
  const token = getClientToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/client/projects/${projectId}/tasks`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Failed to get tasks');
  }

  return response.json();
}

export async function getTask(taskId: string): Promise<Task> {
  const token = getClientToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/client/tasks/${taskId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Failed to get task');
  }

  return response.json();
}

export async function createTask(
  projectId: string,
  title: string,
  description?: string,
  quickCapture = false,
  originalCapture?: string
): Promise<Task> {
  const token = getClientToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/client/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      project_id: projectId,
      title,
      description,
      quick_capture: quickCapture,
      original_capture: originalCapture
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create task');
  }

  return response.json();
}

export async function updateTask(
  taskId: string,
  updates: { title?: string; description?: string }
): Promise<Task> {
  const token = getClientToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_URL}/api/client/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update task');
  }

  return response.json();
}

export function clientLogout() {
  localStorage.removeItem('client-auth');
}

export function isClientAuthenticated(): boolean {
  return getClientToken() !== null;
}
