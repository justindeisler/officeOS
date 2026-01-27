/**
 * useDatevExport Hook Tests
 *
 * Tests for the DATEV export hook functionality.
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useDatevExport,
  useAvailableYears,
  useMonthOptions,
  useQuarterOptions,
  usePeriodTypeOptions,
} from './useDatevExport'

// ============================================================================
// HOOK TESTS
// ============================================================================

describe('useDatevExport', () => {
  describe('initial state', () => {
    it('should have default period type as quarter', () => {
      const { result } = renderHook(() => useDatevExport())
      expect(result.current.state.periodType).toBe('quarter')
    })

    it('should have default chart of accounts as SKR03', () => {
      const { result } = renderHook(() => useDatevExport())
      expect(result.current.state.chartOfAccounts).toBe('SKR03')
    })

    it('should have default format as csv', () => {
      const { result } = renderHook(() => useDatevExport())
      expect(result.current.state.format).toBe('csv')
    })

    it('should include all transaction types by default', () => {
      const { result } = renderHook(() => useDatevExport())
      expect(result.current.state.includeIncome).toBe(true)
      expect(result.current.state.includeExpenses).toBe(true)
      expect(result.current.state.includeDepreciation).toBe(true)
    })

    it('should accept initial state overrides', () => {
      const { result } = renderHook(() =>
        useDatevExport({ chartOfAccounts: 'SKR04', format: 'xml' })
      )
      expect(result.current.state.chartOfAccounts).toBe('SKR04')
      expect(result.current.state.format).toBe('xml')
    })
  })

  describe('period type changes', () => {
    it('should update period type', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.setPeriodType('month')
      })

      expect(result.current.state.periodType).toBe('month')
    })

    it('should update year', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.setYear(2023)
      })

      expect(result.current.state.year).toBe(2023)
    })

    it('should update quarter', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.setQuarter(2)
      })

      expect(result.current.state.quarter).toBe(2)
    })

    it('should update month', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.setMonth(6)
      })

      expect(result.current.state.month).toBe(6)
    })
  })

  describe('custom date range', () => {
    it('should update custom date range', () => {
      const { result } = renderHook(() => useDatevExport())

      const start = new Date('2024-01-15')
      const end = new Date('2024-06-30')

      act(() => {
        result.current.setCustomDateRange(start, end)
      })

      expect(result.current.state.customStartDate).toEqual(start)
      expect(result.current.state.customEndDate).toEqual(end)
    })
  })

  describe('format and chart changes', () => {
    it('should update chart of accounts', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.setChartOfAccounts('SKR04')
      })

      expect(result.current.state.chartOfAccounts).toBe('SKR04')
    })

    it('should update format', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.setFormat('xml')
      })

      expect(result.current.state.format).toBe('xml')
    })
  })

  describe('metadata', () => {
    it('should update consultant number', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.setConsultantNumber('12345')
      })

      expect(result.current.state.consultantNumber).toBe('12345')
    })

    it('should update client number', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.setClientNumber('99999')
      })

      expect(result.current.state.clientNumber).toBe('99999')
    })
  })

  describe('transaction type toggles', () => {
    it('should toggle income', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.toggleIncludeIncome()
      })

      expect(result.current.state.includeIncome).toBe(false)
    })

    it('should toggle expenses', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.toggleIncludeExpenses()
      })

      expect(result.current.state.includeExpenses).toBe(false)
    })

    it('should toggle depreciation', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.toggleIncludeDepreciation()
      })

      expect(result.current.state.includeDepreciation).toBe(false)
    })
  })

  describe('validation', () => {
    it('should be valid with default state', () => {
      const { result } = renderHook(() => useDatevExport())
      expect(result.current.isValid).toBe(true)
      expect(result.current.validationErrors).toHaveLength(0)
    })

    it('should be invalid when no transaction types selected', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.toggleIncludeIncome()
        result.current.toggleIncludeExpenses()
        result.current.toggleIncludeDepreciation()
      })

      expect(result.current.isValid).toBe(false)
      expect(result.current.validationErrors).toContain(
        'At least one transaction type must be selected'
      )
    })

    it('should require dates for custom period', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.setPeriodType('custom')
      })

      expect(result.current.isValid).toBe(false)
      expect(result.current.validationErrors).toContain(
        'Start date is required for custom period'
      )
    })
  })

  describe('export options', () => {
    it('should compute export options from state', () => {
      const { result } = renderHook(() => useDatevExport())

      expect(result.current.exportOptions).toBeDefined()
      expect(result.current.exportOptions.chartOfAccounts).toBe('SKR03')
      expect(result.current.exportOptions.format).toBe('csv')
      expect(result.current.exportOptions.startDate).toBeInstanceOf(Date)
      expect(result.current.exportOptions.endDate).toBeInstanceOf(Date)
    })

    it('should include consultant number in options when set', () => {
      const { result } = renderHook(() => useDatevExport())

      act(() => {
        result.current.setConsultantNumber('12345')
      })

      expect(result.current.exportOptions.consultantNumber).toBe('12345')
    })
  })

  describe('reset', () => {
    it('should reset to default state', () => {
      const { result } = renderHook(() => useDatevExport())

      // Change some values
      act(() => {
        result.current.setChartOfAccounts('SKR04')
        result.current.setFormat('xml')
        result.current.setConsultantNumber('12345')
      })

      // Reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.state.chartOfAccounts).toBe('SKR03')
      expect(result.current.state.format).toBe('csv')
      expect(result.current.state.consultantNumber).toBe('')
    })
  })
})

// ============================================================================
// HELPER HOOK TESTS
// ============================================================================

describe('useAvailableYears', () => {
  it('should return current year and past years', () => {
    const { result } = renderHook(() => useAvailableYears())
    const currentYear = new Date().getFullYear()

    expect(result.current).toHaveLength(6)
    expect(result.current[0]).toBe(currentYear)
    expect(result.current[5]).toBe(currentYear - 5)
  })
})

describe('useMonthOptions', () => {
  it('should return 12 month options', () => {
    const { result } = renderHook(() => useMonthOptions())

    expect(result.current).toHaveLength(12)
    expect(result.current[0]).toEqual({ value: 1, label: 'Januar' })
    expect(result.current[11]).toEqual({ value: 12, label: 'Dezember' })
  })
})

describe('useQuarterOptions', () => {
  it('should return 4 quarter options', () => {
    const { result } = renderHook(() => useQuarterOptions())

    expect(result.current).toHaveLength(4)
    expect(result.current[0].value).toBe(1)
    expect(result.current[3].value).toBe(4)
  })

  it('should have German labels', () => {
    const { result } = renderHook(() => useQuarterOptions())

    expect(result.current[0].label).toContain('Jan')
    expect(result.current[0].label).toContain('Mär')
  })
})

describe('usePeriodTypeOptions', () => {
  it('should return all period type options', () => {
    const { result } = renderHook(() => usePeriodTypeOptions())

    expect(result.current).toHaveLength(4)
    expect(result.current.map((o) => o.value)).toEqual([
      'month',
      'quarter',
      'year',
      'custom',
    ])
  })

  it('should have German labels', () => {
    const { result } = renderHook(() => usePeriodTypeOptions())

    expect(result.current.find((o) => o.value === 'month')?.label).toBe('Monat')
    expect(result.current.find((o) => o.value === 'year')?.label).toBe('Jahr')
  })
})
