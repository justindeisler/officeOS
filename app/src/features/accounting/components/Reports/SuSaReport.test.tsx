import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { SuSaReport } from './SuSaReport'
import { useSuSa } from '../../hooks/useBWA'
import type { SuSaReport as SuSaReportType, SuSaAccount } from '../../api/bwa-reports'

// Mock the hook
vi.mock('../../hooks/useBWA', () => ({
  useSuSa: vi.fn(),
}))

const mockUseSuSa = vi.mocked(useSuSa)

/**
 * Create mock SuSa accounts
 */
function createMockSuSaReport(
  overrides: Partial<SuSaReportType> = {}
): SuSaReportType {
  return {
    year: 2024,
    accounts: [
      {
        account_number: '1576',
        account_name: 'Abziehbare Vorsteuer 19%',
        debit: 3500,
        credit: 0,
        balance: 3500,
      },
      {
        account_number: '1776',
        account_name: 'Umsatzsteuer 19%',
        debit: 0,
        credit: 11400,
        balance: -11400,
      },
      {
        account_number: '4920',
        account_name: 'Telefon / Internet',
        debit: 1200,
        credit: 0,
        balance: 1200,
      },
      {
        account_number: '4964',
        account_name: 'Aufwand für Software & Lizenzen',
        debit: 4500,
        credit: 0,
        balance: 4500,
      },
      {
        account_number: '8400',
        account_name: 'Erlöse 19% USt',
        debit: 0,
        credit: 60000,
        balance: -60000,
      },
    ],
    ...overrides,
  }
}

describe('SuSaReport', () => {
  const mockData = createMockSuSaReport()

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
    mockUseSuSa.mockReturnValue(defaultMockReturn)
  })

  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<SuSaReport />)
      expect(screen.getAllByText(/Summen- und Saldenliste/i).length).toBeGreaterThan(0)
    })

    it('renders column headers', () => {
      render(<SuSaReport />)
      expect(screen.getByText('Konto')).toBeInTheDocument()
      expect(screen.getByText('Kontobezeichnung')).toBeInTheDocument()
      expect(screen.getByText('Soll')).toBeInTheDocument()
      expect(screen.getByText('Haben')).toBeInTheDocument()
      expect(screen.getByText('Saldo')).toBeInTheDocument()
    })

    it('renders account numbers', () => {
      render(<SuSaReport />)
      expect(screen.getByText('1576')).toBeInTheDocument()
      expect(screen.getByText('8400')).toBeInTheDocument()
    })

    it('renders account names', () => {
      render(<SuSaReport />)
      expect(screen.getByText('Abziehbare Vorsteuer 19%')).toBeInTheDocument()
      expect(screen.getByText('Erlöse 19% USt')).toBeInTheDocument()
    })

    it('renders group headers', () => {
      render(<SuSaReport />)
      expect(screen.getAllByText(/Finanz- & Umsatzsteuerkonten/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Aufwendungen/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Erlöse/i).length).toBeGreaterThan(0)
    })

    it('renders grand total row', () => {
      render(<SuSaReport />)
      expect(screen.getByText('Gesamtsumme')).toBeInTheDocument()
    })
  })

  describe('currency formatting', () => {
    it('displays amounts in German currency format', () => {
      render(<SuSaReport />)
      // 60.000,00 € for Erlöse credit
      expect(screen.getAllByText('60.000,00 €').length).toBeGreaterThan(0)
    })
  })

  describe('year selector', () => {
    it('renders year selector', () => {
      render(<SuSaReport />)
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('calls setSelectedYear when year changes', async () => {
      const setSelectedYear = vi.fn()
      mockUseSuSa.mockReturnValue({
        ...defaultMockReturn,
        setSelectedYear,
      })
      const { user } = render(<SuSaReport />)

      await user.click(screen.getByRole('combobox'))
      const option2023 = screen.getByText('2023')
      await user.click(option2023)

      expect(setSelectedYear).toHaveBeenCalledWith(2023)
    })
  })

  describe('loading state', () => {
    it('displays loading message', () => {
      mockUseSuSa.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        data: null,
      })
      render(<SuSaReport />)
      expect(screen.getByText(/Laden/i)).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('displays error message', () => {
      mockUseSuSa.mockReturnValue({
        ...defaultMockReturn,
        error: 'Datenbankfehler',
        data: null,
      })
      render(<SuSaReport />)
      expect(screen.getByText(/Fehler/i)).toBeInTheDocument()
      expect(screen.getByText(/Datenbankfehler/i)).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('displays empty state when no data', () => {
      mockUseSuSa.mockReturnValue({
        ...defaultMockReturn,
        data: null,
      })
      render(<SuSaReport />)
      expect(screen.getByText(/Keine Daten/i)).toBeInTheDocument()
    })

    it('displays empty state when all accounts have zero balance', () => {
      mockUseSuSa.mockReturnValue({
        ...defaultMockReturn,
        data: {
          year: 2024,
          accounts: [
            {
              account_number: '8400',
              account_name: 'Erlöse',
              debit: 0,
              credit: 0,
              balance: 0,
            },
          ],
        },
      })
      render(<SuSaReport />)
      expect(screen.getByText(/Keine Daten/i)).toBeInTheDocument()
    })
  })

  describe('export and print', () => {
    it('renders CSV export button', () => {
      render(<SuSaReport />)
      expect(
        screen.getByRole('button', { name: /CSV Export/i })
      ).toBeInTheDocument()
    })

    it('renders print button', () => {
      render(<SuSaReport />)
      expect(
        screen.getByRole('button', { name: /Drucken/i })
      ).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has accessible table structure', () => {
      render(<SuSaReport />)
      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('has column headers', () => {
      render(<SuSaReport />)
      const headers = screen.getAllByRole('columnheader')
      expect(headers.length).toBe(5) // Konto, Name, Soll, Haben, Saldo
    })
  })
})
