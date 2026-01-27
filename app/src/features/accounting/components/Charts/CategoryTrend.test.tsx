/**
 * CategoryTrend Component Tests
 *
 * Tests for the stacked area chart showing expense category trends over time.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { CategoryTrend } from './CategoryTrend'
import type { CategoryTrendDataPoint } from '../../types/reports'

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart" role="img" aria-label="Category trend chart">{children}</div>
  ),
  Area: ({ dataKey }: { dataKey: string }) => <div data-testid={`area-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}))

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockTrendData = (): CategoryTrendDataPoint[] => [
  { month: 'Jan', monthIndex: 1, 'Office Supplies': 500, 'Software': 300, 'Travel': 200 },
  { month: 'Feb', monthIndex: 2, 'Office Supplies': 450, 'Software': 350, 'Travel': 250 },
  { month: 'Mar', monthIndex: 3, 'Office Supplies': 550, 'Software': 400, 'Travel': 150 },
  { month: 'Apr', monthIndex: 4, 'Office Supplies': 480, 'Software': 380, 'Travel': 300 },
  { month: 'May', monthIndex: 5, 'Office Supplies': 520, 'Software': 420, 'Travel': 180 },
  { month: 'Jun', monthIndex: 6, 'Office Supplies': 490, 'Software': 350, 'Travel': 220 },
]

const createEmptyData = (): CategoryTrendDataPoint[] => []

const createSingleMonthData = (): CategoryTrendDataPoint[] => [
  { month: 'Jan', monthIndex: 1, 'Office Supplies': 500, 'Software': 300 },
]

const createCategories = () => [
  { key: 'Office Supplies', color: 'hsl(222.2, 47.4%, 11.2%)' },
  { key: 'Software', color: 'hsl(142, 76%, 36%)' },
  { key: 'Travel', color: 'hsl(38, 92%, 50%)' },
]

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe('CategoryTrend', () => {
  describe('rendering', () => {
    it('renders the chart container', () => {
      render(
        <CategoryTrend
          data={createMockTrendData()}
          categories={createCategories()}
        />
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('renders area for each category', () => {
      render(
        <CategoryTrend
          data={createMockTrendData()}
          categories={createCategories()}
        />
      )

      expect(screen.getByTestId('area-Office Supplies')).toBeInTheDocument()
      expect(screen.getByTestId('area-Software')).toBeInTheDocument()
      expect(screen.getByTestId('area-Travel')).toBeInTheDocument()
    })

    it('renders chart axes', () => {
      render(
        <CategoryTrend
          data={createMockTrendData()}
          categories={createCategories()}
        />
      )

      expect(screen.getByTestId('x-axis')).toBeInTheDocument()
      expect(screen.getByTestId('y-axis')).toBeInTheDocument()
    })

    it('renders tooltip', () => {
      render(
        <CategoryTrend
          data={createMockTrendData()}
          categories={createCategories()}
        />
      )

      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('renders legend', () => {
      render(
        <CategoryTrend
          data={createMockTrendData()}
          categories={createCategories()}
        />
      )

      expect(screen.getByTestId('legend')).toBeInTheDocument()
    })

    it('has accessible label', () => {
      render(
        <CategoryTrend
          data={createMockTrendData()}
          categories={createCategories()}
        />
      )

      expect(screen.getByRole('img', { name: /category trend/i })).toBeInTheDocument()
    })
  })

  describe('with custom props', () => {
    it('applies custom className', () => {
      const { container } = render(
        <CategoryTrend
          data={createMockTrendData()}
          categories={createCategories()}
          className="custom-class"
        />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('renders with custom height', () => {
      render(
        <CategoryTrend
          data={createMockTrendData()}
          categories={createCategories()}
          height={400}
        />
      )

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('renders title when provided', () => {
      render(
        <CategoryTrend
          data={createMockTrendData()}
          categories={createCategories()}
          title="Expense Category Trends"
        />
      )

      expect(screen.getByText('Expense Category Trends')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('renders empty message when no data', () => {
      render(
        <CategoryTrend
          data={createEmptyData()}
          categories={createCategories()}
        />
      )

      expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })

    it('does not render chart when no data', () => {
      render(
        <CategoryTrend
          data={createEmptyData()}
          categories={createCategories()}
        />
      )

      expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument()
    })

    it('renders empty message when no categories', () => {
      render(
        <CategoryTrend
          data={createMockTrendData()}
          categories={[]}
        />
      )

      expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })
  })

  describe('data handling', () => {
    it('handles single month of data', () => {
      render(
        <CategoryTrend
          data={createSingleMonthData()}
          categories={[
            { key: 'Office Supplies', color: 'hsl(222.2, 47.4%, 11.2%)' },
            { key: 'Software', color: 'hsl(142, 76%, 36%)' },
          ]}
        />
      )

      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    })

    it('renders only provided categories', () => {
      render(
        <CategoryTrend
          data={createMockTrendData()}
          categories={[
            { key: 'Office Supplies', color: 'hsl(222.2, 47.4%, 11.2%)' },
          ]}
        />
      )

      expect(screen.getByTestId('area-Office Supplies')).toBeInTheDocument()
      expect(screen.queryByTestId('area-Software')).not.toBeInTheDocument()
      expect(screen.queryByTestId('area-Travel')).not.toBeInTheDocument()
    })
  })
})
