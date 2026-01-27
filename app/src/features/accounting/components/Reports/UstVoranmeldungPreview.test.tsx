import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { UstVoranmeldungPreview } from './UstVoranmeldungPreview'
import {
  createMockUstVoranmeldung,
  createMockFiledUstVoranmeldung,
  createMockUstVoranmeldungWithRefund,
} from '@/test/mocks/data/accounting/reports'

describe('UstVoranmeldungPreview', () => {
  const mockUst = createMockUstVoranmeldung({ year: 2024, quarter: 1 })

  describe('rendering', () => {
    it('renders the title', () => {
      render(<UstVoranmeldungPreview ustVoranmeldung={mockUst} />)

      expect(screen.getByRole('heading', { name: /USt-Voranmeldung/i })).toBeInTheDocument()
    })

    it('renders the period', () => {
      render(<UstVoranmeldungPreview ustVoranmeldung={mockUst} />)

      expect(screen.getByText(/2024-Q1|Q1 2024/)).toBeInTheDocument()
    })

    it('renders company info section', () => {
      render(<UstVoranmeldungPreview ustVoranmeldung={mockUst} />)

      // Should have a placeholder for company info (word appears multiple times)
      expect(screen.getAllByText(/steuerpflichtige|unternehmen/i).length).toBeGreaterThan(0)
    })

    it('renders date range', () => {
      render(<UstVoranmeldungPreview ustVoranmeldung={mockUst} />)

      // Should show date range in German format
      expect(screen.getByText(/01\.01\.2024/)).toBeInTheDocument()
      expect(screen.getByText(/31\.03\.2024/)).toBeInTheDocument()
    })
  })

  describe('VAT calculations', () => {
    it('displays Umsatzsteuer 19%', () => {
      const ust = createMockUstVoranmeldung({ umsatzsteuer19: 1900 })
      render(<UstVoranmeldungPreview ustVoranmeldung={ust} />)

      expect(screen.getByText('1.900,00 €')).toBeInTheDocument()
    })

    it('displays Umsatzsteuer 7%', () => {
      const ust = createMockUstVoranmeldung({ umsatzsteuer7: 70 })
      render(<UstVoranmeldungPreview ustVoranmeldung={ust} />)

      expect(screen.getByText('70,00 €')).toBeInTheDocument()
    })

    it('displays total Umsatzsteuer', () => {
      const ust = createMockUstVoranmeldung({ totalUmsatzsteuer: 1970 })
      render(<UstVoranmeldungPreview ustVoranmeldung={ust} />)

      expect(screen.getByText('1.970,00 €')).toBeInTheDocument()
    })

    it('displays Vorsteuer', () => {
      const ust = createMockUstVoranmeldung({ vorsteuer: 500 })
      render(<UstVoranmeldungPreview ustVoranmeldung={ust} />)

      expect(screen.getByText('500,00 €')).toBeInTheDocument()
    })

    it('displays Zahllast (amount owed)', () => {
      const ust = createMockUstVoranmeldung({ zahllast: 1470 })
      render(<UstVoranmeldungPreview ustVoranmeldung={ust} />)

      expect(screen.getByText('1.470,00 €')).toBeInTheDocument()
    })

    it('displays Erstattung (refund) correctly', () => {
      const ust = createMockUstVoranmeldungWithRefund()
      render(<UstVoranmeldungPreview ustVoranmeldung={ust} />)

      // Should indicate refund
      expect(screen.getAllByText(/erstattung/i).length).toBeGreaterThan(0)
    })
  })

  describe('status display', () => {
    it('shows draft status', () => {
      const ust = createMockUstVoranmeldung({ status: 'draft' })
      render(<UstVoranmeldungPreview ustVoranmeldung={ust} />)

      expect(screen.getByText(/entwurf|draft/i)).toBeInTheDocument()
    })

    it('shows filed status', () => {
      const ust = createMockFiledUstVoranmeldung()
      render(<UstVoranmeldungPreview ustVoranmeldung={ust} />)

      // "Gemeldet" appears multiple times (badge + "Gemeldet am:" text)
      expect(screen.getAllByText(/gemeldet/i).length).toBeGreaterThan(0)
    })

    it('shows filed date when filed', () => {
      const filedDate = new Date('2024-04-15')
      const ust = createMockFiledUstVoranmeldung({ filedDate })
      render(<UstVoranmeldungPreview ustVoranmeldung={ust} />)

      expect(screen.getByText(/15\.04\.2024|15\.4\.2024/)).toBeInTheDocument()
    })
  })

  describe('print styling', () => {
    it('has print-friendly class', () => {
      const { container } = render(<UstVoranmeldungPreview ustVoranmeldung={mockUst} />)

      // Check for print-friendly wrapper
      expect(container.querySelector('.print\\:bg-white, [class*="print"]')).toBeTruthy()
    })

    it('renders table structure', () => {
      render(<UstVoranmeldungPreview ustVoranmeldung={mockUst} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
    })
  })

  describe('Kennzahlen (tax form field numbers)', () => {
    it('displays Kennzahl for Umsatzsteuer 19%', () => {
      render(<UstVoranmeldungPreview ustVoranmeldung={mockUst} />)

      // KZ 81 is the field for 19% VAT
      expect(screen.getByText(/KZ 81|Kennzahl 81/i)).toBeInTheDocument()
    })

    it('displays Kennzahl for Vorsteuer', () => {
      render(<UstVoranmeldungPreview ustVoranmeldung={mockUst} />)

      // KZ 66 is the field for input VAT
      expect(screen.getByText(/KZ 66|Kennzahl 66/i)).toBeInTheDocument()
    })
  })

  describe('formatting', () => {
    it('formats all amounts in German currency', () => {
      const ust = createMockUstVoranmeldung({
        umsatzsteuer19: 1234.56,
        vorsteuer: 345.67,
      })
      render(<UstVoranmeldungPreview ustVoranmeldung={ust} />)

      // German format: 1.234,56 €
      expect(screen.getByText('1.234,56 €')).toBeInTheDocument()
      expect(screen.getByText('345,67 €')).toBeInTheDocument()
    })

    it('formats dates in German format', () => {
      const ust = createMockUstVoranmeldung({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
      })
      render(<UstVoranmeldungPreview ustVoranmeldung={ust} />)

      // German date format: DD.MM.YYYY
      expect(screen.getByText(/01\.01\.2024/)).toBeInTheDocument()
      expect(screen.getByText(/31\.03\.2024/)).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('has accessible table structure', () => {
      render(<UstVoranmeldungPreview ustVoranmeldung={mockUst} />)

      expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('has column headers', () => {
      render(<UstVoranmeldungPreview ustVoranmeldung={mockUst} />)

      const headers = screen.getAllByRole('columnheader')
      expect(headers.length).toBeGreaterThan(0)
    })
  })
})
