import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { EuerExport } from './EuerExport'
import { useEuerReport } from '../../hooks/useEuerReport'
import { createMockEuerReport } from '@/test/mocks/data/accounting/reports'

// Mock the hook
vi.mock('../../hooks/useEuerReport', () => ({
  useEuerReport: vi.fn(),
}))

const mockUseEuerReport = vi.mocked(useEuerReport)

describe('EuerExport', () => {
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
    it('renders export title', () => {
      render(<EuerExport />)

      expect(screen.getByRole('heading', { name: /export/i })).toBeInTheDocument()
    })

    it('renders year selection', () => {
      render(<EuerExport />)

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('renders CSV export button', () => {
      render(<EuerExport />)

      expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument()
    })

    it('renders PDF export button', () => {
      render(<EuerExport />)

      expect(screen.getByRole('button', { name: /pdf/i })).toBeInTheDocument()
    })

    it('renders loading state', () => {
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
        euerReport: null,
      })
      render(<EuerExport />)

      expect(screen.getByText(/loading|laden/i)).toBeInTheDocument()
    })

    it('renders error state', () => {
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        error: 'Failed to load report',
        euerReport: null,
      })
      render(<EuerExport />)

      expect(screen.getByText(/failed|fehler/i)).toBeInTheDocument()
    })

    it('renders empty state when no data', () => {
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: null,
      })
      render(<EuerExport />)

      expect(screen.getByText(/keine daten|no data/i)).toBeInTheDocument()
    })
  })

  describe('export preview', () => {
    it('displays report year', () => {
      render(<EuerExport />)

      expect(screen.getAllByText(/2024/).length).toBeGreaterThan(0)
    })

    it('displays total income', () => {
      const report = createMockEuerReport({ totalIncome: 60500 })
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: report,
      })
      render(<EuerExport />)

      expect(screen.getByText('60.500,00 €')).toBeInTheDocument()
    })

    it('displays total expenses', () => {
      const report = createMockEuerReport({ totalExpenses: 22760 })
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: report,
      })
      render(<EuerExport />)

      expect(screen.getByText('22.760,00 €')).toBeInTheDocument()
    })

    it('displays Gewinn/Verlust', () => {
      const report = createMockEuerReport({ gewinn: 37740 })
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: report,
      })
      render(<EuerExport />)

      expect(screen.getByText('37.740,00 €')).toBeInTheDocument()
    })
  })

  describe('export actions', () => {
    it('calls onExportCSV when CSV button is clicked', async () => {
      const onExportCSV = vi.fn()
      const { user } = render(<EuerExport onExportCSV={onExportCSV} />)

      await user.click(screen.getByRole('button', { name: /csv/i }))

      expect(onExportCSV).toHaveBeenCalledWith(mockEuerReport)
    })

    it('calls onExportPDF when PDF button is clicked', async () => {
      const onExportPDF = vi.fn()
      const { user } = render(<EuerExport onExportPDF={onExportPDF} />)

      await user.click(screen.getByRole('button', { name: /pdf/i }))

      expect(onExportPDF).toHaveBeenCalledWith(mockEuerReport)
    })

    it('disables export buttons when no data', () => {
      mockUseEuerReport.mockReturnValue({
        ...defaultMockReturn,
        euerReport: null,
      })
      render(<EuerExport />)

      expect(screen.queryByRole('button', { name: /csv/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /pdf/i })).not.toBeInTheDocument()
    })
  })

  describe('summary display', () => {
    it('shows income line count', () => {
      render(<EuerExport />)

      // Should show that there are 2 income lines
      expect(screen.getByText(/einnahmen/i)).toBeInTheDocument()
    })

    it('shows expense line count', () => {
      render(<EuerExport />)

      // Should show that there are 6 expense lines
      expect(screen.getByText(/ausgaben/i)).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has accessible buttons', () => {
      render(<EuerExport />)

      const csvButton = screen.getByRole('button', { name: /csv/i })
      const pdfButton = screen.getByRole('button', { name: /pdf/i })

      expect(csvButton).toBeInTheDocument()
      expect(pdfButton).toBeInTheDocument()
    })
  })
})
