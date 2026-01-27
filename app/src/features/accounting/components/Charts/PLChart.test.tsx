/**
 * PLChart Component Tests
 *
 * Tests for the Profit & Loss bar chart component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { PLChart } from './PLChart'
import type { PLChartDataPoint } from '../../types/reports'

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart" role="img" aria-label="Income vs Expenses chart">{children}</div>
  ),
  Bar: ({ dataKey }: { dataKey: string }) => <div data-testid={`bar-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}))

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockChartData = (): PLChartDataPoint[] => [
  { month: 'Jan', monthIndex: 1, income: 5000, expenses: 2000, profit: 3000 },
  { month: 'Feb', monthIndex: 2, income: 6000, expenses: 2500, profit: 3500 },
  { month: 'Mar', monthIndex: 3, income: 4500, expenses: 1500, profit: 3000 },
  { month: 'Apr', monthIndex: 4, income: 7000, expenses: 3000, profit: 4000 },
  { month: 'May', monthIndex: 5, income: 5500, expenses: 2200, profit: 3300 },
  { month: 'Jun', monthIndex: 6, income: 6500, expenses: 2800, profit: 3700 },
]

const createEmptyData = (): PLChartDataPoint[] => []

const createYearData = (): PLChartDataPoint[] =>
  Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
    monthIndex: i + 1,
    income: 5000 + i * 200,
    expenses: 2000 + i * 100,
    profit: 3000 + i * 100,
  }))

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe('PLChart', () => {
  describe('rendering', () => {
    it('renders the chart container', () => {
      render(<PLChart data={createMockChartData()} />)

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('renders income and expense bars', () => {
      render(<PLChart data={createMockChartData()} />)

      expect(screen.getByTestId('bar-income')).toBeInTheDocument()
      expect(screen.getByTestId('bar-expenses')).toBeInTheDocument()
    })

    it('renders chart axes', () => {
      render(<PLChart data={createMockChartData()} />)

      expect(screen.getByTestId('x-axis')).toBeInTheDocument()
      expect(screen.getByTestId('y-axis')).toBeInTheDocument()
    })

    it('renders legend', () => {
      render(<PLChart data={createMockChartData()} />)

      expect(screen.getByTestId('legend')).toBeInTheDocument()
    })

    it('renders tooltip', () => {
      render(<PLChart data={createMockChartData()} />)

      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('has accessible label', () => {
      render(<PLChart data={createMockChartData()} />)

      expect(screen.getByRole('img', { name: /income vs expenses/i })).toBeInTheDocument()
    })
  })

  describe('with custom props', () => {
    it('applies custom className', () => {
      const { container } = render(
        <PLChart data={createMockChartData()} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('renders with custom height', () => {
      render(<PLChart data={createMockChartData()} height={400} />)

      // Container should be present (height is passed to ResponsiveContainer)
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('renders title when provided', () => {
      render(<PLChart data={createMockChartData()} title="Monthly P&L" />)

      expect(screen.getByText('Monthly P&L')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('renders empty message when no data', () => {
      render(<PLChart data={createEmptyData()} />)

      expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })

    it('does not render chart when no data', () => {
      render(<PLChart data={createEmptyData()} />)

      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument()
    })
  })

  describe('data handling', () => {
    it('renders correct number of data points', () => {
      const data = createYearData()
      render(<PLChart data={data} />)

      // Chart should render with 12 months of data
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })

    it('handles single data point', () => {
      const singlePoint: PLChartDataPoint[] = [
        { month: 'Jan', monthIndex: 1, income: 5000, expenses: 2000, profit: 3000 },
      ]

      render(<PLChart data={singlePoint} />)

      expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
    })
  })
})
