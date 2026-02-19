import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { InvoicePreview } from './InvoicePreview'
import { createMockInvoice, createMockPaidInvoice } from '@/test/mocks/data/accounting'

// Mock settingsStore so InvoicePreview doesn't need full store setup
vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: () => ({
    businessProfile: {
      fullName: 'Justin Deisler',
      jobTitle: 'Full-Stack Developer',
      email: 'kontakt@justin-deisler.com',
      phone: '',
      street: 'Musterstraße 1',
      postalCode: '12345',
      city: 'Berlin',
      country: 'Deutschland',
      taxId: '12/345/67890',
      vatId: '',
      bankAccountHolder: 'Justin Deisler',
      bankName: 'Musterbank',
      bankIban: 'DE89370400440532013000',
      bankBic: 'COBADEFFXXX',
    },
  }),
}))

const mockClient = {
  id: 'client-1',
  name: 'Acme GmbH',
  company: 'Acme Corp',
  email: 'info@acme.de',
  status: 'active' as const,
  address: {
    street: 'Hauptstraße 10',
    zip: '10115',
    city: 'Berlin',
    country: 'Deutschland',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('InvoicePreview', () => {
  describe('rendering', () => {
    it('renders invoice number', () => {
      const invoice = createMockInvoice({ invoiceNumber: 'RE-2024-001' })
      render(<InvoicePreview invoice={invoice} />)

      // Invoice number appears in header badge AND Verwendungszweck
      const elements = screen.getAllByText('RE-2024-001')
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })

    it('renders Rechnung title', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Rechnung')).toBeInTheDocument()
    })

    it('renders invoice date in German format', () => {
      const invoice = createMockInvoice({
        invoiceDate: new Date('2024-03-15'),
        // Set dueDate to different date so no duplication
        dueDate: new Date('2024-03-29'),
      })
      render(<InvoicePreview invoice={invoice} />)

      // Rechnungsdatum and Leistungsdatum both show same invoiceDate
      const elements = screen.getAllByText('15.03.2024')
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })

    it('renders due date in German format', () => {
      const invoice = createMockInvoice({
        dueDate: new Date('2024-03-29'),
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('29.03.2024')).toBeInTheDocument()
    })

    it('renders status badge in German', () => {
      const invoice = createMockInvoice({ status: 'sent' })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Versendet')).toBeInTheDocument()
    })

    it('renders notes when present', () => {
      const invoice = createMockInvoice({ notes: 'Zahlbar innerhalb 14 Tage' })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Zahlbar innerhalb 14 Tage')).toBeInTheDocument()
    })

    it('does not render notes section when empty', () => {
      const invoice = createMockInvoice({ notes: undefined })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.queryByText('Hinweise')).not.toBeInTheDocument()
    })
  })

  describe('client address', () => {
    it('renders client name when client prop provided', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} client={mockClient} />)

      // Client name appears in the recipient section
      const elements = screen.getAllByText('Acme GmbH')
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })

    it('renders client address when provided', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} client={mockClient} />)

      expect(screen.getByText('Hauptstraße 10')).toBeInTheDocument()
      expect(screen.getByText(/10115.*Berlin|Berlin.*10115/)).toBeInTheDocument()
    })

    it('shows dash when no client provided', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} />)

      // Recipient name cell shows "—"
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })

  describe('seller info', () => {
    it('renders seller name from business profile', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} />)

      const elements = screen.getAllByText('Justin Deisler')
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })

    it('renders tax number from business profile', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} />)

      // Tax number appears in sender block (St.-Nr.) AND footer (Steuernummer:)
      const elements = screen.getAllByText(/12\/345\/67890/)
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('line items', () => {
    it('renders all line items', () => {
      const invoice = createMockInvoice({
        items: [
          {
            id: 'item-1',
            invoiceId: 'inv-1',
            description: 'Beratungsleistungen',
            quantity: 10,
            unit: 'hours',
            unitPrice: 100,
            amount: 1000,
          },
          {
            id: 'item-2',
            invoiceId: 'inv-1',
            description: 'Entwicklungsarbeit',
            quantity: 20,
            unit: 'hours',
            unitPrice: 80,
            amount: 1600,
          },
        ],
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Beratungsleistungen')).toBeInTheDocument()
      expect(screen.getByText('Entwicklungsarbeit')).toBeInTheDocument()
    })

    it('renders unit label in German (Std. for hours)', () => {
      const invoice = createMockInvoice({
        items: [
          {
            id: 'item-1',
            invoiceId: 'inv-1',
            description: 'Work',
            quantity: 5,
            unit: 'hours',
            unitPrice: 100,
            amount: 500,
          },
        ],
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Std.')).toBeInTheDocument()
    })

    it('renders unit price in German currency format', () => {
      const invoice = createMockInvoice({
        items: [
          {
            id: 'item-1',
            invoiceId: 'inv-1',
            description: 'Service',
            quantity: 1,
            unit: 'hours',
            unitPrice: 150,
            amount: 150,
          },
        ],
        subtotal: 150,
        vatAmount: 28.5,
        total: 178.5,
      })
      render(<InvoicePreview invoice={invoice} />)

      const amounts = screen.getAllByText('150,00 €')
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('totals', () => {
    it('renders Nettobetrag label', () => {
      const invoice = createMockInvoice({
        subtotal: 1000,
        vatRate: 19,
        vatAmount: 190,
        total: 1190,
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Nettobetrag')).toBeInTheDocument()
    })

    it('renders VAT amount with rate', () => {
      const invoice = createMockInvoice({
        subtotal: 1000,
        vatRate: 19,
        vatAmount: 190,
        total: 1190,
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText(/USt.*19%/)).toBeInTheDocument()
      expect(screen.getByText('190,00 €')).toBeInTheDocument()
    })

    it('renders Gesamtbetrag', () => {
      const invoice = createMockInvoice({
        subtotal: 1000,
        vatRate: 19,
        vatAmount: 190,
        total: 1190,
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Gesamtbetrag')).toBeInTheDocument()
      expect(screen.getByText('1.190,00 €')).toBeInTheDocument()
    })

    it('handles 7% VAT rate', () => {
      const invoice = createMockInvoice({
        subtotal: 1000,
        vatRate: 7,
        vatAmount: 70,
        total: 1070,
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText(/7%/)).toBeInTheDocument()
      expect(screen.getByText('70,00 €')).toBeInTheDocument()
    })

    it('handles 0% VAT rate', () => {
      const invoice = createMockInvoice({
        subtotal: 1000,
        vatRate: 0,
        vatAmount: 0,
        total: 1000,
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText(/0%/)).toBeInTheDocument()
    })
  })

  describe('payment information', () => {
    it('renders payment section when bank info available', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Zahlungsinformationen')).toBeInTheDocument()
      expect(screen.getByText(/DE89 3704 0044 0532 0130 00/)).toBeInTheDocument()
    })

    it('renders invoice number as Verwendungszweck', () => {
      const invoice = createMockInvoice({ invoiceNumber: 'RE-2024-042' })
      render(<InvoicePreview invoice={invoice} />)

      // Invoice number appears both in header and as Verwendungszweck
      const elements = screen.getAllByText('RE-2024-042')
      expect(elements.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('actions', () => {
    it('renders print button', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByRole('button', { name: /drucken/i })).toBeInTheDocument()
    })

    it('renders download button', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByRole('button', { name: /pdf herunterladen/i })).toBeInTheDocument()
    })

    it('calls onPrint when print button is clicked', async () => {
      const onPrint = vi.fn()
      const invoice = createMockInvoice()
      const { user } = render(<InvoicePreview invoice={invoice} onPrint={onPrint} />)

      await user.click(screen.getByRole('button', { name: /drucken/i }))

      expect(onPrint).toHaveBeenCalled()
    })

    it('calls onDownload when download button is clicked', async () => {
      const onDownload = vi.fn()
      const invoice = createMockInvoice()
      const { user } = render(<InvoicePreview invoice={invoice} onDownload={onDownload} />)

      await user.click(screen.getByRole('button', { name: /pdf herunterladen/i }))

      expect(onDownload).toHaveBeenCalled()
    })

    it('renders close button', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByRole('button', { name: /schließen/i })).toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn()
      const invoice = createMockInvoice()
      const { user } = render(<InvoicePreview invoice={invoice} onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: /schließen/i }))

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('status display', () => {
    it('shows Entwurf for draft status', () => {
      const invoice = createMockInvoice({ status: 'draft' })
      render(<InvoicePreview invoice={invoice} />)
      expect(screen.getByText('Entwurf')).toBeInTheDocument()
    })

    it('shows Versendet for sent status', () => {
      const invoice = createMockInvoice({ status: 'sent' })
      render(<InvoicePreview invoice={invoice} />)
      expect(screen.getByText('Versendet')).toBeInTheDocument()
    })

    it('shows Bezahlt for paid status', () => {
      const invoice = createMockPaidInvoice()
      render(<InvoicePreview invoice={invoice} />)
      expect(screen.getByText('Bezahlt')).toBeInTheDocument()
    })

    it('shows Überfällig for overdue status', () => {
      const invoice = createMockInvoice({ status: 'overdue' })
      render(<InvoicePreview invoice={invoice} />)
      expect(screen.getByText('Überfällig')).toBeInTheDocument()
    })

    it('shows Storniert for cancelled status', () => {
      const invoice = createMockInvoice({ status: 'cancelled' })
      render(<InvoicePreview invoice={invoice} />)
      expect(screen.getByText('Storniert')).toBeInTheDocument()
    })
  })
})
