/**
 * useTransactionMatch Hook
 *
 * Manages transaction matching operations: auto-match, manual match,
 * ignore, create expense/income from transaction.
 */

import { useState, useCallback } from 'react'
import {
  autoMatchTransactions,
  matchTransaction,
  ignoreTransaction,
  createExpenseFromTransaction,
  createIncomeFromTransaction,
} from '../api/banking'
import type { AutoMatchResult, BankTransaction } from '../api/banking'

export type MatchAction =
  | 'match_invoice'
  | 'match_expense'
  | 'match_income'
  | 'create_expense'
  | 'create_income'
  | 'ignore'

export interface MatchData {
  action: MatchAction
  matchedId?: string
  category?: string
  description?: string
  vatRate?: number
  clientId?: string
  reason?: string
}

export interface UseTransactionMatchReturn {
  isMatching: boolean
  error: string | null
  lastAutoMatchResult: AutoMatchResult | null
  autoMatch: () => Promise<AutoMatchResult | null>
  manualMatch: (txId: string, data: MatchData) => Promise<boolean>
  ignoreTransactions: (txIds: string[], reason?: string) => Promise<number>
  bulkAcceptSuggestions: (txIds: string[]) => Promise<number>
}

export function useTransactionMatch(
  onSuccess?: () => void
): UseTransactionMatchReturn {
  const [isMatching, setIsMatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAutoMatchResult, setLastAutoMatchResult] = useState<AutoMatchResult | null>(null)

  const autoMatch = useCallback(async (): Promise<AutoMatchResult | null> => {
    setIsMatching(true)
    setError(null)
    try {
      const result = await autoMatchTransactions()
      setLastAutoMatchResult(result)
      onSuccess?.()
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-Match fehlgeschlagen')
      return null
    } finally {
      setIsMatching(false)
    }
  }, [onSuccess])

  const manualMatch = useCallback(
    async (txId: string, data: MatchData): Promise<boolean> => {
      setIsMatching(true)
      setError(null)
      try {
        switch (data.action) {
          case 'match_invoice':
          case 'match_expense':
          case 'match_income':
            if (!data.matchedId) throw new Error('Zuordnungs-ID erforderlich')
            await matchTransaction(txId, data.action.replace('match_', ''), data.matchedId)
            break

          case 'create_expense':
            await createExpenseFromTransaction(txId, {
              category: data.category || 'other',
              description: data.description,
              vat_rate: data.vatRate,
            })
            break

          case 'create_income':
            await createIncomeFromTransaction(txId, {
              description: data.description,
              vat_rate: data.vatRate,
              client_id: data.clientId,
            })
            break

          case 'ignore':
            await ignoreTransaction(txId, data.reason)
            break
        }
        onSuccess?.()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Zuordnung fehlgeschlagen')
        return false
      } finally {
        setIsMatching(false)
      }
    },
    [onSuccess]
  )

  const ignoreTransactions = useCallback(
    async (txIds: string[], reason?: string): Promise<number> => {
      setIsMatching(true)
      setError(null)
      let count = 0
      try {
        for (const txId of txIds) {
          try {
            await ignoreTransaction(txId, reason)
            count++
          } catch {
            // Continue with remaining
          }
        }
        onSuccess?.()
        return count
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Ignorieren')
        return count
      } finally {
        setIsMatching(false)
      }
    },
    [onSuccess]
  )

  const bulkAcceptSuggestions = useCallback(
    async (txIds: string[]): Promise<number> => {
      setIsMatching(true)
      setError(null)
      let count = 0
      try {
        // Auto-match will handle these; for now just run auto-match
        const result = await autoMatchTransactions()
        count = result.matched
        onSuccess?.()
        return count
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Akzeptieren')
        return count
      } finally {
        setIsMatching(false)
      }
    },
    [onSuccess]
  )

  return {
    isMatching,
    error,
    lastAutoMatchResult,
    autoMatch,
    manualMatch,
    ignoreTransactions,
    bulkAcceptSuggestions,
  }
}
