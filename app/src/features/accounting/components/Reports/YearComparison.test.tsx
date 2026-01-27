/**
 * YearComparison Component Tests
 *
 * Tests for the Year-over-Year comparison dashboard.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { YearComparison } from './YearComparison'
import type { YearComparison as YearComparisonType } from '../../types/reports'

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockComparisons = (): YearComparisonType[] => [
  {
    metric: 'totalIncome',
    label: 'Total Income',
    currentYear: 85000,
    previousYear: 72000,
    change: 13000,
    changePercent: 18.06,
    trend: 'up',
    format: 'currency',
  },
  {
    metric: 'totalExpenses',
    label: 'Total Expenses',
    currentYear: 32000,
    previousYear: 28000,
    change: 4000,
    changePercent: 14.29,
    trend: 'up',
    format: 'currency',
  },
  {
    metric: 'profit',
    label: 'Net Profit',
    currentYear: 53000,
    previousYear: 44000,
    change: 9000,
    changePercent: 20.45,
    trend: 'up',
    format: 'currency',
  },
  {
    metric: 'profitMargin',
    label: 'Profit Margin',
    currentYear: 62.4,
    previousYear: 61.1,
    change: 1.3,
    changePercent: 2.13,
    trend: 'up',
    format: 'percent',
  },
]

const createEmptyComparisons = (): YearComparisonType[] => []

const createMixedTrendComparisons = (): YearComparisonType[] => [
  {
    metric: 'totalIncome',
    label: 'Total Income',
    currentYear: 85000,
    previousYear: 72000,
    change: 13000,
    changePercent: 18.06,
    trend: 'up',
    format: 'currency',
  },
  {
    metric: 'totalExpenses',
    label: 'Total Expenses',
    currentYear: 40000,
    previousYear: 28000,
    change: 12000,
    changePercent: 42.86,
    trend: 'up',
    format: 'currency',
  },
  {
    metric: 'profit',
    label: 'Net Profit',
    currentYear: 45000,
    previousYear: 44000,
    change: 1000,
    changePercent: 2.27,
    trend: 'up',
    format: 'currency',
  },
]

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe('YearComparison', () => {
  describe('rendering', () => {
    it('renders the title', () => {
      render(
        <YearComparison
          comparisons={createMockComparisons()}
          currentYear={2024}
          previousYear={2023}
        />
      )

      expect(screen.getByText(/2024 vs 2023/i)).toBeInTheDocument()
    })

    it('renders all comparison cards', () => {
      render(
        <YearComparison
          comparisons={createMockComparisons()}
          currentYear={2024}
          previousYear={2023}
        />
      )

      expect(screen.getByText('Total Income')).toBeInTheDocument()
      expect(screen.getByText('Total Expenses')).toBeInTheDocument()
      expect(screen.getByText('Net Profit')).toBeInTheDocument()
      expect(screen.getByText('Profit Margin')).toBeInTheDocument()
    })

    it('renders current year values', () => {
      render(
        <YearComparison
          comparisons={createMockComparisons()}
          currentYear={2024}
          previousYear={2023}
        />
      )

      // Should show €85.000 for income
      expect(screen.getByText(/85\.000/)).toBeInTheDocument()
    })

    it('renders trend indicators', () => {
      render(
        <YearComparison
          comparisons={createMockComparisons()}
          currentYear={2024}
          previousYear={2023}
        />
      )

      // All trends are up
      const upTrends = screen.getAllByTestId('trend-up')
      expect(upTrends.length).toBe(4)
    })
  })

  describe('empty state', () => {
    it('renders empty message when no comparisons', () => {
      render(
        <YearComparison
          comparisons={createEmptyComparisons()}
          currentYear={2024}
          previousYear={2023}
        />
      )

      expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <YearComparison
          comparisons={createMockComparisons()}
          currentYear={2024}
          previousYear={2023}
          className="custom-class"
        />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('renders in grid layout', () => {
      render(
        <YearComparison
          comparisons={createMockComparisons()}
          currentYear={2024}
          previousYear={2023}
        />
      )

      // Should have a grid container
      const grid = screen.getByTestId('comparison-grid')
      expect(grid).toHaveClass('grid')
    })
  })

  describe('custom title', () => {
    it('renders custom title when provided', () => {
      render(
        <YearComparison
          comparisons={createMockComparisons()}
          currentYear={2024}
          previousYear={2023}
          title="Annual Performance Review"
        />
      )

      expect(screen.getByText('Annual Performance Review')).toBeInTheDocument()
    })
  })
})
