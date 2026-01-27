/**
 * ComparisonCard Component Tests
 *
 * Tests for the KPI comparison card showing year-over-year metrics.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { ComparisonCard } from './ComparisonCard'

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe('ComparisonCard', () => {
  describe('rendering', () => {
    it('renders the title', () => {
      render(
        <ComparisonCard
          title="Total Income"
          currentValue={85000}
          previousValue={72000}
          format="currency"
        />
      )

      expect(screen.getByText('Total Income')).toBeInTheDocument()
    })

    it('renders current value formatted as currency', () => {
      render(
        <ComparisonCard
          title="Total Income"
          currentValue={85000}
          previousValue={72000}
          format="currency"
        />
      )

      expect(screen.getByText(/85\.000/)).toBeInTheDocument()
    })

    it('renders previous value', () => {
      render(
        <ComparisonCard
          title="Total Income"
          currentValue={85000}
          previousValue={72000}
          format="currency"
        />
      )

      expect(screen.getByText(/72\.000/)).toBeInTheDocument()
    })

    it('renders change percentage', () => {
      render(
        <ComparisonCard
          title="Total Income"
          currentValue={85000}
          previousValue={72000}
          format="currency"
        />
      )

      // Change is 18.06%
      expect(screen.getByText(/18/)).toBeInTheDocument()
    })
  })

  describe('trend indicators', () => {
    it('shows up trend for positive change', () => {
      render(
        <ComparisonCard
          title="Total Income"
          currentValue={85000}
          previousValue={72000}
          format="currency"
        />
      )

      // Should have up arrow or indicator
      expect(screen.getByTestId('trend-up')).toBeInTheDocument()
    })

    it('shows down trend for negative change', () => {
      render(
        <ComparisonCard
          title="Total Income"
          currentValue={60000}
          previousValue={72000}
          format="currency"
        />
      )

      expect(screen.getByTestId('trend-down')).toBeInTheDocument()
    })

    it('shows neutral trend for no change', () => {
      render(
        <ComparisonCard
          title="Total Income"
          currentValue={72000}
          previousValue={72000}
          format="currency"
        />
      )

      expect(screen.getByTestId('trend-neutral')).toBeInTheDocument()
    })
  })

  describe('formats', () => {
    it('formats currency values correctly', () => {
      render(
        <ComparisonCard
          title="Revenue"
          currentValue={12500}
          previousValue={10000}
          format="currency"
        />
      )

      expect(screen.getByText(/12\.500/)).toBeInTheDocument()
    })

    it('formats percentage values correctly', () => {
      render(
        <ComparisonCard
          title="Profit Margin"
          currentValue={25.5}
          previousValue={22.3}
          format="percent"
        />
      )

      expect(screen.getByText(/25,5.*%|25\.5.*%/)).toBeInTheDocument()
    })

    it('formats number values correctly', () => {
      render(
        <ComparisonCard
          title="Invoice Count"
          currentValue={48}
          previousValue={42}
          format="number"
        />
      )

      expect(screen.getByText('48')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <ComparisonCard
          title="Test"
          currentValue={100}
          previousValue={80}
          format="number"
          className="custom-class"
        />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('highlights positive changes in green for income metrics', () => {
      render(
        <ComparisonCard
          title="Income"
          currentValue={100}
          previousValue={80}
          format="currency"
          positiveIsGood={true}
        />
      )

      const trendIndicator = screen.getByTestId('trend-up')
      expect(trendIndicator).toHaveClass('text-green-600')
    })

    it('highlights positive changes in red for expense metrics', () => {
      render(
        <ComparisonCard
          title="Expenses"
          currentValue={100}
          previousValue={80}
          format="currency"
          positiveIsGood={false}
        />
      )

      const trendIndicator = screen.getByTestId('trend-up')
      expect(trendIndicator).toHaveClass('text-red-600')
    })
  })

  describe('edge cases', () => {
    it('handles zero previous value', () => {
      render(
        <ComparisonCard
          title="New Metric"
          currentValue={100}
          previousValue={0}
          format="number"
        />
      )

      // Should show 100% growth
      expect(screen.getByText(/100\.0%/)).toBeInTheDocument()
    })

    it('handles both values zero', () => {
      render(
        <ComparisonCard
          title="Empty Metric"
          currentValue={0}
          previousValue={0}
          format="number"
        />
      )

      expect(screen.getByTestId('trend-neutral')).toBeInTheDocument()
    })
  })
})
