// Task statuses matching Kanban columns
export type TaskStatus = "backlog" | "queue" | "in_progress" | "done";
export type TaskPriority = 1 | 2 | 3; // 1=high, 2=medium, 3=low
export type Area = "wellfy" | "freelance" | "personal";

// Project statuses for pipeline
export type ProjectStatus =
  | "pipeline"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";

// Invoice statuses
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

// Time tracking categories
export type TimeCategory =
  | "coding"
  | "meetings"
  | "admin"
  | "planning"
  | "other";

// Capture types for quick capture
export type CaptureType = "task" | "note" | "idea" | "meeting";

// ============================================
// Core Data Models
// ============================================

export interface Client {
  id: string;
  name: string;
  email?: string;
  company?: string;
  contactInfo?: string;
  notes?: string;
  status: "active" | "inactive" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  clientId?: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  budgetAmount?: number;
  budgetCurrency: string;
  startDate?: string;
  targetEndDate?: string;
  actualEndDate?: string;
  area: Area;
  markdownPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  completedAt?: string;
  estimatedMinutes?: number;
  area: Area;
  markdownPath?: string;
  sortOrder: number;
  tags?: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface TimeEntry {
  id: string;
  taskId?: string;
  projectId?: string;
  clientId?: string;
  category: TimeCategory;
  description?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  isRunning: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  projectId?: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  notes?: string;
  lineItems: InvoiceLineItem[];
  markdownPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Capture {
  id: string;
  content: string;
  type: CaptureType;
  processed: boolean;
  processedTo?: string;
  createdAt: string;
}

export interface WeeklyReview {
  id: string;
  weekStart: string;
  accomplishments: string[];
  challenges?: string;
  learnings?: string;
  nextWeekFocus: string[];
  energyLevel?: string;
  stressLevel?: string;
  notes?: string;
  metrics?: WeeklyMetrics;
  markdownPath?: string;
  createdAt: string;
}

export interface WeeklyMetrics {
  tasksCompleted: number;
  hoursTracked: number;
  revenue: number;
}

export interface Settings {
  workspacePath?: string;
  theme: "light" | "dark" | "system";
  defaultArea: Area;
  defaultCurrency: string;
  userName: string;
}

// ============================================
// UI Types
// ============================================

export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  tasks: Task[];
}

export interface DashboardStats {
  tasksToday: number;
  timeTrackedToday: number; // minutes
  activeProjects: number;
  revenueMTD: number;
}
