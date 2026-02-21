/**
 * Zod validation schemas for Banking API endpoints.
 */

import { z } from 'zod';

// ============================================================================
// Bank Accounts
// ============================================================================

export const CreateBankAccountSchema = z.object({
  provider: z.string().optional().default('manual'),
  bank_name: z.string().nullable().optional(),
  iban: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  account_name: z.string().nullable().optional(),
  account_type: z.enum(['checking', 'savings', 'credit_card']).optional().default('checking'),
  currency: z.string().optional().default('EUR'),
}).strip();

export type CreateBankAccount = z.infer<typeof CreateBankAccountSchema>;

export const SyncBankAccountSchema = z.object({
  transactions: z.array(z.object({
    provider_transaction_id: z.string().nullable().optional(),
    amount: z.coerce.number(),
    currency: z.string().optional().default('EUR'),
    booking_date: z.string().min(1, 'booking_date is required'),
    value_date: z.string().nullable().optional(),
    counterpart_name: z.string().nullable().optional(),
    counterpart_iban: z.string().nullable().optional(),
    counterpart_bic: z.string().nullable().optional(),
    purpose: z.string().nullable().optional(),
    bank_reference: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
  })).optional().default([]),
}).strip();

export type SyncBankAccount = z.infer<typeof SyncBankAccountSchema>;

// ============================================================================
// Transactions
// ============================================================================

export const CreateBankTransactionSchema = z.object({
  account_id: z.string().min(1),
  amount: z.coerce.number(),
  booking_date: z.string().min(1),
  value_date: z.string().nullable().optional(),
  counterpart_name: z.string().nullable().optional(),
  counterpart_iban: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
}).strip();

export type CreateBankTransaction = z.infer<typeof CreateBankTransactionSchema>;

export const MatchTransactionSchema = z.object({
  match_type: z.enum(['invoice', 'expense', 'income']),
  matched_id: z.string().min(1, 'matched_id is required'),
}).strip();

export type MatchTransaction = z.infer<typeof MatchTransactionSchema>;

export const CreateExpenseFromTxSchema = z.object({
  category: z.string().min(1, 'category is required'),
  description: z.string().nullable().optional(),
  vat_rate: z.coerce.number().optional().default(19),
}).strip();

export type CreateExpenseFromTx = z.infer<typeof CreateExpenseFromTxSchema>;

export const CreateIncomeFromTxSchema = z.object({
  description: z.string().nullable().optional(),
  vat_rate: z.coerce.number().optional().default(19),
  client_id: z.string().nullable().optional(),
}).strip();

export type CreateIncomeFromTx = z.infer<typeof CreateIncomeFromTxSchema>;

// ============================================================================
// SEPA
// ============================================================================

export const GenerateSepaSchema = z.object({
  payments: z.array(z.object({
    recipient_name: z.string().min(1),
    recipient_iban: z.string().min(1),
    recipient_bic: z.string().nullable().optional(),
    amount: z.coerce.number().positive(),
    purpose: z.string().min(1),
    end_to_end_id: z.string().nullable().optional(),
  })).min(1, 'At least one payment is required'),
  debtor: z.object({
    name: z.string().min(1),
    iban: z.string().min(1),
    bic: z.string().min(1),
  }).nullable().optional(),
}).strip();

export type GenerateSepa = z.infer<typeof GenerateSepaSchema>;

// ============================================================================
// Booking Rules
// ============================================================================

export const CreateBookingRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  priority: z.coerce.number().int().optional().default(100),
  condition_direction: z.enum(['credit', 'debit']).nullable().optional(),
  condition_counterpart_pattern: z.string().nullable().optional(),
  condition_purpose_pattern: z.string().nullable().optional(),
  condition_amount_min: z.coerce.number().nullable().optional(),
  condition_amount_max: z.coerce.number().nullable().optional(),
  condition_iban_pattern: z.string().nullable().optional(),
  action_category: z.string().nullable().optional(),
  action_vat_rate: z.coerce.number().nullable().optional(),
  action_description_template: z.string().nullable().optional(),
  action_auto_confirm: z.coerce.number().int().min(0).max(1).optional().default(0),
  action_match_type: z.enum(['expense', 'income', 'ignore']).nullable().optional(),
}).strip();

export type CreateBookingRule = z.infer<typeof CreateBookingRuleSchema>;

export const UpdateBookingRuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  priority: z.coerce.number().int().optional(),
  is_active: z.coerce.number().int().min(0).max(1).optional(),
  condition_direction: z.enum(['credit', 'debit']).nullable().optional(),
  condition_counterpart_pattern: z.string().nullable().optional(),
  condition_purpose_pattern: z.string().nullable().optional(),
  condition_amount_min: z.coerce.number().nullable().optional(),
  condition_amount_max: z.coerce.number().nullable().optional(),
  condition_iban_pattern: z.string().nullable().optional(),
  action_category: z.string().nullable().optional(),
  action_vat_rate: z.coerce.number().nullable().optional(),
  action_description_template: z.string().nullable().optional(),
  action_auto_confirm: z.coerce.number().int().min(0).max(1).optional(),
  action_match_type: z.enum(['expense', 'income', 'ignore']).nullable().optional(),
}).strip();

export type UpdateBookingRule = z.infer<typeof UpdateBookingRuleSchema>;

export const TestBookingRuleSchema = z.object({
  rule: CreateBookingRuleSchema,
}).strip();

export type TestBookingRule = z.infer<typeof TestBookingRuleSchema>;

// ============================================================================
// Recurring Invoices
// ============================================================================

export const CreateRecurringInvoiceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  client_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  frequency: z.enum(['monthly', 'quarterly', 'yearly']).optional().default('monthly'),
  next_date: z.string().min(1, 'next_date is required'),
  end_date: z.string().nullable().optional(),
  vat_rate: z.coerce.number().optional().default(19),
  notes: z.string().nullable().optional(),
  payment_terms_days: z.coerce.number().int().optional().default(14),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unit: z.string().optional().default('hours'),
    unit_price: z.coerce.number(),
    vat_rate: z.coerce.number().optional(),
  })).min(1, 'At least one line item is required'),
  auto_send: z.coerce.number().int().min(0).max(1).optional().default(0),
  auto_generate: z.coerce.number().int().min(0).max(1).optional().default(1),
}).strip();

export type CreateRecurringInvoice = z.infer<typeof CreateRecurringInvoiceSchema>;

export const UpdateRecurringInvoiceSchema = z.object({
  name: z.string().min(1).optional(),
  client_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  frequency: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  next_date: z.string().optional(),
  end_date: z.string().nullable().optional(),
  vat_rate: z.coerce.number().optional(),
  notes: z.string().nullable().optional(),
  payment_terms_days: z.coerce.number().int().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.coerce.number().positive(),
    unit: z.string().optional().default('hours'),
    unit_price: z.coerce.number(),
    vat_rate: z.coerce.number().optional(),
  })).optional(),
  auto_send: z.coerce.number().int().min(0).max(1).optional(),
  auto_generate: z.coerce.number().int().min(0).max(1).optional(),
  is_active: z.coerce.number().int().min(0).max(1).optional(),
}).strip();

export type UpdateRecurringInvoice = z.infer<typeof UpdateRecurringInvoiceSchema>;

// ============================================================================
// Dunning
// ============================================================================

export const CreateDunningEntrySchema = z.object({
  invoice_id: z.string().min(1, 'invoice_id is required'),
  level: z.coerce.number().int().min(1).max(3).optional().default(1),
  due_date: z.string().nullable().optional(),
  fee: z.coerce.number().optional().default(0),
  interest_rate: z.coerce.number().optional().default(0),
  notes: z.string().nullable().optional(),
  delivery_method: z.enum(['email', 'post', 'manual']).optional().default('email'),
}).strip();

export type CreateDunningEntry = z.infer<typeof CreateDunningEntrySchema>;
