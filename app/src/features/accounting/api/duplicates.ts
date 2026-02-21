/**
 * Duplicates API Client
 *
 * Frontend API client for the duplicate detection endpoints.
 * Uses the centralized accountingClient for authenticated requests.
 */

import { accountingClient } from '@/api'

// ============================================================================
// Types
// ============================================================================

export interface DuplicateCandidate {
  id: string
  type: 'income' | 'expense'
  amount: number
  date: string
  partner: string
  description: string
  similarity_score: number
  matched_fields: string[]
}

export interface MarkedDuplicate {
  id: string
  type: 'income' | 'expense'
  amount: number
  date: string
  partner: string
  description: string
  duplicate_of_id: string
}

interface CheckResponse {
  record_id: string
  type: 'income' | 'expense'
  duplicates: DuplicateCandidate[]
  has_duplicates: boolean
}

interface ListResponse {
  duplicates: MarkedDuplicate[]
  total: number
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check if a record has potential duplicates.
 */
export async function checkForDuplicates(
  type: 'income' | 'expense',
  recordId: string,
): Promise<DuplicateCandidate[]> {
  const data = await accountingClient.get<CheckResponse>(
    `/duplicates/check/${type}/${recordId}`,
  )
  return data.duplicates
}

/**
 * Check for duplicates by field values (for new records not yet saved).
 * Uses the search endpoint with query params for inline form checking.
 */
export async function checkForDuplicatesByFields(
  type: 'income' | 'expense',
  amount: number,
  date: string,
  partner: string,
): Promise<DuplicateCandidate[]> {
  const params = new URLSearchParams({
    amount: String(amount),
    date,
    partner,
  })
  const data = await accountingClient.get<CheckResponse>(
    `/duplicates/check/${type}/new?${params.toString()}`,
  )
  return data.duplicates
}

/**
 * Mark a record as a duplicate of another record.
 */
export async function markAsDuplicate(
  type: 'income' | 'expense',
  recordId: string,
  duplicateOfId: string,
): Promise<void> {
  await accountingClient.post('/duplicates/mark', {
    type,
    recordId,
    duplicateOfId,
  })
}

/**
 * Unmark a record that was previously marked as a duplicate.
 */
export async function unmarkDuplicate(
  type: 'income' | 'expense',
  recordId: string,
): Promise<void> {
  await accountingClient.post('/duplicates/unmark', {
    type,
    recordId,
  })
}

/**
 * List all records currently marked as duplicates.
 * Optionally filter by type.
 */
export async function listMarkedDuplicates(
  type?: 'income' | 'expense',
): Promise<MarkedDuplicate[]> {
  const params = type ? `?type=${type}` : ''
  const data = await accountingClient.get<ListResponse>(
    `/duplicates/list${params}`,
  )
  return data.duplicates
}
