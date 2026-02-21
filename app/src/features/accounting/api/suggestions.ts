/**
 * Smart Suggestions API Client
 *
 * Fetches context-aware recommendations for form prefilling.
 * Backend routes (Sprint 5.3):
 *   GET /api/smart-suggestions/expense?vendor=
 *   GET /api/smart-suggestions/income
 *   GET /api/smart-suggestions/invoice?clientId=
 *   GET /api/smart-suggestions/invoice-number
 */

import { accountingClient } from '@/api'

// ============================================================================
// Types (mirroring backend SmartSuggestions interface)
// ============================================================================

export interface VendorSuggestion {
  vendor: string
  count: number
  lastAmount: number
}

export interface ClientSuggestion {
  client: string
  count: number
  lastAmount: number
}

export interface ExpenseSuggestions {
  recentVendors?: VendorSuggestion[]
  suggestedCategory?: string
  categoryConfidence?: number
  suggestedVatRate?: number
  suggestedPaymentMethod?: string
}

export interface IncomeSuggestions {
  recentClients?: ClientSuggestion[]
}

export interface InvoiceSuggestions {
  nextInvoiceNumber?: string
  invoiceNumberPattern?: string
  suggestedPaymentTerms?: number
  suggestedDueDate?: string
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get expense suggestions, optionally for a specific vendor.
 * When vendor is provided, returns vendor-specific category, VAT rate, etc.
 */
export async function getExpenseSuggestions(
  vendor?: string
): Promise<ExpenseSuggestions> {
  const params = vendor ? `?vendor=${encodeURIComponent(vendor)}` : ''
  return accountingClient.request<ExpenseSuggestions>(
    `/smart-suggestions/expense${params}`
  )
}

/**
 * Get income suggestions (recent clients, etc.)
 */
export async function getIncomeSuggestions(): Promise<IncomeSuggestions> {
  return accountingClient.request<IncomeSuggestions>(
    '/smart-suggestions/income'
  )
}

/**
 * Get invoice suggestions, optionally for a specific client.
 * Returns next invoice number, payment terms, due date.
 */
export async function getInvoiceSuggestions(
  clientId?: string
): Promise<InvoiceSuggestions> {
  const params = clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''
  return accountingClient.request<InvoiceSuggestions>(
    `/smart-suggestions/invoice${params}`
  )
}

/**
 * Get just the next invoice number.
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const result = await accountingClient.request<{ nextInvoiceNumber: string }>(
    '/smart-suggestions/invoice-number'
  )
  return result.nextInvoiceNumber
}
