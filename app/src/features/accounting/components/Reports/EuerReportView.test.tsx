import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { EuerReportView } from './EuerReportView'
import { useEuerReport } from '../../hooks/useEuerReport'
import {
  createMockEuerReport,
  createMockEuerReportWithLoss,
} from '@/test/mocks/data/accounting/reports'
import { EUER_LINES } from '../../types'

// Mock the hook
vi.mock('../../hooks/useEuerReport', () => ({
  useEuerReport: vi.fn(),
}))

const mockUseEuerReport = vi.mocked(useEuerReport)

describe('EuerReportView', () => {
  const mockEuerReport = createMockEuerReport({ year: 2024 })

  const mockLineDetails = {
    income: [
      { line: 14, name: 'Betriebseinnahmen', description: 'Standard taxable business income' },
      { line: 18, name: 'USt-Erstattung', description: 'VAT refunds from tax office' },
    ],
    expenses: [
      { line: 25, name: 'Fremdleistungen', description: 'Subcontractors' },
      { line: 27, name: 'Vorsteuer', description: 'Input VAT' },
      { line: 28, name: 'Gezahlte USt', description: 'Output VAT paid' },
      { line: 30, name: 'AfA', description: 'Depreciation' },
      { line: 33, name: 'Arbeitszimmer', description: 'Home office' },
      { line: 34, name: 'Sonstige', description: 'Other expenses' },
    ],
  }

  const defaultMockReturn = {
    euerReport: mockEuerReport,
    isLoading: false,
    error: null,
    selectedYear: 2024,
    setSelectedYear: vi.fn(),
    fetchEuerReport: vi.fn(),
    getLineDetails: vi.fn(() => mockLineDetails),
    refresh: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseEuerReport.mockReturnValue(defaultMockReturn)
  })

  describe('rendering', () => {
    it('renders the title with year', () => {
      render(<EuerReportView />)

      expect(screen.getByRole('heading', { name: /EÜR/i })).toBeInTheDocument()
      // Year appears in both title and selector
      expect(screen.getAllByText(/2024/).length).toBeGreaterThan(0)
    })

    it('renders year selector', () => {
      render(<EuerReportView />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('renders income section', () => {
      render(<EuerReportView />)

      // "Einnahmen" appears in section header and "Summe Einnahmen"
      expect(screen.getAllByText(/Einnahmen/i).length).toBeGreaterThan(0)
    })

    it('renders expenses section', () => {
      render(<EuerReportView />)

      // "Ausgaben" appears in section header and "Summe Ausgaben"
      expect(screen.getAllByText(/Ausgaben/i).length).toBeGreaterThan(0)
    })

    it('renders profit/loss section', () => {
      render(<EuerReportView />)

      expect(screen.getAllByText(/Gewinn|Verlust/i).length).toBeGreaterThan(0)
    })

    it('renders loading state', () => {
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        euerReport: null,
      })
      render(<EuerReportView />)

      expect(screen.getByText(/loading|laden/i)).toBeInTheDocument()
    })

    it('renders error state', () => {
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        error: 'Failed to load report',
        euerReport: null,
      })
      render(<EuerReportView />)

      expect(screen.getByText(/failed|fehler/i)).toBeInTheDocument()
    })

    it('renders empty state when no data', () => {
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: null,
      })
      render(<EuerReportView />)

      expect(screen.getByText(/keine daten|no data/i)).toBeInTheDocument()
    })
  })

  describe('EÜR line display', () => {
    it('displays Line 14 (Betriebseinnahmen)', () => {
      render(<EuerReportView />)

      expect(screen.getByText(/Zeile 14|Line 14/i)).toBeInTheDocument()
      expect(screen.getByText(/Betriebseinnahmen/i)).toBeInTheDocument()
    })

    it('displays Line 25 (Fremdleistungen)', () => {
      render(<EuerReportView />)

      expect(screen.getByText(/Zeile 25|Line 25/i)).toBeInTheDocument()
      expect(screen.getByText(/Fremdleistungen/i)).toBeInTheDocument()
    })

    it('displays Line 27 (Vorsteuer)', () => {
      render(<EuerReportView />)

      expect(screen.getByText(/Zeile 27|Line 27/i)).toBeInTheDocument()
    })

    it('displays Line 30 (AfA)', () => {
      render(<EuerReportView />)

      expect(screen.getByText(/Zeile 30|Line 30/i)).toBeInTheDocument()
      expect(screen.getByText(/AfA/i)).toBeInTheDocument()
    })

    it('displays Line 33 (Arbeitszimmer)', () => {
      render(<EuerReportView />)

      expect(screen.getByText(/Zeile 33|Line 33/i)).toBeInTheDocument()
      expect(screen.getByText(/Arbeitszimmer/i)).toBeInTheDocument()
    })

    it('displays Line 34 (Sonstige)', () => {
      render(<EuerReportView />)

      expect(screen.getByText(/Zeile 34|Line 34/i)).toBeInTheDocument()
      expect(screen.getByText(/Sonstige/i)).toBeInTheDocument()
    })
  })

  describe('amounts display', () => {
    it('displays income amounts in German currency', () => {
      const report = createMockEuerReport({
        income: { [EUER_LINES.BETRIEBSEINNAHMEN]: 60000 },
      })
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: report,
      })
      render(<EuerReportView />)

      // Amount may appear multiple times (line item + total if same value)
      expect(screen.getAllByText('60.000,00 €').length).toBeGreaterThan(0)
    })

    it('displays expense amounts in German currency', () => {
      const report = createMockEuerReport({
        expenses: { [EUER_LINES.SONSTIGE]: 4000 },
      })
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: report,
      })
      render(<EuerReportView />)

      // Amount may appear multiple times (line item + total if same value)
      expect(screen.getAllByText('4.000,00 €').length).toBeGreaterThan(0)
    })

    it('displays total income', () => {
      const report = createMockEuerReport({ totalIncome: 60500 })
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: report,
      })
      render(<EuerReportView />)

      expect(screen.getByText('60.500,00 €')).toBeInTheDocument()
    })

    it('displays total expenses', () => {
      const report = createMockEuerReport({ totalExpenses: 22760 })
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: report,
      })
      render(<EuerReportView />)

      expect(screen.getByText('22.760,00 €')).toBeInTheDocument()
    })

    it('displays Gewinn (profit)', () => {
      const report = createMockEuerReport({ gewinn: 37740 })
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: report,
      })
      render(<EuerReportView />)

      expect(screen.getByText('37.740,00 €')).toBeInTheDocument()
    })
  })

  describe('profit/loss styling', () => {
    it('shows profit in green', () => {
      const report = createMockEuerReport({ gewinn: 50000 })
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: report,
      })
      render(<EuerReportView />)

      const profitCell = screen.getByText('50.000,00 €')
      expect(profitCell).toHaveClass('text-green-600')
    })

    it('shows loss in red', () => {
      const report = createMockEuerReportWithLoss()
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: report,
      })
      render(<EuerReportView />)

      // Find the Verlust amount - should have red styling
      const cells = screen.getAllByText(/€/)
      const hasRedClass = cells.some((cell) => cell.classList.contains('text-red-600'))
      expect(hasRedClass).toBe(true)
    })
  })

  describe('print/export', () => {
    it('renders print button', () => {
      render(<EuerReportView />)

      expect(screen.getByRole('button', { name: /print|drucken/i })).toBeInTheDocument()
    })

    it('renders export button', () => {
      render(<EuerReportView />)

      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
    })

    it('calls onPrint when print button is clicked', async () => {
      const onPrint = vi.fn()
      const { user } = render(<EuerReportView onPrint={onPrint} />)

      await user.click(screen.getByRole('button', { name: /print|drucken/i }))

      expect(onPrint).toHaveBeenCalled()
    })

    it('calls onExport when export button is clicked', async () => {
      const onExport = vi.fn()
      const { user } = render(<EuerReportView onExport={onExport} />)

      await user.click(screen.getByRole('button', { name: /export/i }))

      expect(onExport).toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('has accessible table structure', () => {
      render(<EuerReportView />)

      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('has column headers', () => {
      render(<EuerReportView />)

      const headers = screen.getAllByRole('columnheader')
      expect(headers.length).toBeGreaterThan(0)
    })
  })

  describe('homeoffice pauschale', () => {
    it('displays Homeoffice-Pauschale amount', () => {
      const report = createMockEuerReport({
        expenses: { [EUER_LINES.ARBEITSZIMMER]: 1260 },
      })
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: report,
      })
      render(<EuerReportView />)

      // Should show €1,260 Homeoffice-Pauschale (may appear multiple times due to defaults)
      expect(screen.getAllByText('1.260,00 €').length).toBeGreaterThan(0)
    })
  })
})
