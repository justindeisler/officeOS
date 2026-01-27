import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import { UstVoranmeldungList } from './UstVoranmeldungList'
import { useUstVoranmeldung } from '../../hooks/useUstVoranmeldung'
import {
  createMockUstVoranmeldung,
  createMockUstVoranmeldungenForYear,
  createMockFiledUstVoranmeldung,
  createMockUstVoranmeldungWithRefund,
} from '@/test/mocks/data/accounting/reports'

// Mock the hook
vi.mock('../../hooks/useUstVoranmeldung', () => ({
  useUstVoranmeldung: vi.fn(),
}))

const mockUseUstVoranmeldung = vi.mocked(useUstVoranmeldung)

describe('UstVoranmeldungList', () => {
  const mockQuarters = createMockUstVoranmeldungenForYear(2024)

  const defaultMockReturn = {
    ustVoranmeldung: mockQuarters[0],
    allQuarters: mockQuarters,
    isLoading: false,
    error: null,
    selectedYear: 2024,
    selectedQuarter: 1 as const,
    setSelectedYear: vi.fn(),
    setSelectedQuarter: vi.fn(),
    fetchUstVoranmeldung: vi.fn(),
    fetchAllQuarters: vi.fn(),
    markAsFiled: vi.fn(),
    refresh: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseUstVoranmeldung.mockReturnValue(defaultMockReturn)
  })

  describe('rendering', () => {
    it('renders the title', () => {
      render(<UstVoranmeldungList />)

      expect(screen.getByRole('heading', { name: /USt-Voranmeldung/i })).toBeInTheDocument()
    })

    it('renders year selector', () => {
      render(<UstVoranmeldungList />)

      expect(screen.getByLabelText(/Jahr/i)).toBeInTheDocument()
    })

    it('renders quarter tabs', () => {
      render(<UstVoranmeldungList />)

      expect(screen.getByText('Q1')).toBeInTheDocument()
      expect(screen.getByText('Q2')).toBeInTheDocument()
      expect(screen.getByText('Q3')).toBeInTheDocument()
      expect(screen.getByText('Q4')).toBeInTheDocument()
    })

    it('renders VAT summary section', () => {
      render(<UstVoranmeldungList />)

      // Use getAllByText since multiple elements match
      expect(screen.getAllByText(/Umsatzsteuer/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Vorsteuer/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Zahllast/i).length).toBeGreaterThan(0)
    })

    it('renders loading state', () => {
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        ustVoranmeldung: null,
      })
      render(<UstVoranmeldungList />)

      expect(screen.getByText(/loading|laden/i)).toBeInTheDocument()
    })

    it('renders error state', () => {
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        error: 'Failed to load data',
        ustVoranmeldung: null,
      })
      render(<UstVoranmeldungList />)

      expect(screen.getByText(/failed|fehler/i)).toBeInTheDocument()
    })

    it('renders empty state when no data', () => {
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: null,
        allQuarters: [],
      })
      render(<UstVoranmeldungList />)

      expect(screen.getByText(/keine daten|no data/i)).toBeInTheDocument()
    })
  })

  describe('VAT calculations display', () => {
    it('displays Umsatzsteuer 19% amount', () => {
      const ust = createMockUstVoranmeldung({ umsatzsteuer19: 1900 })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      // Amount should be formatted in German currency
      expect(screen.getByText('1.900,00 €')).toBeInTheDocument()
    })

    it('displays Umsatzsteuer 7% amount', () => {
      const ust = createMockUstVoranmeldung({ umsatzsteuer7: 70 })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      expect(screen.getByText('70,00 €')).toBeInTheDocument()
    })

    it('displays total Umsatzsteuer', () => {
      const ust = createMockUstVoranmeldung({
        umsatzsteuer19: 1900,
        umsatzsteuer7: 70,
        totalUmsatzsteuer: 1970,
      })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      expect(screen.getByText('1.970,00 €')).toBeInTheDocument()
    })

    it('displays Vorsteuer amount', () => {
      const ust = createMockUstVoranmeldung({ vorsteuer: 500 })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      expect(screen.getByText('500,00 €')).toBeInTheDocument()
    })

    it('displays Zahllast (positive = owe)', () => {
      const ust = createMockUstVoranmeldung({ zahllast: 1470 })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      expect(screen.getByText('1.470,00 €')).toBeInTheDocument()
    })

    it('displays Zahllast with refund indicator (negative)', () => {
      const ust = createMockUstVoranmeldungWithRefund()
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      // Negative Zahllast means refund - amount shown as positive with Erstattung label
      expect(screen.getAllByText(/erstattung/i).length).toBeGreaterThan(0)
    })
  })

  describe('status display', () => {
    it('displays draft status', () => {
      const ust = createMockUstVoranmeldung({ status: 'draft' })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      expect(screen.getByText(/entwurf|draft/i)).toBeInTheDocument()
    })

    it('displays filed status', () => {
      const ust = createMockFiledUstVoranmeldung()
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      expect(screen.getByText(/gemeldet|filed/i)).toBeInTheDocument()
    })

    it('displays filed date when filed', () => {
      const filedDate = new Date('2024-04-15')
      const ust = createMockFiledUstVoranmeldung({ filedDate })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      // Should show German date format
      expect(screen.getByText(/15\.04\.2024|15\.4\.2024/)).toBeInTheDocument()
    })
  })

  describe('quarter selection', () => {
    it('calls setSelectedQuarter when quarter tab is clicked', async () => {
      const setSelectedQuarter = vi.fn()
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        setSelectedQuarter,
      })
      const { user } = render(<UstVoranmeldungList />)

      await user.click(screen.getByText('Q2'))

      expect(setSelectedQuarter).toHaveBeenCalledWith(2)
    })

    it('highlights selected quarter', () => {
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        selectedQuarter: 2,
      })
      render(<UstVoranmeldungList />)

      const q2Tab = screen.getByText('Q2').closest('button')
      expect(q2Tab).toHaveAttribute('data-state', 'active')
    })
  })

  describe('year selection', () => {
    it('displays current year in selector', () => {
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        selectedYear: 2024,
      })
      render(<UstVoranmeldungList />)

      // The select trigger should show the current year
      const selectTrigger = screen.getByRole('combobox')
      expect(selectTrigger).toHaveTextContent('2024')
    })
  })

  describe('mark as filed', () => {
    it('renders "Mark as Filed" button for draft status', () => {
      const ust = createMockUstVoranmeldung({ status: 'draft' })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      expect(screen.getByRole('button', { name: /gemeldet|markieren/i })).toBeInTheDocument()
    })

    it('hides "Mark as Filed" button for filed status', () => {
      const ust = createMockFiledUstVoranmeldung()
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      expect(screen.queryByRole('button', { name: /gemeldet|markieren/i })).not.toBeInTheDocument()
    })

    it('calls markAsFiled when button is clicked', async () => {
      const markAsFiled = vi.fn()
      const ust = createMockUstVoranmeldung({ status: 'draft', year: 2024, quarter: 1 })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
        markAsFiled,
      })
      const { user } = render(<UstVoranmeldungList />)

      await user.click(screen.getByRole('button', { name: /gemeldet|markieren/i }))

      expect(markAsFiled).toHaveBeenCalledWith(2024, 1)
    })
  })

  describe('print preview', () => {
    it('renders print button', () => {
      render(<UstVoranmeldungList />)

      expect(screen.getByRole('button', { name: /print|drucken/i })).toBeInTheDocument()
    })

    it('calls onPrint when print button is clicked', async () => {
      const onPrint = vi.fn()
      const { user } = render(<UstVoranmeldungList onPrint={onPrint} />)

      await user.click(screen.getByRole('button', { name: /print|drucken/i }))

      expect(onPrint).toHaveBeenCalled()
    })
  })

  describe('period display', () => {
    it('displays period in format YYYY-QN', () => {
      const ust = createMockUstVoranmeldung({ period: '2024-Q1' })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      expect(screen.getByText(/2024-Q1|Q1 2024/)).toBeInTheDocument()
    })

    it('displays date range for quarter', () => {
      const ust = createMockUstVoranmeldung({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
      })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      // Should show date range in German format
      expect(screen.getByText(/01\.01\.2024/)).toBeInTheDocument()
      expect(screen.getByText(/31\.03\.2024/)).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has accessible table structure', () => {
      render(<UstVoranmeldungList />)

      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('has accessible quarter navigation', () => {
      render(<UstVoranmeldungList />)

      const tablist = screen.getByRole('tablist')
      expect(tablist).toBeInTheDocument()
    })
  })

  describe('formatting', () => {
    it('formats all amounts in German currency', () => {
      const ust = createMockUstVoranmeldung({
        umsatzsteuer19: 1234.56,
        umsatzsteuer7: 78.90,
        vorsteuer: 345.67,
        zahllast: 967.79,
      })
      mockUseUstVoranmeldung.mockReturnValue({
        ...defaultMockReturn,
        ustVoranmeldung: ust,
      })
      render(<UstVoranmeldungList />)

      // German format: 1.234,56 €
      expect(screen.getByText('1.234,56 €')).toBeInTheDocument()
      expect(screen.getByText('78,90 €')).toBeInTheDocument()
      expect(screen.getByText('345,67 €')).toBeInTheDocument()
      expect(screen.getByText('967,79 €')).toBeInTheDocument()
    })
  })
})
