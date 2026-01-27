import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { AccountingDashboard } from './AccountingDashboard'
import {
  createMockDashboardStats,
  createEmptyDashboardStats,
  createLossDashboardStats,
  createHighActivityDashboardStats,
} from '@/test/mocks/data/accounting'

// Mock the useAccountingStats hook
vi.mock('../../hooks/useAccountingStats', () => ({
  useAccountingStats: vi.fn(),
  default: vi.fn(),
}))

// Mock the useReportData hook to avoid database calls in tests
vi.mock('../../hooks/useReportData', () => ({
  useReportData: vi.fn(() => ({
    plChartData: [],
    profitTrendData: [],
    expenseDonutData: [],
    categoryBreakdown: [],
    taxForecast: null,
    yearComparison: [],
    currentYear: 2024,
    previousYear: 2023,
    isLoading: false,
    error: null,
  })),
  default: vi.fn(() => ({
    plChartData: [],
    profitTrendData: [],
    expenseDonutData: [],
    categoryBreakdown: [],
    taxForecast: null,
    yearComparison: [],
    currentYear: 2024,
    previousYear: 2023,
    isLoading: false,
    error: null,
  })),
}))

import { useAccountingStats } from '../../hooks/useAccountingStats'

const mockUseAccountingStats = vi.mocked(useAccountingStats)

describe('AccountingDashboard', () => {
  const defaultMockReturn = {
    stats: createMockDashboardStats(),
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    year: 2024,
    quarter: 1 as const,
    setYear: vi.fn(),
    setQuarter: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAccountingStats.mockReturnValue(defaultMockReturn)
  })

  describe('rendering', () => {
    it('renders the dashboard title', () => {
      render(<AccountingDashboard />)

      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
    })

    it('renders loading state', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        stats: null,
      })

      render(<AccountingDashboard />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('renders error state', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        error: 'Failed to load stats',
        stats: null,
      })

      render(<AccountingDashboard />)

      expect(screen.getByText(/failed to load stats/i)).toBeInTheDocument()
    })

    it('renders all stat cards', () => {
      render(<AccountingDashboard />)

      expect(screen.getByText(/total income/i)).toBeInTheDocument()
      expect(screen.getByText(/total expenses/i)).toBeInTheDocument()
      expect(screen.getByText(/profit/i)).toBeInTheDocument()
      expect(screen.getByText(/pending invoices/i)).toBeInTheDocument()
    })

    it('renders empty state when no activity', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createEmptyDashboardStats(),
      })

      render(<AccountingDashboard />)

      // Should show zero values
      const zeroAmounts = screen.getAllByText('0,00 €')
      expect(zeroAmounts.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('stat cards', () => {
    it('displays total income in German currency format', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createMockDashboardStats({ totalIncome: 15000 }),
      })

      render(<AccountingDashboard />)

      expect(screen.getByText('15.000,00 €')).toBeInTheDocument()
    })

    it('displays total expenses in German currency format', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createMockDashboardStats({ totalExpenses: 5000 }),
      })

      render(<AccountingDashboard />)

      expect(screen.getByText('5.000,00 €')).toBeInTheDocument()
    })

    it('displays profit in German currency format', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createMockDashboardStats({ profit: 10000 }),
      })

      render(<AccountingDashboard />)

      expect(screen.getByText('10.000,00 €')).toBeInTheDocument()
    })

    it('displays pending invoices count', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createMockDashboardStats({ pendingInvoices: 3 }),
      })

      render(<AccountingDashboard />)

      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('displays pending amount in German currency format', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createMockDashboardStats({ pendingAmount: 4500 }),
      })

      render(<AccountingDashboard />)

      expect(screen.getByText('4.500,00 €')).toBeInTheDocument()
    })

    it('displays current quarter VAT in German currency format', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createMockDashboardStats({ currentQuarterVat: 1900 }),
      })

      render(<AccountingDashboard />)

      expect(screen.getByText('1.900,00 €')).toBeInTheDocument()
    })
  })

  describe('profit display', () => {
    it('shows positive profit with success styling', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createMockDashboardStats({ profit: 10000 }),
      })

      render(<AccountingDashboard />)

      const profitCard = screen.getByText('10.000,00 €').closest('[data-testid="profit-card"]')
      expect(profitCard).toHaveClass('text-green-600')
    })

    it('shows negative profit (loss) with danger styling', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createLossDashboardStats(),
      })

      render(<AccountingDashboard />)

      const profitCard = screen.getByText('-3.000,00 €').closest('[data-testid="profit-card"]')
      expect(profitCard).toHaveClass('text-red-600')
    })

    it('shows zero profit with neutral styling', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createMockDashboardStats({ profit: 0 }),
      })

      render(<AccountingDashboard />)

      const profitCard = screen.getByText(/profit/i).closest('[data-testid="profit-card"]')
      expect(profitCard).not.toHaveClass('text-green-600')
      expect(profitCard).not.toHaveClass('text-red-600')
    })
  })

  describe('pending invoices', () => {
    it('shows warning indicator when invoices are pending', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createMockDashboardStats({ pendingInvoices: 5 }),
      })

      render(<AccountingDashboard />)

      expect(screen.getByText('5')).toBeInTheDocument()
      // Check for warning styling or icon
      const pendingCard = screen.getByText(/pending invoices/i).closest('[data-testid="pending-card"]')
      expect(pendingCard).toBeInTheDocument()
    })

    it('shows no warning when no pending invoices', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createMockDashboardStats({ pendingInvoices: 0, pendingAmount: 0 }),
      })

      render(<AccountingDashboard />)

      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  describe('VAT section', () => {
    it('displays VAT label', () => {
      render(<AccountingDashboard />)

      expect(screen.getByText(/vat|ust/i)).toBeInTheDocument()
    })

    it('displays current quarter context', () => {
      render(<AccountingDashboard />)

      expect(screen.getByText(/current quarter.*q[1-4]/i)).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls refresh when refresh button is clicked', async () => {
      const refresh = vi.fn()
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        refresh,
      })

      const { user } = render(<AccountingDashboard />)

      await user.click(screen.getByRole('button', { name: /refresh/i }))

      expect(refresh).toHaveBeenCalled()
    })

    it('navigates to invoices when pending invoices card is clicked', async () => {
      const onNavigate = vi.fn()
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createMockDashboardStats({ pendingInvoices: 3 }),
      })

      const { user } = render(<AccountingDashboard onNavigate={onNavigate} />)

      const pendingCard = screen.getByTestId('pending-card')
      await user.click(pendingCard)

      expect(onNavigate).toHaveBeenCalledWith('invoices')
    })
  })

  describe('high activity', () => {
    it('displays large numbers correctly formatted', () => {
      mockUseAccountingStats.mockReturnValue({
        ...defaultMockReturn,
        stats: createHighActivityDashboardStats(),
      })

      render(<AccountingDashboard />)

      expect(screen.getByText('150.000,00 €')).toBeInTheDocument()
      expect(screen.getByText('45.000,00 €')).toBeInTheDocument()
      expect(screen.getByText('105.000,00 €')).toBeInTheDocument()
    })
  })

  describe('time period', () => {
    it('displays current year by default', () => {
      render(<AccountingDashboard />)

      const currentYear = new Date().getFullYear().toString()
      expect(screen.getByText(new RegExp(currentYear))).toBeInTheDocument()
    })

    it('allows changing time period', async () => {
      const { user } = render(<AccountingDashboard />)

      // Look for period selector
      const periodSelect = screen.getByLabelText(/period|year/i)
      expect(periodSelect).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has accessible stat card labels', () => {
      render(<AccountingDashboard />)

      // Each stat should be associated with its label
      expect(screen.getByLabelText(/total income/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/total expenses/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/profit/i)).toBeInTheDocument()
    })

    it('has keyboard accessible cards', () => {
      render(<AccountingDashboard />)

      const pendingCard = screen.getByTestId('pending-card')
      expect(pendingCard).toHaveAttribute('tabIndex', '0')
    })
  })
})
