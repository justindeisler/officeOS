import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { ProfitabilityDashboard } from './ProfitabilityDashboard'
import { useProfitability } from '../../hooks/useBWA'
import type {
  ProfitabilityByClientReport,
  ProfitabilityByCategoryReport,
} from '../../api/bwa-reports'

// Mock the hook
vi.mock('../../hooks/useBWA', () => ({
  useProfitability: vi.fn(),
}))

// Mock Recharts to avoid rendering issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}))

const mockUseProfitability = vi.mocked(useProfitability)

const mockClientData: ProfitabilityByClientReport = {
  year: 2024,
  clients: [
    {
      client_id: '1',
      client_name: 'Acme Corp',
      income: 50000,
      expenses: 25000,
      profit: 25000,
      profit_margin_percent: 50,
    },
    {
      client_id: '2',
      client_name: 'TechStart GmbH',
      income: 30000,
      expenses: 18000,
      profit: 12000,
      profit_margin_percent: 40,
    },
    {
      client_id: '3',
      client_name: 'Design Studio',
      income: 15000,
      expenses: 12000,
      profit: 3000,
      profit_margin_percent: 20,
    },
  ],
  unassigned: {
    income: 5000,
    expenses: 2000,
    profit: 3000,
  },
}

const mockCategoryData: ProfitabilityByCategoryReport = {
  year: 2024,
  income_categories: [
    { category: 'services', total: 80000 },
    { category: 'consulting', total: 20000 },
  ],
  expense_categories: [
    { category: 'software', category_name: 'Software & Lizenzen', total: 12000 },
    { category: 'hosting', category_name: 'Hosting & Domains', total: 6000 },
    { category: 'telecom', category_name: 'Telekommunikation', total: 3600 },
  ],
}

describe('ProfitabilityDashboard', () => {
  const defaultClientReturn = {
    clientData: mockClientData,
    categoryData: null,
    isLoading: false,
    error: null,
    selectedYear: 2024,
    setSelectedYear: vi.fn(),
    refetch: vi.fn(),
  }

  const defaultCategoryReturn = {
    clientData: null,
    categoryData: mockCategoryData,
    isLoading: false,
    error: null,
    selectedYear: 2024,
    setSelectedYear: vi.fn(),
    refetch: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default: client tab is shown first, so mock for client
    mockUseProfitability.mockImplementation((options) => {
      if (options.type === 'client') {
        return defaultClientReturn
      }
      return defaultCategoryReturn
    })
  })

  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<ProfitabilityDashboard />)
      expect(screen.getAllByText(/Rentabilität/i).length).toBeGreaterThan(0)
    })

    it('renders tab navigation', () => {
      render(<ProfitabilityDashboard />)
      expect(screen.getByText('Nach Kunde')).toBeInTheDocument()
      expect(screen.getByText('Nach Kategorie')).toBeInTheDocument()
    })

    it('renders year in title', () => {
      render(<ProfitabilityDashboard year={2024} />)
      expect(screen.getByText('Rentabilität 2024')).toBeInTheDocument()
    })
  })

  describe('client tab', () => {
    it('renders client names', () => {
      render(<ProfitabilityDashboard />)
      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
      expect(screen.getByText('TechStart GmbH')).toBeInTheDocument()
      expect(screen.getByText('Design Studio')).toBeInTheDocument()
    })

    it('renders client revenue in German format', () => {
      render(<ProfitabilityDashboard />)
      expect(screen.getAllByText('50.000,00 €').length).toBeGreaterThan(0)
    })

    it('renders profit margins', () => {
      render(<ProfitabilityDashboard />)
      // 50% margin for Acme Corp
      expect(screen.getAllByText('50,0 %').length).toBeGreaterThan(0)
    })

    it('renders unassigned row', () => {
      render(<ProfitabilityDashboard />)
      expect(screen.getByText('Nicht zugeordnet')).toBeInTheDocument()
    })

    it('renders table headers', () => {
      render(<ProfitabilityDashboard />)
      expect(screen.getByText('Kunde')).toBeInTheDocument()
      expect(screen.getByText('Umsatz')).toBeInTheDocument()
      expect(screen.getByText('Kosten')).toBeInTheDocument()
      expect(screen.getByText('Marge')).toBeInTheDocument()
    })
  })

  describe('category tab', () => {
    it('switches to category tab', async () => {
      const { user } = render(<ProfitabilityDashboard />)
      await user.click(screen.getByText('Nach Kategorie'))
      // Category tab should now be visible
      expect(screen.getByText(/Ausgaben nach Kategorie/i)).toBeInTheDocument()
    })

    it('renders expense categories', async () => {
      const { user } = render(<ProfitabilityDashboard />)
      await user.click(screen.getByText('Nach Kategorie'))

      expect(screen.getByText('Software & Lizenzen')).toBeInTheDocument()
      expect(screen.getByText('Hosting & Domains')).toBeInTheDocument()
      expect(screen.getByText('Telekommunikation')).toBeInTheDocument()
    })

    it('renders income categories section', async () => {
      const { user } = render(<ProfitabilityDashboard />)
      await user.click(screen.getByText('Nach Kategorie'))

      expect(screen.getByText(/Einnahmen nach Kategorie/i)).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('displays loading message for client tab', () => {
      mockUseProfitability.mockImplementation((options) => {
        if (options.type === 'client') {
          return { ...defaultClientReturn, isLoading: true, clientData: null }
        }
        return defaultCategoryReturn
      })
      render(<ProfitabilityDashboard />)
      expect(screen.getByText(/Laden/i)).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('displays error message', () => {
      mockUseProfitability.mockImplementation((options) => {
        if (options.type === 'client') {
          return {
            ...defaultClientReturn,
            error: 'API nicht erreichbar',
            clientData: null,
          }
        }
        return defaultCategoryReturn
      })
      render(<ProfitabilityDashboard />)
      expect(screen.getByText(/Fehler/i)).toBeInTheDocument()
      expect(screen.getByText(/API nicht erreichbar/i)).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('displays empty state when no client data', () => {
      mockUseProfitability.mockImplementation((options) => {
        if (options.type === 'client') {
          return {
            ...defaultClientReturn,
            clientData: { year: 2024, clients: [], unassigned: { income: 0, expenses: 0, profit: 0 } },
          }
        }
        return defaultCategoryReturn
      })
      render(<ProfitabilityDashboard />)
      expect(screen.getByText(/Keine Kundendaten/i)).toBeInTheDocument()
    })
  })

  describe('year selector', () => {
    it('renders year selector', () => {
      render(<ProfitabilityDashboard />)
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })

  describe('print', () => {
    it('renders print button', () => {
      render(<ProfitabilityDashboard />)
      expect(
        screen.getByRole('button', { name: /Drucken/i })
      ).toBeInTheDocument()
    })
  })
})
