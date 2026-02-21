/**
 * REST API client for web builds
 * Mirrors the database interface but uses fetch.
 *
 * Backed by the centralized HttpClient from @/api.
 */

import { adminClient, API_BASE } from '@/api';

// Social Media types
export interface SocialMediaPost {
  id: string;
  platform: 'linkedin' | 'instagram';
  status: 'suggested' | 'approved' | 'scheduled' | 'published' | 'rejected';
  content_text: string;
  visual_path: string | null;
  visual_type: string | null;
  scheduled_date: string | null;
  published_date: string | null;
  source: string | null;
  metadata: {
    topics?: string[];
    hashtags?: string[];
    [key: string]: unknown;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSocialMediaPost {
  platform: 'linkedin' | 'instagram';
  content_text: string;
  visual_path?: string;
  visual_type?: string;
  scheduled_date?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  status?: string;
}

// ── Memory types ─────────────────────────────────────────────────────

export interface MemoryAgent {
  id: string;
  name: string;
  emoji: string;
  coreFiles: string[];
  entryCount: number;
  tierBreakdown: Record<string, number>;
  healthScore: number;
}

export interface MemoryFile {
  path: string;
  name: string;
  size: number;
  lastModified: string;
  exists: boolean;
  encrypted: boolean;
  tier: number;
  label: string | null;
  description: string | null;
  tags: string[];
  isShared: boolean;
  category: string;
}

export interface MemoryHealthWarning {
  type: "stale" | "bloated" | "missing" | "duplicate";
  message: string;
  filePath?: string;
  severity: "low" | "medium" | "high";
}

export interface MemoryHealthReport {
  agents: Array<{
    agent: string;
    score: number;
    warnings: MemoryHealthWarning[];
    fileCount: number;
  }>;
  duplicates: MemoryHealthWarning[];
}

export interface MemorySearchResult {
  query: string;
  resultCount: number;
  results: Array<{
    agentId: string;
    agentName: string;
    filePath: string;
    fileName: string;
    snippet: string;
    matchCount: number;
  }>;
}

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    return adminClient.request<T>(path, options);
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

  async moveTask(id: string, status: string, targetIndex?: number) {
    return this.request<unknown>(`/tasks/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ status, targetIndex }),
    });
  }

  async reorderTasks(taskIds: string[], status: string) {
    return this.request<unknown[]>('/tasks/reorder', {
      method: 'POST',
      body: JSON.stringify({ taskIds, status }),
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

  async updateTimeEntry(id: string, updates: Record<string, unknown>) {
    return this.request<unknown>(`/time/${id}`, { 
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
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

  async processWithJames(id: string) {
    return this.request<{ status: string; message: string; captureId: string }>(`/captures/${id}/process-with-james`, {
      method: 'POST',
    });
  }

  async getProcessingStatus(id: string) {
    return this.request<{
      captureId: string;
      processingStatus: string;
      processedBy?: string;
      artifactType?: string;
      artifactId?: string;
      processed: boolean;
    }>(`/captures/${id}/processing-status`);
  }

  async deleteCapture(id: string) {
    return this.request<unknown>(`/captures/${id}`, { method: 'DELETE' });
  }

  // Invoices
  async getInvoices(filters?: { status?: string; client_id?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.client_id) params.set('client_id', filters.client_id);
    const query = params.toString();
    return this.request<unknown[]>(`/invoices${query ? `?${query}` : ''}`);
  }

  async getInvoice(id: string) {
    return this.request<unknown>(`/invoices/${id}`);
  }

  async createInvoice(invoice: Record<string, unknown>) {
    return this.request<unknown>('/invoices', {
      method: 'POST',
      body: JSON.stringify(invoice),
    });
  }

  async updateInvoice(id: string, updates: Record<string, unknown>) {
    return this.request<unknown>(`/invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteInvoice(id: string) {
    return this.request<unknown>(`/invoices/${id}`, { method: 'DELETE' });
  }

  async sendInvoice(id: string) {
    return this.request<unknown>(`/invoices/${id}/send`, { method: 'POST' });
  }

  async payInvoice(id: string, paymentDate: string, paymentMethod?: string) {
    return this.request<unknown>(`/invoices/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payment_date: paymentDate, payment_method: paymentMethod }),
    });
  }

  async cancelInvoice(id: string) {
    return this.request<unknown>(`/invoices/${id}/cancel`, { method: 'POST' });
  }

  // Second Brain
  async getSecondBrainDocuments() {
    return this.request<{
      folders: Array<{
        name: string;
        documents: Array<{
          path: string;
          name: string;
          title: string;
          folder: string;
          lastModified: string;
        }>;
      }>;
    }>('/second-brain/documents');
  }

  async getSecondBrainDocument(path: string) {
    return this.request<{
      path: string;
      name: string;
      title: string;
      content: string;
      lastModified: string;
    }>(`/second-brain/documents/${encodeURIComponent(path)}`);
  }

  async searchSecondBrain(query: string) {
    return this.request<{
      results: Array<{
        path: string;
        name: string;
        title: string;
        folder: string;
        lastModified: string;
      }>;
    }>(`/second-brain/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Download invoice PDF
   * Returns a Blob for download
   */
  async downloadInvoicePdf(id: string): Promise<Blob> {
    return adminClient.requestBlob(`/invoices/${id}/pdf`);
  }

  /**
   * Regenerate invoice PDF
   */
  async regenerateInvoicePdf(id: string) {
    return this.request<{ success: boolean; pdf_path: string }>(`/invoices/${id}/regenerate-pdf`, {
      method: 'POST',
    });
  }

  // Income
  async getIncome(filters?: { start_date?: string; end_date?: string; client_id?: string; ust_period?: string }) {
    const params = new URLSearchParams();
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    if (filters?.client_id) params.set('client_id', filters.client_id);
    if (filters?.ust_period) params.set('ust_period', filters.ust_period);
    const query = params.toString();
    return this.request<unknown[]>(`/income${query ? `?${query}` : ''}`);
  }

  async getIncomeById(id: string) {
    return this.request<unknown>(`/income/${id}`);
  }

  async createIncome(income: Record<string, unknown>) {
    return this.request<unknown>('/income', {
      method: 'POST',
      body: JSON.stringify(income),
    });
  }

  async updateIncome(id: string, updates: Record<string, unknown>) {
    return this.request<unknown>(`/income/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteIncome(id: string) {
    return this.request<unknown>(`/income/${id}`, { method: 'DELETE' });
  }

  async markIncomeReported(ids: string[], ustPeriod?: string) {
    return this.request<unknown>('/income/mark-reported', {
      method: 'POST',
      body: JSON.stringify({ ids, ust_period: ustPeriod }),
    });
  }

  // Expenses
  async getExpenses(filters?: { start_date?: string; end_date?: string; category?: string; vendor?: string }) {
    const params = new URLSearchParams();
    if (filters?.start_date) params.set('start_date', filters.start_date);
    if (filters?.end_date) params.set('end_date', filters.end_date);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.vendor) params.set('vendor', filters.vendor);
    const query = params.toString();
    return this.request<unknown[]>(`/expenses${query ? `?${query}` : ''}`);
  }

  async getExpenseById(id: string) {
    return this.request<unknown>(`/expenses/${id}`);
  }

  async createExpense(expense: Record<string, unknown>) {
    return this.request<unknown>('/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  }

  async updateExpense(id: string, updates: Record<string, unknown>) {
    return this.request<unknown>(`/expenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteExpense(id: string) {
    return this.request<unknown>(`/expenses/${id}`, { method: 'DELETE' });
  }

  async getExpenseCategories() {
    return this.request<unknown[]>('/expenses/categories');
  }

  async markExpensesReported(ids: string[], ustPeriod?: string) {
    return this.request<unknown>('/expenses/mark-reported', {
      method: 'POST',
      body: JSON.stringify({ ids, ust_period: ustPeriod }),
    });
  }

  // Assets
  async getAssets(filters?: { status?: string; category?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.category) params.set('category', filters.category);
    const query = params.toString();
    return this.request<unknown[]>(`/assets${query ? `?${query}` : ''}`);
  }

  async getAssetById(id: string) {
    return this.request<unknown>(`/assets/${id}`);
  }

  async createAsset(asset: Record<string, unknown>) {
    return this.request<unknown>('/assets', {
      method: 'POST',
      body: JSON.stringify(asset),
    });
  }

  async updateAsset(id: string, updates: Record<string, unknown>) {
    return this.request<unknown>(`/assets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteAsset(id: string) {
    return this.request<unknown>(`/assets/${id}`, { method: 'DELETE' });
  }

  async getAssetSchedule(id: string) {
    return this.request<unknown[]>(`/assets/${id}/schedule`);
  }

  async depreciateAsset(id: string, year?: number) {
    return this.request<unknown>(`/assets/${id}/depreciate`, {
      method: 'POST',
      body: JSON.stringify({ year }),
    });
  }

  async disposeAsset(id: string, data: { disposal_date: string; disposal_price: number; disposal_reason?: string; status?: string }) {
    return this.request<unknown>(`/assets/${id}/dispose`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // James Actions (audit trail)
  async getJamesActions(filters?: { project_id?: string; action_type?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.project_id) params.set('project_id', filters.project_id);
    if (filters?.action_type) params.set('action_type', filters.action_type);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    return this.request<unknown[]>(`/james-actions${query ? `?${query}` : ''}`);
  }

  async createJamesAction(action: Record<string, unknown>) {
    return this.request<unknown>('/james-actions', {
      method: 'POST',
      body: JSON.stringify(action),
    });
  }

  // James Automations
  async getJamesAutomations() {
    return this.request<unknown[]>('/james-automations');
  }

  async createJamesAutomation(automation: Record<string, unknown>) {
    return this.request<unknown>('/james-automations', {
      method: 'POST',
      body: JSON.stringify(automation),
    });
  }

  async updateJamesAutomation(id: string, data: Record<string, unknown>) {
    return this.request<unknown>(`/james-automations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteJamesAutomation(id: string) {
    return this.request<unknown>(`/james-automations/${id}`, { method: 'DELETE' });
  }

  // James Trigger
  async triggerJames() {
    return this.request<{ success: boolean; message: string }>('/james/check', { method: 'POST' });
  }

  // Suggestions
  async getSuggestions(filters?: { status?: string; project_id?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.project_id) params.set('project_id', filters.project_id);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    return this.request<unknown[]>(`/suggestions${query ? `?${query}` : ''}`);
  }

  async createSuggestion(suggestion: Record<string, unknown>) {
    return this.request<unknown>('/suggestions', {
      method: 'POST',
      body: JSON.stringify(suggestion),
    });
  }

  async approveSuggestion(id: string) {
    return this.request<unknown>(`/suggestions/${id}/approve`, { method: 'POST' });
  }

  async rejectSuggestion(id: string) {
    return this.request<unknown>(`/suggestions/${id}/reject`, { method: 'POST' });
  }

  async updateSuggestion(id: string, data: { status?: string }) {
    return this.request<unknown>(`/suggestions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async implementSuggestion(id: string, data?: { prd_id?: string; task_id?: string }) {
    return this.request<unknown>(`/suggestions/${id}/implement`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async createPrdFromSuggestion(id: string): Promise<{ success: boolean; prdId: string; message: string }> {
    return this.request(`/suggestions/${id}/create-prd`, {
      method: 'POST',
    });
  }

  // Suggestion Comments
  async getSuggestionComments(suggestionId: string) {
    return this.request<Array<{
      id: string;
      suggestion_id: string;
      author: string;
      comment_text: string;
      created_at: string;
    }>>(`/suggestions/${suggestionId}/comments`);
  }

  async addSuggestionComment(suggestionId: string, commentText: string) {
    return this.request<{
      id: string;
      suggestion_id: string;
      author: string;
      comment_text: string;
      created_at: string;
    }>(`/suggestions/${suggestionId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment_text: commentText }),
    });
  }

  async deleteSuggestionComment(commentId: string) {
    return this.request<{ success: boolean }>(`/suggestions/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // Generate Suggestions
  async generateSuggestions(params: {
    source: 'pa-project' | 'github';
    projectId: string;
    projectName: string;
    projectPath?: string;
    deepMode: boolean;
    count: number;
  }): Promise<{ success: boolean; suggestions: unknown[]; message: string; duration?: number }> {
    return this.request('/suggestions/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // GitHub Repos
  async getGitHubRepos(): Promise<{ repos: Array<{ name: string; description: string; url: string; updatedAt: string }>; message?: string; authenticated?: boolean }> {
    return this.request('/github/repos');
  }

  // James Tasks
  async getJamesTasks(filters?: { status?: string; source?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.source) params.set('source', filters.source);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    return this.request<unknown[]>(`/james-tasks${query ? `?${query}` : ''}`);
  }

  async getJamesTask(id: string) {
    return this.request<unknown>(`/james-tasks/${id}`);
  }

  async createJamesTask(task: Record<string, unknown>) {
    return this.request<unknown>('/james-tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateJamesTask(id: string, updates: Record<string, unknown>) {
    return this.request<unknown>(`/james-tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteJamesTask(id: string) {
    return this.request<unknown>(`/james-tasks/${id}`, { method: 'DELETE' });
  }

  async getJamesTasksStats() {
    return this.request<{
      total: number;
      backlog: number;
      queue: number;
      in_progress: number;
      done: number;
    }>('/james-tasks/stats/summary');
  }

  // Token Usage
  async getTokenUsage(filters?: {
    startDate?: string;
    endDate?: string;
    model?: string;
    groupBy?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.model) params.set('model', filters.model);
    if (filters?.groupBy) params.set('groupBy', filters.groupBy);
    const query = params.toString();
    return this.request<{
      _mock: boolean;
      _note: string;
      overview: {
        total: number;
        totalInput: number;
        totalOutput: number;
        today: number;
        todayInput: number;
        todayOutput: number;
        week: number;
        weekInput: number;
        weekOutput: number;
        month: number;
        monthInput: number;
        monthOutput: number;
      };
      byModel: Record<string, { total: number; input: number; output: number }>;
      trend: Array<{
        date: string;
        inputTokens: number;
        outputTokens: number;
        tokens: number;
        model: string;
      }>;
      sessions: Array<{
        id: string;
        timestamp: string;
        activity: string;
        model: string;
        inputTokens: number;
        outputTokens: number;
        total: number;
      }>;
    }>(`/james/usage${query ? `?${query}` : ''}`);
  }

  // API Usage & Costs
  async getApiUsage(filters?: {
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    const query = params.toString();
    return this.request<{
      _mock: boolean;
      _note: string;
      overview: {
        monthCost: number;
        monthCalls: number;
        todayCost: number;
        todayCalls: number;
        projectedMonthlyCost: number;
        topApiId: string;
        topApiName: string;
        topApiCost: number;
      };
      providers: Array<{
        id: string;
        name: string;
        category: string;
        icon: string;
        color: string;
        pricingModel: string;
        freeTier: boolean;
      }>;
      summaries: Array<{
        apiId: string;
        name: string;
        category: string;
        calls: number;
        units: number;
        unitType: string;
        cost: number;
        trend: number;
        avgDailyCost: number;
        inputUnits?: number;
        outputUnits?: number;
      }>;
      costTrend: Array<{
        date: string;
        anthropic: number;
        groq: number;
        'google-drive': number;
        'google-sheets': number;
        'google-calendar': number;
        total: number;
      }>;
      dailyUsage: Array<{
        date: string;
        apiId: string;
        calls: number;
        units: number;
        unitType: string;
        cost: number;
        inputUnits?: number;
        outputUnits?: number;
      }>;
      pricing: {
        anthropic: Record<string, { input: number; output: number }>;
        groq: { whisper: number };
        googleQuota: Record<string, { daily: number; description: string }>;
      };
    }>(`/james/api-usage${query ? `?${query}` : ''}`);
  }

  // Subtasks
  async getSubtasks(taskId: string) {
    return this.request<unknown[]>(`/tasks/${taskId}/subtasks`);
  }

  async createSubtask(taskId: string, title: string) {
    return this.request<unknown>(`/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async updateSubtask(id: string, updates: { title?: string; completed?: number; sort_order?: number }) {
    return this.request<unknown>(`/subtasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteSubtask(id: string) {
    return this.request<unknown>(`/subtasks/${id}`, { method: 'DELETE' });
  }

  async reorderSubtasks(taskId: string, subtaskIds: string[]) {
    return this.request<unknown[]>(`/tasks/${taskId}/subtasks/reorder`, {
      method: 'POST',
      body: JSON.stringify({ subtaskIds }),
    });
  }

  async getSubtaskCounts(taskIds: string[]) {
    return this.request<Record<string, { total: number; completed: number }>>('/subtasks/counts', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });
  }

  // ── Tags ──────────────────────────────────────────────────

  async getTags() {
    return this.request<Array<{ id: string; name: string; color: string | null }>>('/tags');
  }

  async createTag(data: { name: string; color?: string }) {
    return this.request<{ id: string; name: string; color: string | null }>('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTag(id: string, data: { name?: string; color?: string | null }) {
    return this.request<{ id: string; name: string; color: string | null }>(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTag(id: string) {
    return this.request<{ success: boolean }>(`/tags/${id}`, { method: 'DELETE' });
  }

  async getTaskTags(taskId: string) {
    return this.request<Array<{ id: string; name: string; color: string | null }>>(`/tags/tasks/${taskId}`);
  }

  async addTagToTask(taskId: string, tagId: string) {
    return this.request<{ success: boolean }>(`/tags/tasks/${taskId}/${tagId}`, {
      method: 'POST',
    });
  }

  async removeTagFromTask(taskId: string, tagId: string) {
    return this.request<{ success: boolean }>(`/tags/tasks/${taskId}/${tagId}`, {
      method: 'DELETE',
    });
  }

  async syncTaskTags(taskId: string, tagIds: string[]) {
    return this.request<Array<{ id: string; name: string; color: string | null }>>(`/tags/tasks/${taskId}/sync`, {
      method: 'POST',
      body: JSON.stringify({ tagIds }),
    });
  }

  async getTaskTagsBulk(taskIds: string[]) {
    return this.request<Record<string, Array<{ id: string; name: string; color: string | null }>>>('/tags/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });
  }

  // Social Media Posts
  async getSocialMediaPosts(filters?: { platform?: string; status?: string; source?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.platform) params.set('platform', filters.platform);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.source) params.set('source', filters.source);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    return this.request<SocialMediaPost[]>(`/social-media/posts${query ? `?${query}` : ''}`);
  }

  async getSocialMediaPost(id: string) {
    return this.request<SocialMediaPost>(`/social-media/posts/${id}`);
  }

  async createSocialMediaPost(post: CreateSocialMediaPost) {
    return this.request<SocialMediaPost>('/social-media/posts', {
      method: 'POST',
      body: JSON.stringify(post),
    });
  }

  async updateSocialMediaPost(id: string, updates: Partial<CreateSocialMediaPost> & { status?: string }) {
    return this.request<SocialMediaPost>(`/social-media/posts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteSocialMediaPost(id: string) {
    return this.request<{ success: boolean }>(`/social-media/posts/${id}`, { method: 'DELETE' });
  }

  async publishSocialMediaPost(id: string) {
    return this.request<SocialMediaPost>(`/social-media/posts/${id}/publish`, { method: 'POST' });
  }

  async generateSocialMediaVisual(id: string) {
    return this.request<{ success: boolean; visual_path: string; visual_type: string }>(
      `/social-media/posts/${id}/generate-visual`,
      { method: 'POST' }
    );
  }

  async getSocialMediaStats() {
    return this.request<{
      total: number;
      byPlatform: Array<{ platform: string; status: string; count: number }>;
      upcoming: SocialMediaPost[];
    }>('/social-media/stats');
  }

  // ── Memory ──────────────────────────────────────────────────────────

  async getMemoryAgents() {
    return this.request<MemoryAgent[]>('/memory/agents');
  }

  async getMemoryFiles(agentId: string) {
    return this.request<{ agentId: string; files: MemoryFile[] }>(
      `/memory/agents/${agentId}/files`
    );
  }

  async getMemoryFileContent(agentId: string, filePath: string) {
    return this.request<{
      path: string;
      name: string;
      content: string;
      encrypted: boolean;
    }>(`/memory/agents/${agentId}/files/content?path=${encodeURIComponent(filePath)}`);
  }

  async updateMemoryFileContent(agentId: string, filePath: string, content: string) {
    return this.request<{ success: boolean; path: string }>(
      `/memory/agents/${agentId}/files/content`,
      {
        method: 'PUT',
        body: JSON.stringify({ path: filePath, content }),
      }
    );
  }

  async updateMemoryFileMetadata(
    agentId: string,
    data: {
      path: string;
      tier?: 1 | 2 | 3;
      label?: string;
      tags?: string[];
      description?: string;
      is_shared?: boolean;
    }
  ) {
    return this.request<unknown>(`/memory/agents/${agentId}/files/metadata`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getMemoryHealth() {
    return this.request<MemoryHealthReport>('/memory/health');
  }

  async searchMemory(query: string, agents?: string[]) {
    const params = new URLSearchParams({ q: query });
    if (agents?.length) params.set('agents', agents.join(','));
    return this.request<MemorySearchResult>(`/memory/search?${params.toString()}`);
  }

  // ── Audit Trail ──────────────────────────────────────────────────────

  /**
   * Get audit trail for a specific entity
   */
  async getAuditLog(entityType: string, entityId: string, limit = 100) {
    return this.request<AuditEntry[]>(`/audit/${entityType}/${entityId}?limit=${limit}`);
  }

  /**
   * Search audit logs with filters
   */
  async searchAudit(filters: {
    entity_type?: string;
    action?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }) {
    const params = new URLSearchParams();
    if (filters.entity_type) params.set('entity_type', filters.entity_type);
    if (filters.action) params.set('action', filters.action);
    if (filters.user_id) params.set('user_id', filters.user_id);
    if (filters.start_date) params.set('start_date', filters.start_date);
    if (filters.end_date) params.set('end_date', filters.end_date);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.offset) params.set('offset', String(filters.offset));
    const query = params.toString();
    return this.request<AuditSearchResult>(`/audit/search${query ? `?${query}` : ''}`);
  }

  // ── Period Locks ─────────────────────────────────────────────────────

  /**
   * Get all period locks with status overview
   */
  async getPeriodLocks(filters?: { period_type?: string; year?: number }) {
    const params = new URLSearchParams();
    if (filters?.period_type) params.set('period_type', filters.period_type);
    if (filters?.year) params.set('year', String(filters.year));
    const query = params.toString();
    return this.request<PeriodLocksResponse>(`/audit/periods${query ? `?${query}` : ''}`);
  }

  /**
   * Lock a period
   */
  async lockPeriod(key: string, reason?: string) {
    return this.request<PeriodLock>(`/audit/periods/${key}/lock`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Unlock a period (requires reason for GoBD compliance)
   */
  async unlockPeriod(key: string, reason: string) {
    return this.request<{ success: boolean; message: string; reason: string }>(`/audit/periods/${key}/unlock`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Check if a specific period is locked
   */
  async getPeriodLockStatus(key: string) {
    return this.request<{ period_key: string; locked: boolean; lock: PeriodLock | null }>(`/audit/periods/${key}/status`);
  }

  // ── E-Rechnung ──────────────────────────────────────────────────────

  /**
   * Generate E-Rechnung (ZUGFeRD or X-Rechnung) for an invoice
   */
  async generateEInvoice(invoiceId: string, format: EInvoiceFormat = 'zugferd') {
    return this.request<EInvoiceResult>(`/invoices/${invoiceId}/einvoice`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    });
  }

  /**
   * Download E-Rechnung XML
   */
  async downloadEInvoice(invoiceId: string, format: EInvoiceFormat = 'zugferd'): Promise<Blob> {
    return adminClient.requestBlob(`/invoices/${invoiceId}/einvoice?format=${format}`);
  }

  /**
   * Validate E-Rechnung without generating
   */
  async validateEInvoice(invoiceId: string, format: EInvoiceFormat = 'zugferd') {
    return this.request<EInvoiceValidationResult>(`/invoices/${invoiceId}/einvoice/validate?format=${format}`);
  }

  // ── ELSTER ──────────────────────────────────────────────────────────

  /**
   * Generate USt-VA ELSTER submission
   */
  async generateUstVaElster(year: number, period: number, periodType: 'monthly' | 'quarterly' = 'quarterly', testMode = true) {
    return this.request<ElsterSubmissionResult>('/tax/elster/ust-va', {
      method: 'POST',
      body: JSON.stringify({ year, period, period_type: periodType, test_mode: testMode }),
    });
  }

  /**
   * Validate USt-VA before submission
   */
  async validateUstVaElster(year: number, period: number, periodType: 'monthly' | 'quarterly' = 'quarterly') {
    return this.request<ElsterValidationResult>('/tax/elster/ust-va/validate', {
      method: 'POST',
      body: JSON.stringify({ year, period, period_type: periodType }),
    });
  }

  /**
   * Generate ZM (Zusammenfassende Meldung) ELSTER submission
   */
  async generateZmElster(year: number, quarter: number, testMode = true) {
    return this.request<ElsterZmResult>('/tax/elster/zm', {
      method: 'POST',
      body: JSON.stringify({ year, quarter, test_mode: testMode }),
    });
  }

  /**
   * Get all ELSTER submissions
   */
  async getElsterSubmissions(filters?: { type?: string; period?: string; year?: number }) {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.period) params.set('period', filters.period);
    if (filters?.year) params.set('year', String(filters.year));
    const query = params.toString();
    return this.request<ElsterSubmission[]>(`/tax/elster/submissions${query ? `?${query}` : ''}`);
  }

  /**
   * Get specific ELSTER submission status
   */
  async getElsterSubmissionStatus(id: string) {
    return this.request<ElsterSubmission>(`/tax/elster/status/${id}`);
  }

  /**
   * Update ELSTER submission status (after manual filing)
   */
  async updateElsterSubmissionStatus(id: string, data: {
    status: string;
    transfer_ticket?: string;
    response_xml?: string;
    error_message?: string;
  }) {
    return this.request<ElsterSubmission>(`/tax/elster/status/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── DATEV (Server-Side) ─────────────────────────────────────────────

  /**
   * Preview DATEV export (without generating file)
   */
  async previewDatevExport(startDate: string, endDate: string, chart: 'SKR03' | 'SKR04' = 'SKR03') {
    const params = new URLSearchParams({ start: startDate, end: endDate, chart });
    return this.request<DatevServerPreview>(`/exports/datev/preview?${params.toString()}`);
  }

  /**
   * Generate DATEV export
   */
  async generateDatevExport(options: {
    start_date: string;
    end_date: string;
    chart_of_accounts?: string;
    consultant_number?: string;
    client_number?: string;
    include_income?: boolean;
    include_expenses?: boolean;
    include_depreciation?: boolean;
  }) {
    return this.request<DatevServerResult>('/exports/datev/generate', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  /**
   * Get Verfahrensdokumentation (procedure documentation)
   */
  async getVerfahrensdokumentation() {
    return this.request<VerfahrensdokuResponse>('/audit/documentation');
  }
}

// ============================================================================
// Phase 1 Types
// ============================================================================

/** Audit trail entry */
export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  user_id?: string;
  user_agent?: string;
  ip_address?: string;
  timestamp: string;
  metadata?: string;
}

/** Audit search result */
export interface AuditSearchResult {
  entries: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

/** Period lock */
export interface PeriodLock {
  id: string;
  period_type: string;
  period_key: string;
  locked_at: string;
  locked_by?: string;
  reason?: string;
}

/** Period locks response */
export interface PeriodLocksResponse {
  locks: PeriodLock[];
  periods: Array<{
    key: string;
    type: string;
    locked: boolean;
    lock?: PeriodLock;
  }>;
}

/** E-Rechnung format */
export type EInvoiceFormat = 'zugferd' | 'xrechnung-ubl' | 'xrechnung-cii';

/** E-Rechnung generation result */
export interface EInvoiceResult {
  invoiceId: string;
  format: EInvoiceFormat;
  valid: boolean;
  errors: string[];
  warnings: string[];
  xml: string;
}

/** E-Rechnung validation result */
export interface EInvoiceValidationResult {
  invoiceId: string;
  format: EInvoiceFormat;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** ELSTER submission */
export interface ElsterSubmission {
  id: string;
  type: string;
  period_key: string;
  status: string;
  xml: string;
  tax_data: string;
  test_mode: boolean;
  transfer_ticket?: string;
  response_xml?: string;
  error_message?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

/** ELSTER submission result */
export interface ElsterSubmissionResult {
  submission: ElsterSubmission;
  taxData: {
    steuernummer: string;
    year: number;
    period: number;
    periodType: string;
    kz81: number;
    kz86: number;
    kz66: number;
    kz83: number;
    [key: string]: unknown;
  };
  xml: string;
}

/** ELSTER validation result */
export interface ElsterValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  taxData: {
    steuernummer: string;
    year: number;
    period: number;
    periodType: string;
    kz81: number;
    kz86: number;
    kz66: number;
    kz83: number;
    [key: string]: unknown;
  };
  xml: string;
}

/** ELSTER ZM result */
export interface ElsterZmResult {
  submission: ElsterSubmission;
  taxData: {
    year: number;
    quarter: number;
    entries: Array<{
      vatId: string;
      name?: string;
      amount: number;
    }>;
    totalAmount: number;
  };
  xml: string;
  entryCount: number;
}

/** DATEV server-side preview */
export interface DatevServerPreview {
  recordCount: number;
  filename: string;
  records: unknown[];
  errors: string[];
  warnings: string[];
}

/** DATEV server-side result */
export interface DatevServerResult {
  success: boolean;
  csv?: string;
  filename?: string;
  recordCount: number;
  warnings: string[];
  errors?: string[];
}

/** Verfahrensdokumentation response */
export interface VerfahrensdokuResponse {
  title: string;
  version: string;
  generated_at: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    subsections?: Array<{
      id: string;
      title: string;
      content: string;
    }>;
  }>;
}

export const api = new ApiClient();

// Re-export isWebBuild from centralized module
export { isWebBuild } from '@/api';
