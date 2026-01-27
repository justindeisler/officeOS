import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { ExpenseList } from './ExpenseList'
import {
  createMockExpense,
  createMockExpenses,
  createMockGwgExpense,
  createMockRecurringExpense,
} from '@/test/mocks/data/accounting'
import type { Expense } from '../../types'

// Mock the useExpenses hook
vi.mock('../../hooks/useExpenses', () => ({
  useExpenses: vi.fn(),
  default: vi.fn(),
}))

import { useExpenses } from '../../hooks/useExpenses'

const mockUseExpenses = vi.mocked(useExpenses)

describe('ExpenseList', () => {
  const defaultMockReturn = {
    expenses: [] as Expense[],
    isLoading: false,
    error: null,
    fetchExpenses: vi.fn(),
    fetchByDateRange: vi.fn(),
    fetchByUstPeriod: vi.fn(),
    fetchByCategory: vi.fn(),
    createExpense: vi.fn(),
    updateExpense: vi.fn(),
    deleteExpense: vi.fn(),
    markVorsteuerClaimed: vi.fn(),
    getRecurringExpenses: vi.fn(),
    getGwgExpenses: vi.fn(),
    getVorsteuerSummary: vi.fn(),
    selectedExpense: null,
    setSelectedExpense: vi.fn(),
    refresh: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseExpenses.mockReturnValue(defaultMockReturn)
  })

  describe('rendering', () => {
    it('renders the expense list header', () => {
      render(<ExpenseList />)

      expect(screen.getByText('Expenses')).toBeInTheDocument()
    })

    it('renders empty state when no expense records', () => {
      render(<ExpenseList />)

      expect(screen.getByText(/no expense records/i)).toBeInTheDocument()
    })

    it('renders loading state', () => {
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
      })

      render(<ExpenseList />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('renders error state', () => {
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        error: 'Failed to fetch expenses',
      })

      render(<ExpenseList />)

      expect(screen.getByText(/failed to fetch expenses/i)).toBeInTheDocument()
    })

    it('renders expense records in a table', () => {
      const mockExpenses = createMockExpenses(3)
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses: mockExpenses,
      })

      render(<ExpenseList />)

      // Check table headers
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getByText('Vendor')).toBeInTheDocument()
      expect(screen.getByText('Description')).toBeInTheDocument()
      // Net, VAT, Gross appear in table header AND summary section
      expect(screen.getAllByText('Net')).toHaveLength(2) // header + summary
      expect(screen.getAllByText('Vorsteuer')).toHaveLength(2) // header + summary
      expect(screen.getAllByText('Gross')).toHaveLength(2) // header + summary

      // Check that all records are rendered
      mockExpenses.forEach((expense) => {
        expect(screen.getByText(expense.description)).toBeInTheDocument()
      })
    })
  })

  describe('formatting', () => {
    it('formats currency amounts correctly', () => {
      const expense = createMockExpense({
        netAmount: 1000,
        vatAmount: 190,
        grossAmount: 1190,
      })
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses: [expense],
      })

      render(<ExpenseList />)

      // German currency formatting - values appear in both table row and summary
      expect(screen.getAllByText('1.000,00 €')).toHaveLength(2) // row + summary
      expect(screen.getAllByText('190,00 €')).toHaveLength(2) // row + summary
      expect(screen.getAllByText('1.190,00 €')).toHaveLength(2) // row + summary
    })

    it('formats dates in German locale', () => {
      const expense = createMockExpense({
        date: new Date('2024-03-15'),
      })
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses: [expense],
      })

      render(<ExpenseList />)

      // German date format: DD.MM.YYYY
      expect(screen.getByText('15.03.2024')).toBeInTheDocument()
    })

    it('shows VAT rate badge', () => {
      const expense = createMockExpense({ vatRate: 19 })
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses: [expense],
      })

      render(<ExpenseList />)

      expect(screen.getByText('19%')).toBeInTheDocument()
    })

    it('shows Vorsteuer claimed status', () => {
      const claimedExpense = createMockExpense({ vorsteuerClaimed: true })
      const unclaimedExpense = createMockExpense({ vorsteuerClaimed: false })
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses: [claimedExpense, unclaimedExpense],
      })

      render(<ExpenseList />)

      const rows = screen.getAllByRole('row')
      // Header row + 2 data rows
      expect(rows).toHaveLength(3)
    })

    it('shows recurring indicator badge', () => {
      const recurringExpense = createMockRecurringExpense('monthly')
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses: [recurringExpense],
      })

      render(<ExpenseList />)

      expect(screen.getByText(/recurring/i)).toBeInTheDocument()
    })

    it('shows GWG badge for eligible items', () => {
      const gwgExpense = createMockGwgExpense({ description: 'Office Chair' })
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses: [gwgExpense],
      })

      render(<ExpenseList />)

      // GWG badge should be present
      expect(screen.getByText('GWG')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls setSelectedExpense when row is clicked', async () => {
      const expense = createMockExpense()
      const setSelectedExpense = vi.fn()
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses: [expense],
        setSelectedExpense,
      })

      const { user } = render(<ExpenseList />)

      await user.click(screen.getByText(expense.description))

      expect(setSelectedExpense).toHaveBeenCalledWith(expense)
    })

    it('calls deleteExpense when delete button is clicked', async () => {
      const expense = createMockExpense()
      const deleteExpense = vi.fn().mockResolvedValue(true)
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses: [expense],
        deleteExpense,
      })

      // Mock window.confirm to return true
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      const { user } = render(<ExpenseList />)

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await user.click(deleteButton)

      expect(confirmSpy).toHaveBeenCalled()
      expect(deleteExpense).toHaveBeenCalledWith(expense.id)

      confirmSpy.mockRestore()
    })

    it('shows add expense button', () => {
      render(<ExpenseList />)

      expect(screen.getByRole('button', { name: /add expense/i })).toBeInTheDocument()
    })

    it('calls onAddExpense when add button is clicked', async () => {
      const onAddExpense = vi.fn()

      const { user } = render(<ExpenseList onAddExpense={onAddExpense} />)

      await user.click(screen.getByRole('button', { name: /add expense/i }))

      expect(onAddExpense).toHaveBeenCalled()
    })
  })

  describe('filtering', () => {
    it('filters by search term', async () => {
      const expenses = [
        createMockExpense({ description: 'Adobe Subscription', vendor: 'Adobe' }),
        createMockExpense({ description: 'Office Supplies', vendor: 'Amazon' }),
        createMockExpense({ description: 'Adobe License', vendor: 'Adobe' }),
      ]
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses,
      })

      const { user } = render(<ExpenseList />)

      const searchInput = screen.getByPlaceholderText(/search/i)
      await user.type(searchInput, 'Adobe')

      expect(screen.getByText('Adobe Subscription')).toBeInTheDocument()
      expect(screen.getByText('Adobe License')).toBeInTheDocument()
      expect(screen.queryByText('Office Supplies')).not.toBeInTheDocument()
    })

    it('filters by vendor name', async () => {
      const expenses = [
        createMockExpense({ vendor: 'Amazon', description: 'Amazon Purchase 1' }),
        createMockExpense({ vendor: 'Google', description: 'Google Services' }),
        createMockExpense({ vendor: 'Amazon', description: 'Amazon Purchase 2' }),
      ]
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses,
      })

      const { user } = render(<ExpenseList />)

      const searchInput = screen.getByPlaceholderText(/search/i)
      await user.type(searchInput, 'Amazon')

      expect(screen.getByText('Amazon Purchase 1')).toBeInTheDocument()
      expect(screen.getByText('Amazon Purchase 2')).toBeInTheDocument()
      expect(screen.queryByText('Google Services')).not.toBeInTheDocument()
    })
  })

  describe('summary', () => {
    it('shows total amounts', () => {
      const expenses = [
        createMockExpense({ netAmount: 1000, vatAmount: 190, grossAmount: 1190 }),
        createMockExpense({ netAmount: 2000, vatAmount: 380, grossAmount: 2380 }),
      ]
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses,
      })

      render(<ExpenseList />)

      // Total net: 3000, Vorsteuer: 570, Gross: 3570
      expect(screen.getByText(/total/i)).toBeInTheDocument()
      expect(screen.getByText('3.000,00 €')).toBeInTheDocument()
    })

    it('shows total Vorsteuer', () => {
      const expenses = [
        createMockExpense({ netAmount: 1000, vatAmount: 190, grossAmount: 1190 }),
        createMockExpense({ netAmount: 500, vatAmount: 95, grossAmount: 595 }),
      ]
      mockUseExpenses.mockReturnValue({
        ...defaultMockReturn,
        expenses,
      })

      render(<ExpenseList />)

      // Total Vorsteuer: 285
      expect(screen.getByText('285,00 €')).toBeInTheDocument()
    })
  })
})
