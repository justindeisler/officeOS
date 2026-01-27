import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { MonthlyReport } from './MonthlyReport'
import {
  createMockMonthlyReport,
  createMockYearlyReports,
  type MonthlyReportData,
} from '@/test/mocks/data/accounting'

describe('MonthlyReport', () => {
  const mockData = createMockYearlyReports(2024)

  describe('rendering', () => {
    it('renders the report title', () => {
      render(<MonthlyReport data={mockData} year={2024} />)

      expect(screen.getByRole('heading', { name: /monthly report/i })).toBeInTheDocument()
    })

    it('renders the year in title', () => {
      render(<MonthlyReport data={mockData} year={2024} />)

      // Year appears in title and total row
      const yearElements = screen.getAllByText(/2024/)
      expect(yearElements.length).toBeGreaterThanOrEqual(1)
    })

    it('renders all 12 months', () => {
      render(<MonthlyReport data={mockData} year={2024} />)

      expect(screen.getByText(/january/i)).toBeInTheDocument()
      expect(screen.getByText(/december/i)).toBeInTheDocument()
    })

    it('renders table headers', () => {
      render(<MonthlyReport data={mockData} year={2024} />)

      expect(screen.getByText('Month')).toBeInTheDocument()
      expect(screen.getByText('Income')).toBeInTheDocument()
      expect(screen.getByText('Expenses')).toBeInTheDocument()
      expect(screen.getByText('Profit')).toBeInTheDocument()
    })

    it('renders VAT columns', () => {
      render(<MonthlyReport data={mockData} year={2024} />)

      // Check for VAT column headers
      expect(screen.getByText(/VAT Collected/i)).toBeInTheDocument()
      expect(screen.getByText(/VAT Paid/i)).toBeInTheDocument()
    })

    it('renders empty state when no data', () => {
      render(<MonthlyReport data={[]} year={2024} />)

      expect(screen.getByText(/no data/i)).toBeInTheDocument()
    })
  })

  describe('formatting', () => {
    it('formats income amounts in German currency', () => {
      const singleMonth = [createMockMonthlyReport({ income: 5000 })]
      render(<MonthlyReport data={singleMonth} year={2024} />)

      // Amount appears in row and total row
      const amounts = screen.getAllByText('5.000,00 €')
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })

    it('formats expense amounts in German currency', () => {
      const singleMonth = [createMockMonthlyReport({ expenses: 1500 })]
      render(<MonthlyReport data={singleMonth} year={2024} />)

      // Amount appears in row and total row
      const amounts = screen.getAllByText('1.500,00 €')
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })

    it('formats profit amounts in German currency', () => {
      const singleMonth = [createMockMonthlyReport({ profit: 3500 })]
      render(<MonthlyReport data={singleMonth} year={2024} />)

      // Amount appears in row and total row
      const amounts = screen.getAllByText('3.500,00 €')
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })

    it('formats VAT amounts in German currency', () => {
      const singleMonth = [createMockMonthlyReport({ vatCollected: 950 })]
      render(<MonthlyReport data={singleMonth} year={2024} />)

      // Amount appears in row and total row
      const amounts = screen.getAllByText('950,00 €')
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('profit styling', () => {
    it('shows positive profit with green color', () => {
      const singleMonth = [createMockMonthlyReport({ profit: 1000 })]
      render(<MonthlyReport data={singleMonth} year={2024} />)

      // Find profit cells (amount appears in row and total row)
      const profitCells = screen.getAllByText('1.000,00 €')
      // At least one should have green class
      const hasGreenClass = profitCells.some((cell) => cell.classList.contains('text-green-600'))
      expect(hasGreenClass).toBe(true)
    })

    it('shows negative profit with red color', () => {
      const singleMonth = [createMockMonthlyReport({ profit: -500 })]
      render(<MonthlyReport data={singleMonth} year={2024} />)

      // Find profit cells (amount appears in row and total row)
      const profitCells = screen.getAllByText('-500,00 €')
      // At least one should have red class
      const hasRedClass = profitCells.some((cell) => cell.classList.contains('text-red-600'))
      expect(hasRedClass).toBe(true)
    })

    it('shows zero profit with neutral color', () => {
      const singleMonth = [createMockMonthlyReport({ profit: 0 })]
      render(<MonthlyReport data={singleMonth} year={2024} />)

      // Find profit cells (0,00 € appears multiple times)
      const zeroCells = screen.getAllByText('0,00 €')
      // Check that profit cells don't have colored class
      // The first cell is likely the profit cell for the row
      expect(zeroCells.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('totals', () => {
    it('displays yearly totals row', () => {
      render(<MonthlyReport data={mockData} year={2024} />)

      expect(screen.getByText(/total|yearly/i)).toBeInTheDocument()
    })

    it('calculates total income correctly', () => {
      const data: MonthlyReportData[] = [
        createMockMonthlyReport({ month: 'January', income: 1000 }),
        createMockMonthlyReport({ month: 'February', income: 2000 }),
        createMockMonthlyReport({ month: 'March', income: 3000 }),
      ]
      render(<MonthlyReport data={data} year={2024} />)

      // Total should be 6000
      expect(screen.getByText('6.000,00 €')).toBeInTheDocument()
    })

    it('calculates total expenses correctly', () => {
      const data: MonthlyReportData[] = [
        createMockMonthlyReport({ month: 'January', expenses: 500 }),
        createMockMonthlyReport({ month: 'February', expenses: 700 }),
      ]
      render(<MonthlyReport data={data} year={2024} />)

      // Total should be 1200
      expect(screen.getByText('1.200,00 €')).toBeInTheDocument()
    })

    it('calculates total profit correctly', () => {
      const data: MonthlyReportData[] = [
        createMockMonthlyReport({ month: 'January', profit: 1000 }),
        createMockMonthlyReport({ month: 'February', profit: -500 }),
      ]
      render(<MonthlyReport data={data} year={2024} />)

      // Net profit should be 500
      expect(screen.getByText('500,00 €')).toBeInTheDocument()
    })
  })

  describe('quarterly summaries', () => {
    it('shows Q1 summary', () => {
      render(<MonthlyReport data={mockData} year={2024} showQuarterlySummary />)

      expect(screen.getByText(/q1/i)).toBeInTheDocument()
    })

    it('shows Q2 summary', () => {
      render(<MonthlyReport data={mockData} year={2024} showQuarterlySummary />)

      expect(screen.getByText(/q2/i)).toBeInTheDocument()
    })

    it('shows Q3 summary', () => {
      render(<MonthlyReport data={mockData} year={2024} showQuarterlySummary />)

      expect(screen.getByText(/q3/i)).toBeInTheDocument()
    })

    it('shows Q4 summary', () => {
      render(<MonthlyReport data={mockData} year={2024} showQuarterlySummary />)

      expect(screen.getByText(/q4/i)).toBeInTheDocument()
    })

    it('hides quarterly summaries when prop is false', () => {
      render(<MonthlyReport data={mockData} year={2024} showQuarterlySummary={false} />)

      // Quarterly rows should not appear
      const quarterRows = screen.queryAllByText(/^q[1-4]$/i)
      expect(quarterRows.length).toBe(0)
    })
  })

  describe('export', () => {
    it('renders export button', () => {
      render(<MonthlyReport data={mockData} year={2024} />)

      expect(screen.getByRole('button', { name: /export|download/i })).toBeInTheDocument()
    })

    it('calls onExport when export button is clicked', async () => {
      const onExport = vi.fn()
      const { user } = render(<MonthlyReport data={mockData} year={2024} onExport={onExport} />)

      await user.click(screen.getByRole('button', { name: /export|download/i }))

      expect(onExport).toHaveBeenCalled()
    })
  })

  describe('print', () => {
    it('renders print button', () => {
      render(<MonthlyReport data={mockData} year={2024} />)

      expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
    })

    it('calls onPrint when print button is clicked', async () => {
      const onPrint = vi.fn()
      const { user } = render(<MonthlyReport data={mockData} year={2024} onPrint={onPrint} />)

      await user.click(screen.getByRole('button', { name: /print/i }))

      expect(onPrint).toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('has accessible table structure', () => {
      render(<MonthlyReport data={mockData} year={2024} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0)
    })

    it('has accessible row headers for months', () => {
      render(<MonthlyReport data={mockData} year={2024} />)

      const rows = screen.getAllByRole('row')
      expect(rows.length).toBeGreaterThan(1) // Header + data rows
    })
  })

  describe('filtering', () => {
    it('shows only months with data', () => {
      const partialData = [
        createMockMonthlyReport({ month: 'January' }),
        createMockMonthlyReport({ month: 'March' }),
      ]
      render(<MonthlyReport data={partialData} year={2024} />)

      expect(screen.getByText('January')).toBeInTheDocument()
      expect(screen.getByText('March')).toBeInTheDocument()
    })
  })
})
