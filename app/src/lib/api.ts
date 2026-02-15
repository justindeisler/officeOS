/**
 * REST API client for web builds
 * Mirrors the database interface but uses fetch.
 *
 * Backed by the centralized HttpClient from @/api.
 */

import { adminClient, API_BASE } from '@/api';

// GitHub Activity types
export interface GitHubActivityItem {
  id: string;
  project_id: string | null;
  type: 'commit' | 'pr' | 'issue';
  repo_name: string;
  sha: string | null;
  number: number | null;
  title: string | null;
  description: string | null;
  author: string;
  url: string;
  created_at: string;
  closed_at: string | null;
  merged_at: string | null;
  additions: number | null;
  deletions: number | null;
  estimated_minutes: number | null;
  imported_at: string;
}

export interface GitHubActivityStats {
  total: number;
  commits: number;
  prs: number;
  issues: number;
  total_additions: number;
  total_deletions: number;
  estimated_minutes: number;
}

export interface GitHubSyncResult {
  repo: string;
  commitsImported: number;
  prsImported: number;
  issuesImported: number;
  commitsSkipped: number;
  prsSkipped: number;
  issuesSkipped: number;
  errors: string[];
  duration: number;
}

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

  // Journal
  async getJournalEntries() {
    return this.request<{
      entries: Array<{
        date: string;
        filename: string;
        title: string;
        preview: string;
        lastModified: string;
        size: number;
      }>;
      total: number;
    }>('/second-brain/journal');
  }

  async getJournalEntry(date: string) {
    return this.request<{
      date: string;
      filename: string;
      title: string;
      content: string;
      lastModified: string;
      size: number;
    }>(`/second-brain/journal/${date}`);
  }

  // Research
  async getResearchNotes() {
    return this.request<{
      notes: Array<{
        filename: string;
        title: string;
        preview: string;
        date: string;
        lastModified: string;
        size: number;
        tags: string[];
      }>;
      total: number;
    }>('/second-brain/research');
  }

  async getResearchNote(filename: string) {
    return this.request<{
      filename: string;
      title: string;
      content: string;
      lastModified: string;
      size: number;
    }>(`/second-brain/research/${encodeURIComponent(filename)}`);
  }

  // Agent Memories
  async getAgentMemories() {
    return this.request<{
      agents: Array<{
        id: string;
        name: string;
        filename: string;
        lastModified: string;
        size: number;
        sections: { principles: number; decisions: number; preferences: number };
      }>;
      total: number;
    }>('/second-brain/agents');
  }

  async getAgentMemory(agentId: string) {
    return this.request<{
      id: string;
      name: string;
      content: string;
      lastModified: string;
      size: number;
      sections: { principles: number; decisions: number; preferences: number };
      isRootMemory: boolean;
    }>(`/second-brain/agents/${encodeURIComponent(agentId)}`);
  }

  // Conversations
  async getConversations(filters?: { agent?: string; limit?: number }) {
    const params = new URLSearchParams();
    if (filters?.agent) params.set('agent', filters.agent);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const query = params.toString();
    return this.request<{
      sessions: Array<{
        id: string;
        agent: string;
        timestamp: string;
        messageCount: number;
        size: number;
        isLong: boolean;
      }>;
      total: number;
      agents: string[];
    }>(`/second-brain/conversations${query ? `?${query}` : ''}`);
  }

  async getConversationTranscript(agent: string, sessionId: string) {
    return this.request<{
      id: string;
      agent: string;
      timestamp: string;
      messages: Array<{
        type: string;
        id: string;
        timestamp: string;
        role?: string;
        text?: string;
        toolName?: string;
      }>;
      totalLines: number;
      size: number;
    }>(`/second-brain/conversations/${encodeURIComponent(agent)}/${encodeURIComponent(sessionId)}`);
  }

  // Universal Brain Search
  async searchBrain(query: string, source?: string) {
    const params = new URLSearchParams({ q: query });
    if (source) params.set('source', source);
    return this.request<{
      results: Array<{
        type: "document" | "agent-memory" | "conversation";
        path: string;
        title: string;
        source: string;
        snippet: string;
        lastModified: string;
        score: number;
      }>;
      total: number;
      query: string;
    }>(`/second-brain/search?${params.toString()}`);
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
  async getGitHubRepos(): Promise<{ repos: Array<{ name: string; fullName: string; description: string; url: string; updatedAt: string }>; message?: string; authenticated?: boolean }> {
    return this.request('/github/repos');
  }

  // GitHub Commits (live from GitHub)
  async getGitHubCommits(repo: string, since?: string) {
    const params = new URLSearchParams({ repo });
    if (since) params.set('since', since);
    return this.request<{ repo: string; commits: unknown[]; count: number }>(`/github/commits?${params}`);
  }

  // GitHub PRs (live from GitHub)
  async getGitHubPulls(repo: string, state: string = 'all') {
    return this.request<{ repo: string; pulls: unknown[]; count: number }>(`/github/pulls?repo=${encodeURIComponent(repo)}&state=${state}`);
  }

  // GitHub Issues (live from GitHub)
  async getGitHubIssues(repo: string, state: string = 'all') {
    return this.request<{ repo: string; issues: unknown[]; count: number }>(`/github/issues?repo=${encodeURIComponent(repo)}&state=${state}`);
  }

  // GitHub Sync (import to DB)
  async syncGitHubRepo(repo: string, days: number = 7) {
    return this.request<{ success: boolean; result: GitHubSyncResult }>('/github/sync', {
      method: 'POST',
      body: JSON.stringify({ repo, days }),
    });
  }

  async syncAllGitHubRepos(days: number = 7) {
    return this.request<{ success: boolean; totalRepos: number; totalImported: number; results: GitHubSyncResult[] }>('/github/sync-all', {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
  }

  // GitHub Activity (from DB)
  async getGitHubActivity(filters?: { repo?: string; project_id?: string; days?: number }) {
    const params = new URLSearchParams();
    if (filters?.repo) params.set('repo', filters.repo);
    if (filters?.project_id) params.set('project_id', filters.project_id);
    if (filters?.days) params.set('days', String(filters.days));
    const query = params.toString();
    return this.request<{ activities: GitHubActivityItem[]; count: number }>(`/github/activity${query ? `?${query}` : ''}`);
  }

  async getGitHubProjectActivity(projectId: string, type?: string) {
    const params = type ? `?type=${type}` : '';
    return this.request<{
      projectId: string;
      activities: GitHubActivityItem[];
      stats: GitHubActivityStats;
      count: number;
    }>(`/github/activity/project/${projectId}${params}`);
  }

  // GitHub Sync Logs
  async getGitHubSyncLogs(limit: number = 20) {
    return this.request<{ logs: unknown[]; count: number }>(`/github/sync-logs?limit=${limit}`);
  }

  // GitHub Link to Project
  async linkGitHubRepo(projectId: string, repo: string) {
    return this.request<{ success: boolean; message: string }>('/github/link', {
      method: 'POST',
      body: JSON.stringify({ projectId, repo }),
    });
  }

  async unlinkGitHubRepo(projectId: string) {
    return this.request<{ success: boolean }>(`/github/link/${projectId}`, {
      method: 'DELETE',
    });
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

  // Agent Space
  async getAgents() {
    return this.request<{
      agents: Array<{
        id: string;
        name: string;
        emoji: string;
        role: string;
        color: string;
        status: "active" | "idle";
        sessionCount: number;
        fileCount: number;
        lastActivity: string | null;
      }>;
    }>('/agent-space');
  }

  async getAgentDetail(agentId: string) {
    return this.request<{
      id: string;
      name: string;
      emoji: string;
      role: string;
      color: string;
      status: "active" | "idle";
      sessionCount: number;
      lastActivity: string | null;
      files: Array<{
        name: string;
        path: string;
        category: string;
        title: string;
        size: number;
        lastModified: string;
        encrypted: boolean;
      }>;
    }>(`/agent-space/${encodeURIComponent(agentId)}`);
  }

  async getAgentFiles(agentId: string) {
    return this.request<{
      files: Array<{
        name: string;
        path: string;
        category: string;
        title: string;
        size: number;
        lastModified: string;
        encrypted: boolean;
      }>;
    }>(`/agent-space/${encodeURIComponent(agentId)}/files`);
  }

  async getAgentFileContent(agentId: string, category: string, filepath: string) {
    return this.request<{
      name: string;
      path: string;
      category: string;
      title: string;
      content: string;
      size: number;
      lastModified: string;
      encrypted: boolean;
    }>(`/agent-space/${encodeURIComponent(agentId)}/files/${encodeURIComponent(category)}/${filepath}`);
  }

  // Brain Activity
  async getBrainActivity(days: number = 7) {
    return this.request<{
      activities: Array<{
        type: "document" | "agent-memory" | "conversation";
        title: string;
        path: string;
        source: string;
        lastModified: string;
        action: "created" | "modified";
      }>;
      total: number;
      days: number;
    }>(`/second-brain/activity?days=${days}`);
  }

  async getSocialMediaStats() {
    return this.request<{
      total: number;
      byPlatform: Array<{ platform: string; status: string; count: number }>;
      upcoming: SocialMediaPost[];
    }>('/social-media/stats');
  }
}

export const api = new ApiClient();

// Re-export isWebBuild from centralized module
export { isWebBuild } from '@/api';
