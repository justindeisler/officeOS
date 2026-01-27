import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@/test/utils'
import { IncomeList } from './IncomeList'
import { createMockIncome, createMockIncomes } from '@/test/mocks/data/accounting'
import type { Income } from '../../types'

// Mock the useIncome hook
vi.mock('../../hooks/useIncome', () => ({
  useIncome: vi.fn(),
  default: vi.fn(),
}))

import { useIncome } from '../../hooks/useIncome'

const mockUseIncome = vi.mocked(useIncome)

describe('IncomeList', () => {
  const defaultMockReturn = {
    income: [] as Income[],
    isLoading: false,
    error: null,
    fetchIncome: vi.fn(),
    fetchByDateRange: vi.fn(),
    fetchByUstPeriod: vi.fn(),
    createIncome: vi.fn(),
    updateIncome: vi.fn(),
    deleteIncome: vi.fn(),
    markAsReported: vi.fn(),
    getSummary: vi.fn(),
    selectedIncome: null,
    setSelectedIncome: vi.fn(),
    refresh: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseIncome.mockReturnValue(defaultMockReturn)
  })

  describe('rendering', () => {
    it('renders the income list header', () => {
      render(<IncomeList />)

      expect(screen.getByText('Income')).toBeInTheDocument()
    })

    it('renders empty state when no income records', () => {
      render(<IncomeList />)

      expect(screen.getByText(/no income records/i)).toBeInTheDocument()
    })

    it('renders loading state', () => {
      mockUseIncome.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
      })

      render(<IncomeList />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('renders error state', () => {
      mockUseIncome.mockReturnValue({
        ...defaultMockReturn,
        error: 'Failed to fetch income',
      })

      render(<IncomeList />)

      expect(screen.getByText(/failed to fetch income/i)).toBeInTheDocument()
    })

    it('renders income records in a table', () => {
      const mockIncomes = createMockIncomes(3)
      mockUseIncome.mockReturnValue({
        ...defaultMockReturn,
        income: mockIncomes,
      })

      render(<IncomeList />)

      // Check table headers - some appear in both header and summary
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      // Net, VAT, Gross appear in table header AND summary section
      expect(screen.getAllByText('Net')).toHaveLength(2) // header + summary
      // VAT appears 3 times: rate column header, amount column header, and summary
      expect(screen.getAllByText('VAT')).toHaveLength(3)
      expect(screen.getAllByText('Gross')).toHaveLength(2) // header + summary

      // Check that all records are rendered
      mockIncomes.forEach((income) => {
        expect(screen.getByText(income.description)).toBeInTheDocument()
      })
    })
  })

  describe('formatting', () => {
    it('formats currency amounts correctly', () => {
      const income = createMockIncome({
        netAmount: 1000,
        vatAmount: 190,
        grossAmount: 1190,
      })
      mockUseIncome.mockReturnValue({
        ...defaultMockReturn,
        income: [income],
      })

      render(<IncomeList />)

      // German currency formatting - values appear in both table row and summary
      // so we use getAllByText and check that at least one exists
      expect(screen.getAllByText('1.000,00 €')).toHaveLength(2) // row + summary
      expect(screen.getAllByText('190,00 €')).toHaveLength(2) // row + summary
      expect(screen.getAllByText('1.190,00 €')).toHaveLength(2) // row + summary
    })

    it('formats dates in German locale', () => {
      const income = createMockIncome({
        date: new Date('2024-03-15'),
      })
      mockUseIncome.mockReturnValue({
        ...defaultMockReturn,
        income: [income],
      })

      render(<IncomeList />)

      // German date format: DD.MM.YYYY
      expect(screen.getByText('15.03.2024')).toBeInTheDocument()
    })

    it('shows VAT rate badge', () => {
      const income = createMockIncome({ vatRate: 19 })
      mockUseIncome.mockReturnValue({
        ...defaultMockReturn,
        income: [income],
      })

      render(<IncomeList />)

      expect(screen.getByText('19%')).toBeInTheDocument()
    })

    it('shows USt reported status', () => {
      const reportedIncome = createMockIncome({ ustReported: true })
      const unreportedIncome = createMockIncome({ ustReported: false })
      mockUseIncome.mockReturnValue({
        ...defaultMockReturn,
        income: [reportedIncome, unreportedIncome],
      })

      render(<IncomeList />)

      const rows = screen.getAllByRole('row')
      // Header row + 2 data rows
      expect(rows).toHaveLength(3)
    })
  })

  describe('interactions', () => {
    it('calls setSelectedIncome when row is clicked', async () => {
      const income = createMockIncome()
      const setSelectedIncome = vi.fn()
      mockUseIncome.mockReturnValue({
        ...defaultMockReturn,
        income: [income],
        setSelectedIncome,
      })

      const { user } = render(<IncomeList />)

      await user.click(screen.getByText(income.description))

      expect(setSelectedIncome).toHaveBeenCalledWith(income)
    })

    it('calls deleteIncome when delete button is clicked', async () => {
      const income = createMockIncome()
      const deleteIncome = vi.fn().mockResolvedValue(true)
      mockUseIncome.mockReturnValue({
        ...defaultMockReturn,
        income: [income],
        deleteIncome,
      })

      // Mock window.confirm to return true
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      const { user } = render(<IncomeList />)

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await user.click(deleteButton)

      expect(confirmSpy).toHaveBeenCalled()
      expect(deleteIncome).toHaveBeenCalledWith(income.id)

      confirmSpy.mockRestore()
    })

    it('shows add income button', () => {
      render(<IncomeList />)

      expect(screen.getByRole('button', { name: /add income/i })).toBeInTheDocument()
    })

    it('calls onAddIncome when add button is clicked', async () => {
      const onAddIncome = vi.fn()

      const { user } = render(<IncomeList onAddIncome={onAddIncome} />)

      await user.click(screen.getByRole('button', { name: /add income/i }))

      expect(onAddIncome).toHaveBeenCalled()
    })
  })

  describe('filtering', () => {
    it('filters by search term', async () => {
      const incomes = [
        createMockIncome({ description: 'Consulting Project A' }),
        createMockIncome({ description: 'Development Work B' }),
        createMockIncome({ description: 'Consulting Project C' }),
      ]
      mockUseIncome.mockReturnValue({
        ...defaultMockReturn,
        income: incomes,
      })

      const { user } = render(<IncomeList />)

      const searchInput = screen.getByPlaceholderText(/search/i)
      await user.type(searchInput, 'Consulting')

      expect(screen.getByText('Consulting Project A')).toBeInTheDocument()
      expect(screen.getByText('Consulting Project C')).toBeInTheDocument()
      expect(screen.queryByText('Development Work B')).not.toBeInTheDocument()
    })
  })

  describe('summary', () => {
    it('shows total amounts', () => {
      const incomes = [
        createMockIncome({ netAmount: 1000, vatAmount: 190, grossAmount: 1190 }),
        createMockIncome({ netAmount: 2000, vatAmount: 380, grossAmount: 2380 }),
      ]
      mockUseIncome.mockReturnValue({
        ...defaultMockReturn,
        income: incomes,
      })

      render(<IncomeList />)

      // Total net: 3000, VAT: 570, Gross: 3570
      expect(screen.getByText(/total/i)).toBeInTheDocument()
      expect(screen.getByText('3.000,00 €')).toBeInTheDocument()
    })
  })
})
