/**
 * Zod validation schemas for all API mutation endpoints.
 *
 * Conventions:
 * - `.strip()` on create/update schemas to silently drop unknown fields
 * - `.optional()` for fields that are nullable in the DB or have defaults
 * - `.coerce` for numeric fields that may arrive as strings
 */

import { z } from 'zod';

// ============================================================================
// Shared / Reusable
// ============================================================================

/** ISO date string (YYYY-MM-DD) */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Must be a valid date (YYYY-MM-DD)');

/** ISO datetime string */
const isoDateTime = z.string().min(1);

// ============================================================================
// Auth
// ============================================================================

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
}).strip();

export type Login = z.infer<typeof LoginSchema>;

export const ClientLoginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
}).strip();

export type ClientLogin = z.infer<typeof ClientLoginSchema>;

// ============================================================================
// Tasks
// ============================================================================

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  area: z.string().optional().default('freelance'),
  priority: z.coerce.number().int().min(1).max(4).optional().default(2),
  status: z.string().optional().default('backlog'),
  description: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  prd_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  estimated_minutes: z.coerce.number().nullable().optional(),
  assignee: z.string().nullable().optional(),
}).strip();

export type CreateTask = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  area: z.string().optional(),
  priority: z.coerce.number().int().min(1).max(4).optional(),
  status: z.string().optional(),
  description: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  prd_id: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  estimated_minutes: z.coerce.number().nullable().optional(),
  assignee: z.string().nullable().optional(),
}).strip();

export type UpdateTask = z.infer<typeof UpdateTaskSchema>;

export const ReorderTasksSchema = z.object({
  taskIds: z.array(z.string()).min(1, 'taskIds array is required'),
  status: z.string().optional(),
}).strip();

export type ReorderTasks = z.infer<typeof ReorderTasksSchema>;

export const MoveTaskSchema = z.object({
  status: z.enum(['backlog', 'queue', 'in_progress', 'done']),
  targetIndex: z.coerce.number().int().min(0).nullable().optional(),
}).strip();

export type MoveTask = z.infer<typeof MoveTaskSchema>;

// ============================================================================
// Projects
// ============================================================================

export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  area: z.string().optional().default('freelance'),
  client_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  budget_amount: z.coerce.number().nullable().optional(),
  budget_currency: z.string().optional().default('EUR'),
  start_date: z.string().nullable().optional(),
  target_end_date: z.string().nullable().optional(),
}).strip();

export type CreateProject = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  area: z.string().optional(),
  client_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  budget_amount: z.coerce.number().nullable().optional(),
  budget_currency: z.string().optional(),
  start_date: z.string().nullable().optional(),
  target_end_date: z.string().nullable().optional(),
  actual_end_date: z.string().nullable().optional(),
  codebase_path: z.string().nullable().optional(),
  github_repo: z.string().nullable().optional(),
}).strip();

export type UpdateProject = z.infer<typeof UpdateProjectSchema>;

// ============================================================================
// Subtasks
// ============================================================================

export const CreateSubtaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
}).strip();

export type CreateSubtask = z.infer<typeof CreateSubtaskSchema>;

export const UpdateSubtaskSchema = z.object({
  title: z.string().min(1).optional(),
  completed: z.coerce.number().int().min(0).max(1).optional(),
  sort_order: z.coerce.number().int().optional(),
}).strip();

export type UpdateSubtask = z.infer<typeof UpdateSubtaskSchema>;

export const ReorderSubtasksSchema = z.object({
  subtaskIds: z.array(z.string()).min(1, 'subtaskIds array is required'),
}).strip();

export type ReorderSubtasks = z.infer<typeof ReorderSubtasksSchema>;

export const SubtaskCountsSchema = z.object({
  taskIds: z.array(z.string()),
}).strip();

export type SubtaskCounts = z.infer<typeof SubtaskCountsSchema>;

// ============================================================================
// Clients
// ============================================================================

const AddressSchema = z.object({
  street: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().optional().default('Deutschland'),
}).optional().nullable();

export const CreateClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  contact_info: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().optional().default('active'),
  address: AddressSchema,
  address_street: z.string().nullable().optional(),
  address_zip: z.string().nullable().optional(),
  address_city: z.string().nullable().optional(),
  address_country: z.string().nullable().optional(),
}).strip();

export type CreateClient = z.infer<typeof CreateClientSchema>;

export const UpdateClientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  contact_info: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string().optional(),
  address: AddressSchema,
  address_street: z.string().nullable().optional(),
  address_zip: z.string().nullable().optional(),
  address_city: z.string().nullable().optional(),
  address_country: z.string().nullable().optional(),
}).strip();

export type UpdateClient = z.infer<typeof UpdateClientSchema>;

// ============================================================================
// Invoices
// ============================================================================

const InvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unit: z.string().optional().default('hours'),
  unit_price: z.coerce.number(),
});

export const CreateInvoiceSchema = z.object({
  client_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  invoice_date: z.string().optional(),
  due_date: z.string().optional(),
  vat_rate: z.coerce.number().optional().default(19),
  notes: z.string().nullable().optional(),
  items: z.array(InvoiceItemSchema).min(1, 'At least one line item is required'),
}).strip();

export type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;

export const UpdateInvoiceSchema = z.object({
  client_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  invoice_date: z.string().optional(),
  due_date: z.string().optional(),
  vat_rate: z.coerce.number().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(InvoiceItemSchema).optional(),
}).strip();

export type UpdateInvoice = z.infer<typeof UpdateInvoiceSchema>;

export const PayInvoiceSchema = z.object({
  payment_date: z.string().optional(),
  payment_method: z.string().nullable().optional(),
}).strip();

export type PayInvoice = z.infer<typeof PayInvoiceSchema>;

// ============================================================================
// Expenses
// ============================================================================

export const CreateExpenseSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  vendor: z.string().nullable().optional(),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  net_amount: z.coerce.number({ required_error: 'net_amount is required' }),
  vat_rate: z.coerce.number().optional().default(19),
  euer_line: z.coerce.number().nullable().optional(),
  euer_category: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  receipt_path: z.string().nullable().optional(),
  ust_period: z.string().nullable().optional(),
  deductible_percent: z.coerce.number().optional().default(100),
  vorsteuer_claimed: z.union([z.coerce.number(), z.boolean()]).optional().default(0),
  is_recurring: z.union([z.coerce.number(), z.boolean()]).optional().default(0),
  recurring_frequency: z.string().nullable().optional(),
  is_gwg: z.union([z.coerce.number(), z.boolean()]).optional().default(0),
  asset_id: z.string().nullable().optional(),
}).strip();

export type CreateExpense = z.infer<typeof CreateExpenseSchema>;

export const UpdateExpenseSchema = z.object({
  date: z.string().optional(),
  vendor: z.string().nullable().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  net_amount: z.coerce.number().optional(),
  vat_rate: z.coerce.number().optional(),
  euer_line: z.coerce.number().nullable().optional(),
  euer_category: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  receipt_path: z.string().nullable().optional(),
  ust_period: z.string().nullable().optional(),
  ust_reported: z.coerce.number().optional(),
  deductible_percent: z.coerce.number().optional(),
  vorsteuer_claimed: z.union([z.coerce.number(), z.boolean()]).optional(),
  is_recurring: z.union([z.coerce.number(), z.boolean()]).optional(),
  recurring_frequency: z.string().nullable().optional(),
  is_gwg: z.union([z.coerce.number(), z.boolean()]).optional(),
  asset_id: z.string().nullable().optional(),
}).strip();

export type UpdateExpense = z.infer<typeof UpdateExpenseSchema>;

export const MarkExpensesReportedSchema = z.object({
  ids: z.array(z.string()).min(1, 'ids array is required'),
  ust_period: z.string().optional(),
}).strip();

export type MarkExpensesReported = z.infer<typeof MarkExpensesReportedSchema>;

// ============================================================================
// Income
// ============================================================================

export const CreateIncomeSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  client_id: z.string().nullable().optional(),
  invoice_id: z.string().nullable().optional(),
  description: z.string().min(1, 'Description is required'),
  net_amount: z.coerce.number({ required_error: 'net_amount is required' }),
  vat_rate: z.coerce.number().optional().default(19),
  euer_line: z.coerce.number().optional().default(14),
  euer_category: z.string().optional().default('services'),
  payment_method: z.string().nullable().optional(),
  bank_reference: z.string().nullable().optional(),
  ust_period: z.string().nullable().optional(),
}).strip();

export type CreateIncome = z.infer<typeof CreateIncomeSchema>;

export const UpdateIncomeSchema = z.object({
  date: z.string().optional(),
  client_id: z.string().nullable().optional(),
  invoice_id: z.string().nullable().optional(),
  description: z.string().optional(),
  net_amount: z.coerce.number().optional(),
  vat_rate: z.coerce.number().optional(),
  euer_line: z.coerce.number().optional(),
  euer_category: z.string().optional(),
  payment_method: z.string().nullable().optional(),
  bank_reference: z.string().nullable().optional(),
  ust_period: z.string().nullable().optional(),
  ust_reported: z.coerce.number().optional(),
}).strip();

export type UpdateIncome = z.infer<typeof UpdateIncomeSchema>;

export const MarkIncomeReportedSchema = z.object({
  ids: z.array(z.string()).min(1, 'ids array is required'),
  ust_period: z.string().optional(),
}).strip();

export type MarkIncomeReported = z.infer<typeof MarkIncomeReportedSchema>;

// ============================================================================
// Time Tracking
// ============================================================================

export const LogTimeSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  duration_minutes: z.coerce.number().positive('duration_minutes is required'),
  task_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  start_time: z.string().optional(),
}).strip();

export type LogTime = z.infer<typeof LogTimeSchema>;

export const StartTimerSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  task_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
}).strip();

export type StartTimer = z.infer<typeof StartTimerSchema>;

// ============================================================================
// Suggestions
// ============================================================================

export const CreateSuggestionSchema = z.object({
  project_id: z.string().nullable().optional(),
  project_name: z.string().nullable().optional(),
  type: z.string().min(1, 'Type is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  priority: z.coerce.number().int().min(1).max(5).optional().default(2),
}).strip();

export type CreateSuggestion = z.infer<typeof CreateSuggestionSchema>;

export const UpdateSuggestionSchema = z.object({
  status: z.string().optional(),
}).strip();

export type UpdateSuggestion = z.infer<typeof UpdateSuggestionSchema>;

export const ImplementSuggestionSchema = z.object({
  prd_id: z.string().nullable().optional(),
  task_id: z.string().nullable().optional(),
}).strip();

export type ImplementSuggestion = z.infer<typeof ImplementSuggestionSchema>;

export const GenerateSuggestionsSchema = z.object({
  source: z.enum(['pa-project', 'github'], { required_error: "source must be 'pa-project' or 'github'" }),
  projectId: z.string().min(1, 'projectId is required'),
  projectName: z.string().min(1, 'projectName is required'),
  projectPath: z.string().optional(),
  deepMode: z.boolean().optional().default(false),
  count: z.coerce.number().int().min(1).optional().default(3).transform(n => Math.min(n, 3)),
}).strip();

export type GenerateSuggestions = z.infer<typeof GenerateSuggestionsSchema>;

export const AddCommentSchema = z.object({
  comment_text: z.string().min(1, 'Comment text is required').transform(s => s.trim()),
}).strip();

export type AddComment = z.infer<typeof AddCommentSchema>;

// ============================================================================
// Captures
// ============================================================================

export const CreateCaptureSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  type: z.string().optional().default('note'),
}).strip();

export type CreateCapture = z.infer<typeof CreateCaptureSchema>;

export const ProcessCaptureSchema = z.object({
  processed_to: z.string().nullable().optional(),
  processed_by: z.string().optional().default('manual'),
  artifact_type: z.string().nullable().optional(),
  artifact_id: z.string().nullable().optional(),
}).strip();

export type ProcessCapture = z.infer<typeof ProcessCaptureSchema>;

// ============================================================================
// PRDs
// ============================================================================

export const CreatePrdSchema = z.object({
  projectId: z.string().nullable().optional(),
  featureName: z.string().min(1, 'Feature name is required'),
  version: z.string().optional().default('1.0'),
  author: z.string().optional().default('Justin'),
  assignee: z.string().nullable().optional(),
  area: z.string().optional().default('personal'),
  status: z.string().optional().default('draft'),
  problemStatement: z.string().nullable().optional(),
  goals: z.array(z.unknown()).optional().default([]),
  nonGoals: z.array(z.unknown()).optional().default([]),
  targetUsers: z.string().nullable().optional(),
  userStories: z.array(z.unknown()).optional().default([]),
  requirements: z.array(z.unknown()).optional().default([]),
  technicalApproach: z.string().nullable().optional(),
  dependencies: z.array(z.unknown()).optional().default([]),
  risks: z.array(z.unknown()).optional().default([]),
  assumptions: z.array(z.unknown()).optional().default([]),
  constraints: z.array(z.unknown()).optional().default([]),
  successMetrics: z.array(z.unknown()).optional().default([]),
  milestones: z.array(z.unknown()).optional().default([]),
  estimatedEffort: z.string().nullable().optional(),
  markdownPath: z.string().nullable().optional(),
}).strip();

export type CreatePrd = z.infer<typeof CreatePrdSchema>;

export const UpdatePrdSchema = z.object({
  projectId: z.string().nullable().optional(),
  featureName: z.string().optional(),
  version: z.string().optional(),
  author: z.string().optional(),
  assignee: z.string().nullable().optional(),
  area: z.string().optional(),
  status: z.string().optional(),
  problemStatement: z.string().nullable().optional(),
  goals: z.array(z.unknown()).optional(),
  nonGoals: z.array(z.unknown()).optional(),
  targetUsers: z.string().nullable().optional(),
  userStories: z.array(z.unknown()).optional(),
  requirements: z.array(z.unknown()).optional(),
  technicalApproach: z.string().nullable().optional(),
  dependencies: z.array(z.unknown()).optional(),
  risks: z.array(z.unknown()).optional(),
  assumptions: z.array(z.unknown()).optional(),
  constraints: z.array(z.unknown()).optional(),
  successMetrics: z.array(z.unknown()).optional(),
  milestones: z.array(z.unknown()).optional(),
  estimatedEffort: z.string().nullable().optional(),
  markdownPath: z.string().nullable().optional(),
}).strip();

export type UpdatePrd = z.infer<typeof UpdatePrdSchema>;

// ============================================================================
// Tags
// ============================================================================

export const CreateTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').transform(s => s.trim()),
  color: z.string().nullable().optional(),
}).strip();

export type CreateTag = z.infer<typeof CreateTagSchema>;

export const UpdateTagSchema = z.object({
  name: z.string().min(1, 'Tag name cannot be empty').transform(s => s.trim()).optional(),
  color: z.string().nullable().optional(),
}).strip();

export type UpdateTag = z.infer<typeof UpdateTagSchema>;

export const SyncTaskTagsSchema = z.object({
  tagIds: z.array(z.string()),
}).strip();

export type SyncTaskTags = z.infer<typeof SyncTaskTagsSchema>;

export const BulkTaskTagsSchema = z.object({
  taskIds: z.array(z.string()),
}).strip();

export type BulkTaskTags = z.infer<typeof BulkTaskTagsSchema>;

// ============================================================================
// Settings
// ============================================================================

export const UpdateSettingSchema = z.object({
  value: z.unknown({ required_error: 'Value is required' }),
}).strip();

export type UpdateSetting = z.infer<typeof UpdateSettingSchema>;

// Note: bulk PUT /settings accepts any object — validated as z.record in route

// ============================================================================
// Social Media
// ============================================================================

export const CreateSocialPostSchema = z.object({
  platform: z.enum(['linkedin', 'instagram'], { required_error: "platform must be 'linkedin' or 'instagram'" }),
  content_text: z.string().min(1, 'content_text is required').transform(s => s.trim()),
  visual_path: z.string().nullable().optional(),
  visual_type: z.string().nullable().optional(),
  scheduled_date: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  metadata: z.unknown().optional(),
  status: z.string().optional().default('suggested'),
}).strip();

export type CreateSocialPost = z.infer<typeof CreateSocialPostSchema>;

export const UpdateSocialPostSchema = z.object({
  platform: z.enum(['linkedin', 'instagram']).optional(),
  status: z.string().optional(),
  content_text: z.string().min(1).optional(),
  visual_path: z.string().nullable().optional(),
  visual_type: z.string().nullable().optional(),
  scheduled_date: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  metadata: z.unknown().optional(),
}).strip();

export type UpdateSocialPost = z.infer<typeof UpdateSocialPostSchema>;

// ============================================================================
// James Tasks
// ============================================================================

export const CreateJamesTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  status: z.string().optional().default('backlog'),
  priority: z.coerce.number().int().min(1).max(5).optional().default(2),
  source: z.string().nullable().optional(),
  source_id: z.string().nullable().optional(),
}).strip();

export type CreateJamesTask = z.infer<typeof CreateJamesTaskSchema>;

export const UpdateJamesTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
  source: z.string().nullable().optional(),
  source_id: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
}).strip();

export type UpdateJamesTask = z.infer<typeof UpdateJamesTaskSchema>;

// ============================================================================
// James Actions
// ============================================================================

export const CreateJamesActionSchema = z.object({
  action_type: z.string().min(1, 'action_type is required'),
  description: z.string().min(1, 'description is required'),
  project_id: z.string().nullable().optional(),
  task_id: z.string().nullable().optional(),
  suggestion_id: z.string().nullable().optional(),
  prd_id: z.string().nullable().optional(),
  metadata: z.unknown().optional(),
}).strip();

export type CreateJamesAction = z.infer<typeof CreateJamesActionSchema>;

// ============================================================================
// James Automations
// ============================================================================

export const CreateAutomationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  schedule: z.string().min(1, 'Schedule is required'),
  schedule_human: z.string().nullable().optional(),
  type: z.string().optional().default('cron'),
  enabled: z.union([z.boolean(), z.coerce.number()]).optional().default(true),
  next_run: z.string().nullable().optional(),
}).strip();

export type CreateAutomation = z.infer<typeof CreateAutomationSchema>;

export const UpdateAutomationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  schedule: z.string().optional(),
  schedule_human: z.string().nullable().optional(),
  type: z.string().optional(),
  enabled: z.union([z.boolean(), z.coerce.number()]).optional(),
  last_run: z.string().nullable().optional(),
  next_run: z.string().nullable().optional(),
}).strip();

export type UpdateAutomation = z.infer<typeof UpdateAutomationSchema>;

// ============================================================================
// Assets
// ============================================================================

export const CreateAssetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  category: z.string().min(1, 'Category is required'),
  purchase_date: z.string().min(1, 'Purchase date is required'),
  purchase_price: z.coerce.number({ required_error: 'Purchase price is required' }),
  useful_life_years: z.coerce.number().int().positive('useful_life_years is required'),
  depreciation_method: z.string().optional().default('linear'),
  salvage_value: z.coerce.number().optional().default(0),
  vendor: z.string().nullable().optional(),
  vat_paid: z.coerce.number().nullable().optional(),
  gross_price: z.coerce.number().nullable().optional(),
  inventory_number: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  bill_path: z.string().nullable().optional(),
  euer_line: z.coerce.number().optional().default(30),
  euer_category: z.string().optional().default('depreciation'),
  afa_start_date: z.string().nullable().optional(),
}).strip();

export type CreateAsset = z.infer<typeof CreateAssetSchema>;

export const UpdateAssetSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  purchase_date: z.string().optional(),
  purchase_price: z.coerce.number().optional(),
  useful_life_years: z.coerce.number().int().positive().optional(),
  depreciation_method: z.string().optional(),
  salvage_value: z.coerce.number().optional(),
  vendor: z.string().nullable().optional(),
  vat_paid: z.coerce.number().nullable().optional(),
  gross_price: z.coerce.number().nullable().optional(),
  inventory_number: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  bill_path: z.string().nullable().optional(),
  euer_line: z.coerce.number().optional(),
  euer_category: z.string().optional(),
  afa_start_date: z.string().nullable().optional(),
}).strip();

export type UpdateAsset = z.infer<typeof UpdateAssetSchema>;

export const DepreciateAssetSchema = z.object({
  year: z.coerce.number().int().optional(),
}).strip();

export type DepreciateAsset = z.infer<typeof DepreciateAssetSchema>;

// ============================================================================
// Vendor Mappings
// ============================================================================

export const CreateVendorMappingSchema = z.object({
  ocr_name: z.string().min(1, 'ocr_name is required'),
  display_name: z.string().min(1, 'display_name is required'),
  default_category: z.string().nullable().optional(),
  default_vat_rate: z.coerce.number().nullable().optional(),
}).strip();

export type CreateVendorMapping = z.infer<typeof CreateVendorMappingSchema>;

// ============================================================================
// Office
// ============================================================================

export const UpdateAgentStatusSchema = z.object({
  status: z.string().optional(),
  currentTask: z.string().optional(),
  location: z.string().optional(),
  interactingWith: z.string().nullable().optional(),
}).strip();

export type UpdateAgentStatus = z.infer<typeof UpdateAgentStatusSchema>;

// ============================================================================
// Cache
// ============================================================================

export const CacheInvalidateSchema = z.object({
  pattern: z.string().min(1, 'pattern is required'),
}).strip();

export type CacheInvalidate = z.infer<typeof CacheInvalidateSchema>;

// ============================================================================
// Client Dashboard
// ============================================================================

export const ClientCreateTaskSchema = z.object({
  project_id: z.string().min(1),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
}).strip();

export type ClientCreateTask = z.infer<typeof ClientCreateTaskSchema>;

export const ClientUpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
}).strip();

export type ClientUpdateTask = z.infer<typeof ClientUpdateTaskSchema>;

// ============================================================================
// Reports
// ============================================================================

export const FileUstSchema = z.object({}).strip();

export type FileUst = z.infer<typeof FileUstSchema>;
