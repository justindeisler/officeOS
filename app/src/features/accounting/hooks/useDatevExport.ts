/**
 * useDatevExport Hook
 *
 * React hook for managing DATEV export state and operations.
 * Provides a clean interface for the export dialog components.
 */

import { useState, useCallback, useMemo } from 'react'
import type {
  DatevExportOptions,
  DatevExportPreview,
  DatevExportResult,
  ChartOfAccounts,
  ExportFormat,
  ExportPeriod,
} from '../types/datev'
import { getPeriodDates, getMonthDates } from '../utils/datev-csv'

// ============================================================================
// TYPES
// ============================================================================

export interface DatevExportState {
  /** Selected period type */
  periodType: ExportPeriod

  /** Selected year */
  year: number

  /** Selected quarter (1-4) for quarterly exports */
  quarter: 1 | 2 | 3 | 4

  /** Selected month (1-12) for monthly exports */
  month: number

  /** Custom start date */
  customStartDate: Date | null

  /** Custom end date */
  customEndDate: Date | null

  /** Selected chart of accounts */
  chartOfAccounts: ChartOfAccounts

  /** Export format */
  format: ExportFormat

  /** Consultant number (Beraternummer) */
  consultantNumber: string

  /** Client number (Mandantennummer) */
  clientNumber: string

  /** Include income transactions */
  includeIncome: boolean

  /** Include expense transactions */
  includeExpenses: boolean

  /** Include depreciation entries */
  includeDepreciation: boolean
}

export interface UseDatevExportReturn {
  /** Current export state */
  state: DatevExportState

  /** Computed export options based on state */
  exportOptions: DatevExportOptions

  /** Update period type */
  setPeriodType: (type: ExportPeriod) => void

  /** Update year */
  setYear: (year: number) => void

  /** Update quarter */
  setQuarter: (quarter: 1 | 2 | 3 | 4) => void

  /** Update month */
  setMonth: (month: number) => void

  /** Update custom date range */
  setCustomDateRange: (start: Date | null, end: Date | null) => void

  /** Update chart of accounts */
  setChartOfAccounts: (chart: ChartOfAccounts) => void

  /** Update export format */
  setFormat: (format: ExportFormat) => void

  /** Update consultant number */
  setConsultantNumber: (number: string) => void

  /** Update client number */
  setClientNumber: (number: string) => void

  /** Toggle include income */
  toggleIncludeIncome: () => void

  /** Toggle include expenses */
  toggleIncludeExpenses: () => void

  /** Toggle include depreciation */
  toggleIncludeDepreciation: () => void

  /** Reset to default state */
  reset: () => void

  /** Validation errors */
  validationErrors: string[]

  /** Whether the current configuration is valid */
  isValid: boolean
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

const currentYear = new Date().getFullYear()
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3) as 1 | 2 | 3 | 4

const defaultState: DatevExportState = {
  periodType: 'quarter',
  year: currentYear,
  quarter: currentQuarter > 1 ? ((currentQuarter - 1) as 1 | 2 | 3 | 4) : 4,
  month: new Date().getMonth() || 12,
  customStartDate: null,
  customEndDate: null,
  chartOfAccounts: 'SKR03',
  format: 'csv',
  consultantNumber: '',
  clientNumber: '',
  includeIncome: true,
  includeExpenses: true,
  includeDepreciation: true,
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useDatevExport(
  initialState: Partial<DatevExportState> = {}
): UseDatevExportReturn {
  const [state, setState] = useState<DatevExportState>({
    ...defaultState,
    ...initialState,
  })

  // Calculate date range based on period type
  const dateRange = useMemo(() => {
    switch (state.periodType) {
      case 'month':
        return getMonthDates(state.year, state.month)
      case 'quarter':
        return getPeriodDates(state.year, `Q${state.quarter}` as 'Q1' | 'Q2' | 'Q3' | 'Q4')
      case 'year':
        return getPeriodDates(state.year, 'year')
      case 'custom':
        return {
          startDate: state.customStartDate || new Date(state.year, 0, 1),
          endDate: state.customEndDate || new Date(state.year, 11, 31),
        }
      default:
        return getPeriodDates(state.year, 'year')
    }
  }, [
    state.periodType,
    state.year,
    state.month,
    state.quarter,
    state.customStartDate,
    state.customEndDate,
  ])

  // Build export options from state
  const exportOptions: DatevExportOptions = useMemo(
    () => ({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      chartOfAccounts: state.chartOfAccounts,
      format: state.format,
      consultantNumber: state.consultantNumber || undefined,
      clientNumber: state.clientNumber || undefined,
      includeIncome: state.includeIncome,
      includeExpenses: state.includeExpenses,
      includeDepreciation: state.includeDepreciation,
    }),
    [dateRange, state]
  )

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = []

    if (state.periodType === 'custom') {
      if (!state.customStartDate) {
        errors.push('Start date is required for custom period')
      }
      if (!state.customEndDate) {
        errors.push('End date is required for custom period')
      }
      if (
        state.customStartDate &&
        state.customEndDate &&
        state.customStartDate > state.customEndDate
      ) {
        errors.push('Start date must be before end date')
      }
    }

    if (!state.includeIncome && !state.includeExpenses && !state.includeDepreciation) {
      errors.push('At least one transaction type must be selected')
    }

    return errors
  }, [state])

  const isValid = validationErrors.length === 0

  // Actions
  const setPeriodType = useCallback((periodType: ExportPeriod) => {
    setState((prev) => ({ ...prev, periodType }))
  }, [])

  const setYear = useCallback((year: number) => {
    setState((prev) => ({ ...prev, year }))
  }, [])

  const setQuarter = useCallback((quarter: 1 | 2 | 3 | 4) => {
    setState((prev) => ({ ...prev, quarter }))
  }, [])

  const setMonth = useCallback((month: number) => {
    setState((prev) => ({ ...prev, month }))
  }, [])

  const setCustomDateRange = useCallback(
    (customStartDate: Date | null, customEndDate: Date | null) => {
      setState((prev) => ({ ...prev, customStartDate, customEndDate }))
    },
    []
  )

  const setChartOfAccounts = useCallback((chartOfAccounts: ChartOfAccounts) => {
    setState((prev) => ({ ...prev, chartOfAccounts }))
  }, [])

  const setFormat = useCallback((format: ExportFormat) => {
    setState((prev) => ({ ...prev, format }))
  }, [])

  const setConsultantNumber = useCallback((consultantNumber: string) => {
    setState((prev) => ({ ...prev, consultantNumber }))
  }, [])

  const setClientNumber = useCallback((clientNumber: string) => {
    setState((prev) => ({ ...prev, clientNumber }))
  }, [])

  const toggleIncludeIncome = useCallback(() => {
    setState((prev) => ({ ...prev, includeIncome: !prev.includeIncome }))
  }, [])

  const toggleIncludeExpenses = useCallback(() => {
    setState((prev) => ({ ...prev, includeExpenses: !prev.includeExpenses }))
  }, [])

  const toggleIncludeDepreciation = useCallback(() => {
    setState((prev) => ({ ...prev, includeDepreciation: !prev.includeDepreciation }))
  }, [])

  const reset = useCallback(() => {
    setState(defaultState)
  }, [])

  return {
    state,
    exportOptions,
    setPeriodType,
    setYear,
    setQuarter,
    setMonth,
    setCustomDateRange,
    setChartOfAccounts,
    setFormat,
    setConsultantNumber,
    setClientNumber,
    toggleIncludeIncome,
    toggleIncludeExpenses,
    toggleIncludeDepreciation,
    reset,
    validationErrors,
    isValid,
  }
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Available years for export (current and past 5 years)
 */
export function useAvailableYears(): number[] {
  return useMemo(() => {
    const years: number[] = []
    const current = new Date().getFullYear()
    for (let i = 0; i < 6; i++) {
      years.push(current - i)
    }
    return years
  }, [])
}

/**
 * Month options for selection
 */
export function useMonthOptions(): Array<{ value: number; label: string }> {
  return useMemo(() => {
    const months = [
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember',
    ]
    return months.map((label, index) => ({
      value: index + 1,
      label,
    }))
  }, [])
}

/**
 * Quarter options for selection
 */
export function useQuarterOptions(): Array<{ value: 1 | 2 | 3 | 4; label: string }> {
  return useMemo(
    () => [
      { value: 1 as const, label: 'Q1 (Jan - Mär)' },
      { value: 2 as const, label: 'Q2 (Apr - Jun)' },
      { value: 3 as const, label: 'Q3 (Jul - Sep)' },
      { value: 4 as const, label: 'Q4 (Okt - Dez)' },
    ],
    []
  )
}

/**
 * Period type options
 */
export function usePeriodTypeOptions(): Array<{ value: ExportPeriod; label: string }> {
  return useMemo(
    () => [
      { value: 'month' as const, label: 'Monat' },
      { value: 'quarter' as const, label: 'Quartal' },
      { value: 'year' as const, label: 'Jahr' },
      { value: 'custom' as const, label: 'Benutzerdefiniert' },
    ],
    []
  )
}

export default useDatevExport
