/**
 * useBankTransactions Hook
 *
 * Manages bank transaction state: listing, filtering, and pagination.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  getBankTransactions,
  getUnmatchedTransactions,
} from '../api/banking'
import type { BankTransaction } from '../api/banking'

export interface TransactionFilters {
  accountId?: string
  matchStatus?: string
  dateFrom?: string
  dateTo?: string
  amountMin?: number
  amountMax?: number
  searchTerm?: string
}

export interface UseBankTransactionsReturn {
  transactions: BankTransaction[]
  filteredTransactions: BankTransaction[]
  unmatchedTransactions: BankTransaction[]
  isLoading: boolean
  error: string | null
  filters: TransactionFilters
  setFilters: (filters: TransactionFilters) => void
  fetchTransactions: (apiFilters?: Record<string, string>) => Promise<void>
  fetchUnmatched: () => Promise<void>
  unmatchedCount: number
  matchedCount: number
  totalCount: number
  page: number
  setPage: (page: number) => void
  pageSize: number
  setPageSize: (size: number) => void
  paginatedTransactions: BankTransaction[]
  totalPages: number
  refresh: () => Promise<void>
}

export function useBankTransactions(): UseBankTransactionsReturn {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [unmatchedTransactions, setUnmatchedTransactions] = useState<BankTransaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const fetchTransactions = useCallback(async (apiFilters?: Record<string, string>) => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getBankTransactions(apiFilters)
      setTransactions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Transaktionen')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchUnmatched = useCallback(async () => {
    try {
      const data = await getUnmatchedTransactions()
      setUnmatchedTransactions(data)
    } catch (err) {
      console.error('Failed to fetch unmatched transactions:', err)
    }
  }, [])

  // Client-side filtering
  const filteredTransactions = useMemo(() => {
    let result = transactions

    if (filters.accountId) {
      result = result.filter((tx) => tx.account_id === filters.accountId)
    }

    if (filters.matchStatus && filters.matchStatus !== 'all') {
      result = result.filter((tx) => tx.match_status === filters.matchStatus)
    }

    if (filters.dateFrom) {
      result = result.filter((tx) => tx.booking_date >= filters.dateFrom!)
    }

    if (filters.dateTo) {
      result = result.filter((tx) => tx.booking_date <= filters.dateTo!)
    }

    if (filters.amountMin !== undefined) {
      result = result.filter((tx) => Math.abs(tx.amount) >= filters.amountMin!)
    }

    if (filters.amountMax !== undefined) {
      result = result.filter((tx) => Math.abs(tx.amount) <= filters.amountMax!)
    }

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      result = result.filter(
        (tx) =>
          tx.counterpart_name?.toLowerCase().includes(term) ||
          tx.purpose?.toLowerCase().includes(term) ||
          String(tx.amount).includes(term)
      )
    }

    return result
  }, [transactions, filters])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize))

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredTransactions.slice(start, start + pageSize)
  }, [filteredTransactions, page, pageSize])

  // Counts
  const unmatchedCount = transactions.filter((tx) => tx.match_status === 'unmatched').length
  const matchedCount = transactions.filter(
    (tx) => tx.match_status === 'manual_matched' || tx.match_status === 'auto_matched' || tx.match_status === 'booked'
  ).length
  const totalCount = transactions.length

  const refresh = useCallback(async () => {
    await Promise.all([fetchTransactions(), fetchUnmatched()])
  }, [fetchTransactions, fetchUnmatched])

  useEffect(() => {
    fetchTransactions()
    fetchUnmatched()
  }, [fetchTransactions, fetchUnmatched])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filters])

  return {
    transactions,
    filteredTransactions,
    unmatchedTransactions,
    isLoading,
    error,
    filters,
    setFilters,
    fetchTransactions,
    fetchUnmatched,
    unmatchedCount,
    matchedCount,
    totalCount,
    page,
    setPage,
    pageSize,
    setPageSize,
    paginatedTransactions,
    totalPages,
    refresh,
  }
}
