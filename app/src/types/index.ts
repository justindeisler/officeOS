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
export type CaptureType = "task" | "note" | "idea" | "meeting" | "client_request";

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

export type Assignee = "justin" | "james" | null;

export interface Task {
  id: string;
  projectId?: string;
  prdId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  completedAt?: string;
  estimatedMinutes?: number;
  area: Area;
  assignee?: Assignee;
  markdownPath?: string;
  sortOrder: number;
  tags?: Tag[];
  quickCapture?: boolean;
  createdBy?: string;
  aiProcessed?: boolean;
  originalCapture?: string;
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
  pdfPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  amount: number;
}

export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";
export type ProcessedBy = "manual" | "james";
export type ArtifactType = "task" | "calendar_event" | "prd" | "note";

export interface Capture {
  id: string;
  content: string;
  type: CaptureType;
  processed: boolean;
  processedTo?: string;
  processingStatus?: ProcessingStatus;
  processedBy?: ProcessedBy;
  artifactType?: ArtifactType;
  artifactId?: string;
  source?: string;
  metadata?: {
    client_id?: string;
    client_email?: string;
    client_name?: string;
    project_id?: string;
    original_title?: string;
    original_description?: string;
  };
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

export interface BusinessProfile {
  // Personal Info
  fullName: string;
  jobTitle: string;
  email: string;
  phone?: string;

  // Address
  street: string;
  postalCode: string;
  city: string;
  country: string;

  // Tax Information
  vatId?: string; // USt-IdNr
  taxId?: string; // Steuernummer

  // Bank Details
  bankAccountHolder: string;
  bankName: string;
  bankIban: string;
  bankBic: string;
}

export interface Settings {
  workspacePath?: string;
  theme: "light" | "dark" | "system";
  defaultArea: Area;
  defaultCurrency: string;
  userName: string;
  businessProfile?: BusinessProfile;
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

// ============================================
// Second Brain Types
// ============================================

export interface SecondBrainDocument {
  path: string;
  name: string;
  title: string;
  folder: string;
  lastModified: string;
  content?: string;
  size?: number;
  preview?: string;
}

export interface SecondBrainFolder {
  name: string;
  documents: SecondBrainDocument[];
}

// Journal
export interface JournalEntry {
  date: string;
  filename: string;
  title: string;
  preview: string;
  lastModified: string;
  size: number;
  content?: string;
}

// Research
export interface ResearchNote {
  filename: string;
  title: string;
  preview: string;
  date: string;
  lastModified: string;
  size: number;
  tags: string[];
  content?: string;
}

// Agent Memory
export interface AgentMemory {
  id: string;
  name: string;
  filename: string;
  lastModified: string;
  size: number;
  sections: {
    principles: number;
    decisions: number;
    preferences: number;
  };
  content?: string;
  isRootMemory?: boolean;
}

// Conversations
export interface ConversationSession {
  id: string;
  agent: string;
  timestamp: string;
  messageCount: number;
  size: number;
  isLong: boolean;
}

export interface ConversationMessage {
  type: string;
  id: string;
  timestamp: string;
  role?: string;
  text?: string;
  toolName?: string;
}

export interface ConversationTranscript {
  id: string;
  agent: string;
  timestamp: string;
  messages: ConversationMessage[];
  totalLines: number;
  size: number;
}

// Universal Search
export interface BrainSearchResult {
  type: "document" | "agent-memory" | "conversation";
  path: string;
  title: string;
  source: string;
  snippet: string;
  lastModified: string;
  score: number;
}

// ============================================
// Accounting Types (Placeholders)
// ============================================

export interface Asset {
  id: string;
  name: string;
  category: string;
  purchaseDate: string;
  purchasePrice: number;
  usefulLifeYears: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepreciationScheduleEntry {
  year: number;
  depreciation: number;
  bookValue: number;
}

export interface Income {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  createdAt: string;
}

// Subtask for checklist items within a task
export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface SubtaskCounts {
  total: number;
  completed: number;
}

// ============================================
// Agent Space Types
// ============================================

export interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
  role: string;
  color: string;
  status: "active" | "idle";
  sessionCount: number;
  fileCount: number;
  lastActivity: string | null;
}

export interface AgentFileInfo {
  name: string;
  path: string;
  category: "persona" | "learning" | "memory" | "specialist";
  title: string;
  size: number;
  lastModified: string;
  encrypted: boolean;
}

export interface AgentDetail extends AgentInfo {
  files: AgentFileInfo[];
}

export interface AgentFileContent {
  name: string;
  path: string;
  category: string;
  title: string;
  content: string;
  size: number;
  lastModified: string;
  encrypted: boolean;
}

// ============================================
// Brain Activity Types
// ============================================

export interface BrainActivity {
  type: "document" | "agent-memory" | "conversation";
  title: string;
  path: string;
  source: string;
  lastModified: string;
  action: "created" | "modified";
}
