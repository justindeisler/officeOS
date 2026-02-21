import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { BWAReport } from './BWAReport'
import { useBWA } from '../../hooks/useBWA'
import type { BWAReport as BWAReportType, MonthlyAggregate } from '../../api/bwa-reports'

// Mock the hook
vi.mock('../../hooks/useBWA', () => ({
  useBWA: vi.fn(),
}))

const mockUseBWA = vi.mocked(useBWA)

/**
 * Create a mock MonthlyAggregate
 */
function createMockMonth(month: number, income: number = 0, expenses: number = 0): MonthlyAggregate {
  return {
    year: 2024,
    month,
    income: {
      total: income,
      by_category: income > 0 ? { services: income } : {},
      by_vat_rate: income > 0 ? { 19: income } : {},
    },
    expenses: {
      total: expenses,
      by_category: expenses > 0 ? { software: expenses * 0.6, hosting: expenses * 0.4 } : {},
      by_euer_line: expenses > 0 ? { 34: expenses } : {},
    },
    profit: income - expenses,
    vat_liability: income * 0.19 - expenses * 0.19,
  }
}

/**
 * Create a full-year BWA report mock
 */
function createMockBWA(overrides: Partial<BWAReportType> = {}): BWAReportType {
  const months = Array.from({ length: 12 }, (_, i) =>
    createMockMonth(i + 1, 5000 + i * 500, 3000 + i * 200)
  )
  const totalIncome = months.reduce((s, m) => s + m.income.total, 0)
  const totalExpenses = months.reduce((s, m) => s + m.expenses.total, 0)
  return {
    year: 2024,
    months,
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      profit: totalIncome - totalExpenses,
      profit_margin_percent:
        totalIncome > 0
          ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 10000) / 100
          : 0,
    },
    ...overrides,
  }
}

describe('BWAReport', () => {
  const mockData = createMockBWA()

  const defaultMockReturn = {
    data: mockData,
    isLoading: false,
    error: null,
    selectedYear: 2024,
    setSelectedYear: vi.fn(),
    refetch: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseBWA.mockReturnValue(defaultMockReturn)
  })

  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<BWAReport />)
      expect(screen.getByText('BWA 2024')).toBeInTheDocument()
    })

    it('renders the title with year', () => {
      render(<BWAReport />)
      expect(screen.getByText('BWA 2024')).toBeInTheDocument()
    })

    it('renders month headers', () => {
      render(<BWAReport />)
      expect(screen.getByText('Jan')).toBeInTheDocument()
      expect(screen.getByText('Feb')).toBeInTheDocument()
      expect(screen.getByText('Mär')).toBeInTheDocument()
      expect(screen.getByText('Dez')).toBeInTheDocument()
    })

    it('renders income section', () => {
      render(<BWAReport />)
      expect(screen.getByText('Einnahmen')).toBeInTheDocument()
      expect(screen.getByText('Summe Einnahmen')).toBeInTheDocument()
    })

    it('renders expenses section', () => {
      render(<BWAReport />)
      expect(screen.getByText('Ausgaben')).toBeInTheDocument()
      expect(screen.getByText('Summe Ausgaben')).toBeInTheDocument()
    })

    it('renders profit/loss row', () => {
      render(<BWAReport />)
      expect(screen.getAllByText(/Gewinn|Verlust/i).length).toBeGreaterThan(0)
    })

    it('renders Gesamt (total) column header', () => {
      render(<BWAReport />)
      expect(screen.getByText('Gesamt')).toBeInTheDocument()
    })

    it('renders category labels', () => {
      render(<BWAReport />)
      // Income category
      expect(screen.getByText('Dienstleistungen')).toBeInTheDocument()
      // Expense categories
      expect(screen.getByText('Software & Lizenzen')).toBeInTheDocument()
      expect(screen.getByText('Hosting & Domains')).toBeInTheDocument()
    })
  })

  describe('currency formatting', () => {
    it('displays amounts in German currency format', () => {
      const months = Array.from({ length: 12 }, (_, i) =>
        createMockMonth(i + 1, i === 0 ? 1234.56 : 0, 0)
      )
      const data = createMockBWA({ months })
      mockUseBWA.mockReturnValue({
        ...defaultMockReturn,
        data,
      })
      render(<BWAReport />)
      // German format: 1.234,56 €
      expect(screen.getAllByText('1.234,56 €').length).toBeGreaterThan(0)
    })
  })

  describe('year selector', () => {
    it('renders year selector', () => {
      render(<BWAReport />)
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('calls setSelectedYear when year changes', async () => {
      const setSelectedYear = vi.fn()
      mockUseBWA.mockReturnValue({
        ...defaultMockReturn,
        setSelectedYear,
      })
      const { user } = render(<BWAReport />)

      // Click the combobox to open
      await user.click(screen.getByRole('combobox'))
      // Select a different year
      const option2023 = screen.getByText('2023')
      await user.click(option2023)

      expect(setSelectedYear).toHaveBeenCalledWith(2023)
    })
  })

  describe('loading state', () => {
    it('displays loading message', () => {
      mockUseBWA.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        data: null,
      })
      render(<BWAReport />)
      expect(screen.getByText(/Laden/i)).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('displays error message', () => {
      mockUseBWA.mockReturnValue({
        ...defaultMockReturn,
        error: 'Server nicht erreichbar',
        data: null,
      })
      render(<BWAReport />)
      expect(screen.getByText(/Fehler/i)).toBeInTheDocument()
      expect(screen.getByText(/Server nicht erreichbar/i)).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('displays empty state when no data', () => {
      mockUseBWA.mockReturnValue({
        ...defaultMockReturn,
        data: null,
      })
      render(<BWAReport />)
      expect(screen.getByText(/Keine Daten/i)).toBeInTheDocument()
    })
  })

  describe('profit/loss styling', () => {
    it('shows Gewinn label when profit is positive', () => {
      render(<BWAReport />)
      expect(screen.getByText('Gewinn')).toBeInTheDocument()
    })

    it('shows Verlust label when profit is negative', () => {
      const months = Array.from({ length: 12 }, (_, i) =>
        createMockMonth(i + 1, 1000, 5000)
      )
      const data = createMockBWA({
        months,
        totals: {
          income: 12000,
          expenses: 60000,
          profit: -48000,
          profit_margin_percent: -400,
        },
      })
      mockUseBWA.mockReturnValue({
        ...defaultMockReturn,
        data,
      })
      render(<BWAReport />)
      expect(screen.getByText('Verlust')).toBeInTheDocument()
    })
  })

  describe('print button', () => {
    it('renders print button', () => {
      render(<BWAReport />)
      expect(screen.getByRole('button', { name: /Drucken/i })).toBeInTheDocument()
    })
  })
})
