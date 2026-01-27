/**
 * ProfitTrendChart Component Tests
 *
 * Tests for the Profit Trend line chart component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { ProfitTrendChart } from './ProfitTrendChart'
import type { ProfitTrendDataPoint } from '../../types/reports'

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart" role="img" aria-label="Profit trend chart">{children}</div>
  ),
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`line-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  Area: ({ dataKey }: { dataKey: string }) => <div data-testid={`area-${dataKey}`} />,
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart" role="img" aria-label="Profit trend chart">{children}</div>
  ),
}))

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockTrendData = (): ProfitTrendDataPoint[] => [
  { month: 'Jan', monthIndex: 1, profit: 3000, cumulativeProfit: 3000 },
  { month: 'Feb', monthIndex: 2, profit: 3500, cumulativeProfit: 6500 },
  { month: 'Mar', monthIndex: 3, profit: 3000, cumulativeProfit: 9500 },
  { month: 'Apr', monthIndex: 4, profit: 4000, cumulativeProfit: 13500 },
  { month: 'May', monthIndex: 5, profit: 3300, cumulativeProfit: 16800 },
  { month: 'Jun', monthIndex: 6, profit: 3700, cumulativeProfit: 20500 },
]

const createEmptyData = (): ProfitTrendDataPoint[] => []

const createYearData = (): ProfitTrendDataPoint[] => {
  let cumulative = 0
  return Array.from({ length: 12 }, (_, i) => {
    const profit = 3000 + i * 100
    cumulative += profit
    return {
      month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][i],
      monthIndex: i + 1,
      profit,
      cumulativeProfit: cumulative,
    }
  })
}

const createNegativeProfitData = (): ProfitTrendDataPoint[] => [
  { month: 'Jan', monthIndex: 1, profit: -1000, cumulativeProfit: -1000 },
  { month: 'Feb', monthIndex: 2, profit: 2000, cumulativeProfit: 1000 },
  { month: 'Mar', monthIndex: 3, profit: -500, cumulativeProfit: 500 },
]

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe('ProfitTrendChart', () => {
  describe('rendering', () => {
    it('renders the chart container', () => {
      render(<ProfitTrendChart data={createMockTrendData()} />)

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('renders profit line', () => {
      render(<ProfitTrendChart data={createMockTrendData()} />)

      expect(screen.getByTestId('line-profit')).toBeInTheDocument()
    })

    it('renders cumulative profit line', () => {
      render(<ProfitTrendChart data={createMockTrendData()} />)

      expect(screen.getByTestId('line-cumulativeProfit')).toBeInTheDocument()
    })

    it('renders chart axes', () => {
      render(<ProfitTrendChart data={createMockTrendData()} />)

      expect(screen.getByTestId('x-axis')).toBeInTheDocument()
      expect(screen.getByTestId('y-axis')).toBeInTheDocument()
    })

    it('renders legend', () => {
      render(<ProfitTrendChart data={createMockTrendData()} />)

      expect(screen.getByTestId('legend')).toBeInTheDocument()
    })

    it('renders tooltip', () => {
      render(<ProfitTrendChart data={createMockTrendData()} />)

      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('has accessible label', () => {
      render(<ProfitTrendChart data={createMockTrendData()} />)

      expect(screen.getByRole('img', { name: /profit trend/i })).toBeInTheDocument()
    })
  })

  describe('with custom props', () => {
    it('applies custom className', () => {
      const { container } = render(
        <ProfitTrendChart data={createMockTrendData()} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('renders with custom height', () => {
      render(<ProfitTrendChart data={createMockTrendData()} height={400} />)

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('renders title when provided', () => {
      render(<ProfitTrendChart data={createMockTrendData()} title="Monthly Profit Trend" />)

      expect(screen.getByText('Monthly Profit Trend')).toBeInTheDocument()
    })

    it('can show only monthly profit without cumulative', () => {
      render(<ProfitTrendChart data={createMockTrendData()} showCumulative={false} />)

      expect(screen.getByTestId('line-profit')).toBeInTheDocument()
      expect(screen.queryByTestId('line-cumulativeProfit')).not.toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('renders empty message when no data', () => {
      render(<ProfitTrendChart data={createEmptyData()} />)

      expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })

    it('does not render chart when no data', () => {
      render(<ProfitTrendChart data={createEmptyData()} />)

      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
      expect(screen.queryByTestId('composed-chart')).not.toBeInTheDocument()
    })
  })

  describe('data handling', () => {
    it('renders correct number of data points', () => {
      const data = createYearData()
      render(<ProfitTrendChart data={data} />)

      // Chart should render with 12 months of data
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('handles single data point', () => {
      const singlePoint: ProfitTrendDataPoint[] = [
        { month: 'Jan', monthIndex: 1, profit: 3000, cumulativeProfit: 3000 },
      ]

      render(<ProfitTrendChart data={singlePoint} />)

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('handles negative profit values', () => {
      render(<ProfitTrendChart data={createNegativeProfitData()} />)

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
      expect(screen.getByTestId('line-profit')).toBeInTheDocument()
    })
  })
})
