/**
 * useIncome Hook
 *
 * React hook for managing income state and operations.
 * Provides CRUD operations with loading and error states.
 */

import { useState, useCallback, useEffect } from 'react'
import type { Income, NewIncome } from '../types'
import * as incomeApi from '../api/income'

export interface UseIncomeOptions {
  /** Auto-fetch income on mount */
  autoFetch?: boolean
  /** Filter by date range */
  dateRange?: { start: Date; end: Date }
  /** Filter by USt period */
  ustPeriod?: string
}

export interface UseIncomeReturn {
  /** List of income records */
  income: Income[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Fetch all income records */
  fetchIncome: () => Promise<void>
  /** Fetch income by date range */
  fetchByDateRange: (start: Date, end: Date) => Promise<void>
  /** Fetch income by USt period */
  fetchByUstPeriod: (period: string) => Promise<void>
  /** Create a new income record */
  createIncome: (data: NewIncome) => Promise<Income | null>
  /** Update an existing income record */
  updateIncome: (id: string, data: Partial<NewIncome>) => Promise<Income | null>
  /** Delete an income record */
  deleteIncome: (id: string) => Promise<boolean>
  /** Mark income as reported for USt */
  markAsReported: (ids: string[]) => Promise<void>
  /** Get summary statistics */
  getSummary: (start: Date, end: Date) => Promise<{
    totalNet: number
    totalVat: number
    totalGross: number
    count: number
    byVatRate: Record<number, { net: number; vat: number }>
  } | null>
  /** Currently selected income record */
  selectedIncome: Income | null
  /** Set selected income record */
  setSelectedIncome: (income: Income | null) => void
  /** Refresh the income list */
  refresh: () => Promise<void>
}

/**
 * Hook for managing income records
 */
export function useIncome(options: UseIncomeOptions = {}): UseIncomeReturn {
  const { autoFetch = true, dateRange, ustPeriod } = options

  const [income, setIncome] = useState<Income[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null)

  /**
   * Fetch all income records
   */
  const fetchIncome = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await incomeApi.getAllIncome()
      setIncome(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch income')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch income by date range
   */
  const fetchByDateRange = useCallback(async (start: Date, end: Date) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await incomeApi.getIncomeByDateRange(start, end)
      setIncome(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch income')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch income by USt period
   */
  const fetchByUstPeriod = useCallback(async (period: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await incomeApi.getIncomeByUstPeriod(period)
      setIncome(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch income')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Create a new income record
   */
  const createIncome = useCallback(async (data: NewIncome): Promise<Income | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const newIncome = await incomeApi.createIncome(data)
      setIncome((prev) => [newIncome, ...prev])
      return newIncome
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create income')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Update an existing income record
   */
  const updateIncome = useCallback(
    async (id: string, data: Partial<NewIncome>): Promise<Income | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const updated = await incomeApi.updateIncome(id, data)
        if (updated) {
          setIncome((prev) =>
            prev.map((item) => (item.id === id ? updated : item))
          )
          if (selectedIncome?.id === id) {
            setSelectedIncome(updated)
          }
        }
        return updated
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update income')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [selectedIncome]
  )

  /**
   * Delete an income record
   */
  const deleteIncome = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const success = await incomeApi.deleteIncome(id)
        if (success) {
          setIncome((prev) => prev.filter((item) => item.id !== id))
          if (selectedIncome?.id === id) {
            setSelectedIncome(null)
          }
        }
        return success
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete income')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [selectedIncome]
  )

  /**
   * Mark income records as reported for USt
   */
  const markAsReported = useCallback(async (ids: string[]) => {
    setIsLoading(true)
    setError(null)

    try {
      await incomeApi.markIncomeAsReported(ids)
      setIncome((prev) =>
        prev.map((item) =>
          ids.includes(item.id) ? { ...item, ustReported: true } : item
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as reported')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Get summary statistics for a date range
   */
  const getSummary = useCallback(
    async (start: Date, end: Date) => {
      try {
        return await incomeApi.getIncomeSummary(start, end)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get summary')
        return null
      }
    },
    []
  )

  /**
   * Refresh the income list based on current filters
   */
  const refresh = useCallback(async () => {
    if (dateRange) {
      await fetchByDateRange(dateRange.start, dateRange.end)
    } else if (ustPeriod) {
      await fetchByUstPeriod(ustPeriod)
    } else {
      await fetchIncome()
    }
  }, [dateRange, ustPeriod, fetchByDateRange, fetchByUstPeriod, fetchIncome])

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  return {
    income,
    isLoading,
    error,
    fetchIncome,
    fetchByDateRange,
    fetchByUstPeriod,
    createIncome,
    updateIncome,
    deleteIncome,
    markAsReported,
    getSummary,
    selectedIncome,
    setSelectedIncome,
    refresh,
  }
}

export default useIncome
