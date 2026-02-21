/**
 * Web-based Banking Service using REST API
 */

import { adminClient } from "@/api";

// ============================================================================
// Types
// ============================================================================

export interface BankAccount {
  id: string;
  provider: string;
  bank_name: string | null;
  iban: string | null;
  bic: string | null;
  account_name: string | null;
  account_type: string;
  balance: number;
  balance_date: string | null;
  currency: string;
  sync_status: string;
  last_sync_at: string | null;
  last_sync_error: string | null;
  is_active: number;
  created_at: string;
}

export interface BankTransaction {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  booking_date: string;
  value_date: string | null;
  counterpart_name: string | null;
  counterpart_iban: string | null;
  purpose: string | null;
  type: string | null;
  match_status: string;
  match_confidence: number | null;
  matched_invoice_id: string | null;
  matched_expense_id: string | null;
  matched_income_id: string | null;
  match_rule_id: string | null;
  category: string | null;
  vat_rate: number | null;
  booking_description: string | null;
  notes: string | null;
  bank_name?: string;
  account_iban?: string;
  created_at: string;
}

export interface BookingRule {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  is_active: number;
  condition_direction: string | null;
  condition_counterpart_pattern: string | null;
  condition_purpose_pattern: string | null;
  condition_amount_min: number | null;
  condition_amount_max: number | null;
  condition_iban_pattern: string | null;
  action_category: string | null;
  action_vat_rate: number | null;
  action_description_template: string | null;
  action_auto_confirm: number;
  action_match_type: string | null;
  match_count: number;
  last_matched_at: string | null;
}

export interface RecurringInvoice {
  id: string;
  name: string;
  client_id: string | null;
  project_id: string | null;
  frequency: string;
  next_date: string;
  last_generated_at: string | null;
  end_date: string | null;
  vat_rate: number;
  notes: string | null;
  payment_terms_days: number;
  items_json: string;
  auto_send: number;
  auto_generate: number;
  is_active: number;
  generated_count: number;
}

export interface DunningEntry {
  id: string;
  invoice_id: string;
  level: number;
  sent_date: string | null;
  due_date: string | null;
  fee: number;
  interest_rate: number;
  interest_amount: number;
  notes: string | null;
  delivery_method: string;
  status: string;
  invoice_number?: string;
  invoice_total?: number;
}

export interface AutoMatchResult {
  total_processed: number;
  matched: number;
  unmatched: number;
  matches: Array<{
    transaction_id: string;
    match_type: string;
    matched_id: string;
    confidence: number;
    reason: string;
  }>;
}

// ============================================================================
// Banking Service
// ============================================================================

class BankingService {
  // Bank Accounts
  async getAccounts(): Promise<BankAccount[]> {
    return adminClient.get('/banking/accounts');
  }

  async connectAccount(data: Partial<BankAccount>): Promise<BankAccount> {
    return adminClient.post('/banking/accounts/connect', data);
  }

  async syncAccount(id: string, transactions?: unknown[]): Promise<{ transactions_imported: number; duplicates_skipped: number }> {
    return adminClient.post(`/banking/accounts/${id}/sync`, { transactions: transactions || [] });
  }

  async deleteAccount(id: string): Promise<void> {
    return adminClient.delete(`/banking/accounts/${id}`);
  }

  // Transactions
  async getTransactions(filters?: Record<string, string>): Promise<BankTransaction[]> {
    const params = new URLSearchParams(filters).toString();
    return adminClient.get(`/banking/transactions${params ? `?${params}` : ''}`);
  }

  async getUnmatchedTransactions(): Promise<BankTransaction[]> {
    return adminClient.get('/banking/transactions/unmatched');
  }

  async matchTransaction(id: string, matchType: string, matchedId: string): Promise<BankTransaction> {
    return adminClient.post(`/banking/transactions/${id}/match`, { match_type: matchType, matched_id: matchedId });
  }

  async autoMatch(): Promise<AutoMatchResult> {
    return adminClient.post('/banking/transactions/auto-match', {});
  }

  async ignoreTransaction(id: string, reason?: string): Promise<BankTransaction> {
    return adminClient.post(`/banking/transactions/${id}/ignore`, { reason });
  }

  async createExpenseFromTransaction(id: string, data: { category: string; description?: string; vat_rate?: number }): Promise<unknown> {
    return adminClient.post(`/banking/transactions/${id}/create-expense`, data);
  }

  async createIncomeFromTransaction(id: string, data: { description?: string; vat_rate?: number; client_id?: string }): Promise<unknown> {
    return adminClient.post(`/banking/transactions/${id}/create-income`, data);
  }

  // SEPA
  async generateSepa(payments: Array<{ recipient_name: string; recipient_iban: string; amount: number; purpose: string }>, debtor?: { name: string; iban: string; bic: string }): Promise<Blob> {
    const response = await fetch(`${(window as any).__API_BASE || '/api'}/banking/sepa/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(adminClient as any).getAuthHeaders?.() },
      body: JSON.stringify({ payments, debtor }),
    });
    return response.blob();
  }

  // Booking Rules
  async getRules(): Promise<BookingRule[]> {
    return adminClient.get('/booking-rules');
  }

  async createRule(data: Partial<BookingRule>): Promise<BookingRule> {
    return adminClient.post('/booking-rules', data);
  }

  async updateRule(id: string, data: Partial<BookingRule>): Promise<BookingRule> {
    return adminClient.patch(`/booking-rules/${id}`, data);
  }

  async deleteRule(id: string): Promise<void> {
    return adminClient.delete(`/booking-rules/${id}`);
  }

  async testRule(rule: Partial<BookingRule>): Promise<{ total_unmatched: number; would_match: number; matches: unknown[] }> {
    return adminClient.post('/booking-rules/test', { rule });
  }

  // Recurring Invoices
  async getRecurringInvoices(): Promise<RecurringInvoice[]> {
    return adminClient.get('/invoices/recurring');
  }

  async createRecurringInvoice(data: unknown): Promise<RecurringInvoice> {
    return adminClient.post('/invoices/recurring', data);
  }

  async updateRecurringInvoice(id: string, data: unknown): Promise<RecurringInvoice> {
    return adminClient.patch(`/invoices/recurring/${id}`, data);
  }

  async deleteRecurringInvoice(id: string): Promise<void> {
    return adminClient.delete(`/invoices/recurring/${id}`);
  }

  async generateFromRecurring(id: string): Promise<unknown> {
    return adminClient.post(`/invoices/recurring/${id}/generate`, {});
  }

  async processRecurring(): Promise<{ processed: number; generated: number; results: unknown[] }> {
    return adminClient.post('/invoices/recurring/process', {});
  }

  // Dunning
  async getDunningEntries(invoiceId?: string): Promise<DunningEntry[]> {
    const params = invoiceId ? `?invoice_id=${invoiceId}` : '';
    return adminClient.get(`/dunning${params}`);
  }

  async getOverdueInvoices(): Promise<unknown[]> {
    return adminClient.get('/dunning/overdue');
  }

  async createDunning(data: { invoice_id: string; level?: number; fee?: number; interest_rate?: number; notes?: string }): Promise<DunningEntry> {
    return adminClient.post('/dunning', data);
  }

  async sendDunning(id: string): Promise<DunningEntry> {
    return adminClient.post(`/dunning/${id}/send`, {});
  }

  async getDunningTemplates(): Promise<Record<number, { subject: string; body: string }>> {
    return adminClient.get('/dunning/templates');
  }
}

export const bankingService = new BankingService();
