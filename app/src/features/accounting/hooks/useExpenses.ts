/**
 * useExpenses Hook
 *
 * React hook for managing expense state and operations.
 * Provides CRUD operations with loading and error states.
 * Includes Vorsteuer (input VAT) tracking and GWG detection.
 * 
 * Uses REST API via expensesService for web deployments.
 */

import { useState, useCallback, useEffect } from 'react'
import type { Expense, NewExpense } from '../types'
import { expensesService } from '@/services/web/expensesService'

export interface UseExpensesOptions {
  /** Auto-fetch expenses on mount */
  autoFetch?: boolean
  /** Filter by date range */
  dateRange?: { start: Date; end: Date }
  /** Filter by USt period */
  ustPeriod?: string
  /** Filter by category */
  category?: string
  /** Filter by recurring status */
  recurring?: boolean
}

export interface VorsteuerSummary {
  total: number
  byCategory: Record<string, number>
  byVatRate: Record<number, number>
}

export interface UseExpensesReturn {
  /** List of expense records */
  expenses: Expense[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Fetch all expense records */
  fetchExpenses: () => Promise<void>
  /** Fetch expenses by date range */
  fetchByDateRange: (start: Date, end: Date) => Promise<void>
  /** Fetch expenses by USt period */
  fetchByUstPeriod: (period: string) => Promise<void>
  /** Fetch expenses by category */
  fetchByCategory: (category: string) => Promise<void>
  /** Create a new expense record */
  createExpense: (data: NewExpense) => Promise<Expense | null>
  /** Update an existing expense record */
  updateExpense: (id: string, data: Partial<NewExpense>) => Promise<Expense | null>
  /** Delete an expense record */
  deleteExpense: (id: string) => Promise<boolean>
  /** Mark expenses as Vorsteuer claimed */
  markVorsteuerClaimed: (ids: string[]) => Promise<void>
  /** Get recurring expenses */
  getRecurringExpenses: () => Promise<Expense[]>
  /** Get GWG expenses */
  getGwgExpenses: () => Promise<Expense[]>
  /** Get Vorsteuer summary statistics */
  getVorsteuerSummary: (start: Date, end: Date) => Promise<VorsteuerSummary | null>
  /** Currently selected expense record */
  selectedExpense: Expense | null
  /** Set selected expense record */
  setSelectedExpense: (expense: Expense | null) => void
  /** Refresh the expense list */
  refresh: () => Promise<void>
}

/**
 * Hook for managing expense records
 */
export function useExpenses(options: UseExpensesOptions = {}): UseExpensesReturn {
  const { autoFetch = true, dateRange, ustPeriod, category, recurring: _recurring } = options

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)

  /**
   * Fetch all expense records
   */
  const fetchExpenses = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await expensesService.getAll()
      setExpenses(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch expenses')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch expenses by date range
   */
  const fetchByDateRange = useCallback(async (start: Date, end: Date) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await expensesService.getAll({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      })
      setExpenses(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch expenses')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch expenses by USt period
   * Note: REST API doesn't support ustPeriod filter, so we fetch all and filter client-side
   */
  const fetchByUstPeriod = useCallback(async (period: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await expensesService.getAll()
      const filtered = data.filter(e => e.ustPeriod === period)
      setExpenses(filtered)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch expenses')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch expenses by category
   */
  const fetchByCategory = useCallback(async (cat: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await expensesService.getAll({ category: cat })
      setExpenses(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch expenses')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Create a new expense record
   */
  const createExpense = useCallback(async (data: NewExpense): Promise<Expense | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const newExpense = await expensesService.create(data)
      setExpenses((prev) => [newExpense, ...prev])
      return newExpense
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create expense')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Update an existing expense record
   */
  const updateExpense = useCallback(
    async (id: string, data: Partial<NewExpense>): Promise<Expense | null> => {
      setIsLoading(true)
      setError(null)

      try {
        await expensesService.update(id, data)
        // Re-fetch the updated expense
        const updated = await expensesService.getById(id)
        if (updated) {
          setExpenses((prev) =>
            prev.map((item) => (item.id === id ? updated : item))
          )
          if (selectedExpense?.id === id) {
            setSelectedExpense(updated)
          }
        }
        return updated
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update expense')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [selectedExpense]
  )

  /**
   * Delete an expense record
   */
  const deleteExpense = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        await expensesService.delete(id)
        setExpenses((prev) => prev.filter((item) => item.id !== id))
        if (selectedExpense?.id === id) {
          setSelectedExpense(null)
        }
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete expense')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [selectedExpense]
  )

  /**
   * Mark expenses as Vorsteuer claimed
   */
  const markVorsteuerClaimed = useCallback(async (ids: string[]) => {
    setIsLoading(true)
    setError(null)

    try {
      await expensesService.markReported(ids)
      setExpenses((prev) =>
        prev.map((item) =>
          ids.includes(item.id) ? { ...item, vorsteuerClaimed: true } : item
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as claimed')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Get recurring expenses
   */
  const getRecurringExpenses = useCallback(async (): Promise<Expense[]> => {
    try {
      const data = await expensesService.getAll()
      return data.filter(e => e.isRecurring)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get recurring expenses')
      return []
    }
  }, [])

  /**
   * Get GWG expenses
   */
  const getGwgExpenses = useCallback(async (): Promise<Expense[]> => {
    try {
      const data = await expensesService.getAll()
      return data.filter(e => e.isGwg)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get GWG expenses')
      return []
    }
  }, [])

  /**
   * Get Vorsteuer summary statistics for a date range
   */
  const getVorsteuerSummary = useCallback(
    async (start: Date, end: Date): Promise<VorsteuerSummary | null> => {
      try {
        const rows = await expensesService.getAll({
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        })

        const summary = {
          total: 0,
          byCategory: {} as Record<string, number>,
          byVatRate: {} as Record<number, number>,
        }

        for (const expense of rows) {
          summary.total += expense.vatAmount

          if (!summary.byCategory[expense.euerCategory]) {
            summary.byCategory[expense.euerCategory] = 0
          }
          summary.byCategory[expense.euerCategory] += expense.vatAmount

          if (!summary.byVatRate[expense.vatRate]) {
            summary.byVatRate[expense.vatRate] = 0
          }
          summary.byVatRate[expense.vatRate] += expense.vatAmount
        }

        return summary
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get Vorsteuer summary')
        return null
      }
    },
    []
  )

  /**
   * Refresh the expense list based on current filters
   */
  const refresh = useCallback(async () => {
    if (dateRange) {
      await fetchByDateRange(dateRange.start, dateRange.end)
    } else if (ustPeriod) {
      await fetchByUstPeriod(ustPeriod)
    } else if (category) {
      await fetchByCategory(category)
    } else {
      await fetchExpenses()
    }
  }, [dateRange, ustPeriod, category, fetchByDateRange, fetchByUstPeriod, fetchByCategory, fetchExpenses])

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  return {
    expenses,
    isLoading,
    error,
    fetchExpenses,
    fetchByDateRange,
    fetchByUstPeriod,
    fetchByCategory,
    createExpense,
    updateExpense,
    deleteExpense,
    markVorsteuerClaimed,
    getRecurringExpenses,
    getGwgExpenses,
    getVorsteuerSummary,
    selectedExpense,
    setSelectedExpense,
    refresh,
  }
}

export default useExpenses
