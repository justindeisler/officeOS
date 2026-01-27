/**
 * ExpenseDonut Component Tests
 *
 * Tests for the expense breakdown donut/pie chart component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { ExpenseDonut } from './ExpenseDonut'
import type { ExpenseDonutDataPoint } from '../../types/reports'

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart" role="img" aria-label="Expense breakdown chart">{children}</div>
  ),
  Pie: ({ dataKey, children }: { dataKey: string; children?: React.ReactNode }) => (
    <div data-testid={`pie-${dataKey}`}>{children}</div>
  ),
  Cell: ({ fill }: { fill: string }) => <div data-testid="pie-cell" data-fill={fill} />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}))

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockDonutData = (): ExpenseDonutDataPoint[] => [
  { name: 'Office Supplies', value: 1500, percentage: 30, color: 'hsl(222.2, 47.4%, 11.2%)' },
  { name: 'Software', value: 1000, percentage: 20, color: 'hsl(142, 76%, 36%)' },
  { name: 'Travel', value: 750, percentage: 15, color: 'hsl(38, 92%, 50%)' },
  { name: 'Marketing', value: 1250, percentage: 25, color: 'hsl(199, 89%, 48%)' },
  { name: 'Other', value: 500, percentage: 10, color: 'hsl(0, 84.2%, 60.2%)' },
]

const createEmptyData = (): ExpenseDonutDataPoint[] => []

const createSingleCategoryData = (): ExpenseDonutDataPoint[] => [
  { name: 'All Expenses', value: 5000, percentage: 100, color: 'hsl(222.2, 47.4%, 11.2%)' },
]

const createManyCategoriesData = (): ExpenseDonutDataPoint[] =>
  Array.from({ length: 10 }, (_, i) => ({
    name: `Category ${i + 1}`,
    value: 1000 - i * 50,
    percentage: 10 - i * 0.5,
    color: `hsl(${i * 36}, 70%, 50%)`,
  }))

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe('ExpenseDonut', () => {
  describe('rendering', () => {
    it('renders the chart container', () => {
      render(<ExpenseDonut data={createMockDonutData()} />)

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
    })

    it('renders pie with value dataKey', () => {
      render(<ExpenseDonut data={createMockDonutData()} />)

      expect(screen.getByTestId('pie-value')).toBeInTheDocument()
    })

    it('renders cells for each category', () => {
      render(<ExpenseDonut data={createMockDonutData()} />)

      const cells = screen.getAllByTestId('pie-cell')
      expect(cells).toHaveLength(5)
    })

    it('renders tooltip', () => {
      render(<ExpenseDonut data={createMockDonutData()} />)

      expect(screen.getByTestId('tooltip')).toBeInTheDocument()
    })

    it('renders legend', () => {
      render(<ExpenseDonut data={createMockDonutData()} />)

      expect(screen.getByTestId('legend')).toBeInTheDocument()
    })

    it('has accessible label', () => {
      render(<ExpenseDonut data={createMockDonutData()} />)

      expect(screen.getByRole('img', { name: /expense breakdown/i })).toBeInTheDocument()
    })
  })

  describe('with custom props', () => {
    it('applies custom className', () => {
      const { container } = render(
        <ExpenseDonut data={createMockDonutData()} className="custom-class" />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('renders with custom height', () => {
      render(<ExpenseDonut data={createMockDonutData()} height={400} />)

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
    })

    it('renders title when provided', () => {
      render(<ExpenseDonut data={createMockDonutData()} title="Expense Breakdown" />)

      expect(screen.getByText('Expense Breakdown')).toBeInTheDocument()
    })

    it('renders total in center when showTotal is true', () => {
      render(<ExpenseDonut data={createMockDonutData()} showTotal={true} />)

      // Total should be 5000
      expect(screen.getByText(/5\.000/)).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('renders empty message when no data', () => {
      render(<ExpenseDonut data={createEmptyData()} />)

      expect(screen.getByText(/no data available/i)).toBeInTheDocument()
    })

    it('does not render chart when no data', () => {
      render(<ExpenseDonut data={createEmptyData()} />)

      expect(screen.queryByTestId('pie-chart')).not.toBeInTheDocument()
    })
  })

  describe('data handling', () => {
    it('handles single category', () => {
      render(<ExpenseDonut data={createSingleCategoryData()} />)

      expect(screen.getByTestId('pie-chart')).toBeInTheDocument()
      const cells = screen.getAllByTestId('pie-cell')
      expect(cells).toHaveLength(1)
    })

    it('handles many categories', () => {
      render(<ExpenseDonut data={createManyCategoriesData()} />)

      const cells = screen.getAllByTestId('pie-cell')
      expect(cells).toHaveLength(10)
    })

    it('applies category colors to cells', () => {
      const data = createMockDonutData()
      render(<ExpenseDonut data={data} />)

      const cells = screen.getAllByTestId('pie-cell')
      cells.forEach((cell, index) => {
        expect(cell).toHaveAttribute('data-fill', data[index].color)
      })
    })
  })
})
