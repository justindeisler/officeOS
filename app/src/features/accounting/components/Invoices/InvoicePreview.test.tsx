import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { InvoicePreview } from './InvoicePreview'
import { createMockInvoice, createMockPaidInvoice } from '@/test/mocks/data/accounting'

describe('InvoicePreview', () => {
  describe('rendering', () => {
    it('renders invoice header with number', () => {
      const invoice = createMockInvoice({ invoiceNumber: 'RE-2024-001' })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('RE-2024-001')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Invoice' })).toBeInTheDocument()
    })

    it('renders invoice date in German format', () => {
      const invoice = createMockInvoice({
        invoiceDate: new Date('2024-03-15'),
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('15.03.2024')).toBeInTheDocument()
    })

    it('renders due date in German format', () => {
      const invoice = createMockInvoice({
        dueDate: new Date('2024-03-29'),
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('29.03.2024')).toBeInTheDocument()
    })

    it('renders status badge', () => {
      const invoice = createMockInvoice({ status: 'sent' })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Sent')).toBeInTheDocument()
    })

    it('renders notes when present', () => {
      const invoice = createMockInvoice({ notes: 'Payment within 14 days' })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Payment within 14 days')).toBeInTheDocument()
    })

    it('does not render notes section when empty', () => {
      const invoice = createMockInvoice({ notes: undefined })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.queryByText(/notes/i)).not.toBeInTheDocument()
    })
  })

  describe('line items', () => {
    it('renders all line items', () => {
      const invoice = createMockInvoice({
        items: [
          {
            id: 'item-1',
            invoiceId: 'inv-1',
            description: 'Consulting services',
            quantity: 10,
            unit: 'hours',
            unitPrice: 100,
            amount: 1000,
          },
          {
            id: 'item-2',
            invoiceId: 'inv-1',
            description: 'Development work',
            quantity: 20,
            unit: 'hours',
            unitPrice: 80,
            amount: 1600,
          },
        ],
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Consulting services')).toBeInTheDocument()
      expect(screen.getByText('Development work')).toBeInTheDocument()
    })

    it('renders quantity and unit', () => {
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

      // Check the row contains both quantity and unit
      const rows = screen.getAllByRole('row')
      const dataRow = rows.find(row => row.textContent?.includes('Work'))
      expect(dataRow?.textContent).toContain('5')
      expect(dataRow?.textContent).toMatch(/hrs|hours/i)
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

      // Unit price and amount are both 150 since qty=1
      const amounts = screen.getAllByText('150,00 €')
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })

    it('renders line item amount', () => {
      const invoice = createMockInvoice({
        items: [
          {
            id: 'item-1',
            invoiceId: 'inv-1',
            description: 'Service',
            quantity: 2,
            unit: 'hours',
            unitPrice: 100,
            amount: 200,
          },
        ],
        subtotal: 200,
        vatAmount: 38,
        total: 238,
      })
      render(<InvoicePreview invoice={invoice} />)

      // Amount should be shown in the row (200 = 2 * 100)
      // Multiple 200,00 € could appear (line amount and possibly subtotal)
      const amounts = screen.getAllByText('200,00 €')
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('totals', () => {
    it('renders subtotal in German currency format', () => {
      const invoice = createMockInvoice({
        subtotal: 1000,
        vatRate: 19,
        vatAmount: 190,
        total: 1190,
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Subtotal')).toBeInTheDocument()
      // Subtotal amount may also appear as a line item amount
      const amounts = screen.getAllByText('1.000,00 €')
      expect(amounts.length).toBeGreaterThanOrEqual(1)
    })

    it('renders VAT amount with rate', () => {
      const invoice = createMockInvoice({
        subtotal: 1000,
        vatRate: 19,
        vatAmount: 190,
        total: 1190,
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText(/vat.*19%|19%.*vat/i)).toBeInTheDocument()
      expect(screen.getByText('190,00 €')).toBeInTheDocument()
    })

    it('renders total in German currency format', () => {
      const invoice = createMockInvoice({
        subtotal: 1000,
        vatRate: 19,
        vatAmount: 190,
        total: 1190,
      })
      render(<InvoicePreview invoice={invoice} />)

      // Use exact match for "Total" to avoid matching "Subtotal"
      expect(screen.getByText('Total')).toBeInTheDocument()
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

    it('handles 0% VAT rate (Kleinunternehmer)', () => {
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
    it('renders payment date for paid invoices', () => {
      const invoice = createMockPaidInvoice({
        paymentDate: new Date('2024-03-20'),
      })
      render(<InvoicePreview invoice={invoice} />)

      // Multiple elements match /paid/i (status badge + payment info)
      const paidElements = screen.getAllByText(/paid/i)
      expect(paidElements.length).toBeGreaterThanOrEqual(1)
      // Use regex for date to handle text node matching
      expect(screen.getByText(/20\.03\.2024/)).toBeInTheDocument()
    })

    it('renders payment method when present', () => {
      const invoice = createMockPaidInvoice({
        paymentMethod: 'bank_transfer',
      })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText(/bank transfer/i)).toBeInTheDocument()
    })

    it('does not render payment info for unpaid invoices', () => {
      const invoice = createMockInvoice({ status: 'sent' })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.queryByText(/payment date/i)).not.toBeInTheDocument()
    })
  })

  describe('actions', () => {
    it('renders print button', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
    })

    it('renders download button', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByRole('button', { name: /download|pdf/i })).toBeInTheDocument()
    })

    it('calls onPrint when print button is clicked', async () => {
      const onPrint = vi.fn()
      const invoice = createMockInvoice()
      const { user } = render(<InvoicePreview invoice={invoice} onPrint={onPrint} />)

      await user.click(screen.getByRole('button', { name: /print/i }))

      expect(onPrint).toHaveBeenCalled()
    })

    it('calls onDownload when download button is clicked', async () => {
      const onDownload = vi.fn()
      const invoice = createMockInvoice()
      const { user } = render(<InvoicePreview invoice={invoice} onDownload={onDownload} />)

      await user.click(screen.getByRole('button', { name: /download|pdf/i }))

      expect(onDownload).toHaveBeenCalled()
    })

    it('renders close button', () => {
      const invoice = createMockInvoice()
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn()
      const invoice = createMockInvoice()
      const { user } = render(<InvoicePreview invoice={invoice} onClose={onClose} />)

      await user.click(screen.getByRole('button', { name: /close/i }))

      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('status display', () => {
    it('shows draft status correctly', () => {
      const invoice = createMockInvoice({ status: 'draft' })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Draft')).toBeInTheDocument()
    })

    it('shows sent status correctly', () => {
      const invoice = createMockInvoice({ status: 'sent' })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Sent')).toBeInTheDocument()
    })

    it('shows paid status correctly', () => {
      const invoice = createMockPaidInvoice()
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Paid')).toBeInTheDocument()
    })

    it('shows overdue status correctly', () => {
      const invoice = createMockInvoice({ status: 'overdue' })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Overdue')).toBeInTheDocument()
    })

    it('shows cancelled status correctly', () => {
      const invoice = createMockInvoice({ status: 'cancelled' })
      render(<InvoicePreview invoice={invoice} />)

      expect(screen.getByText('Cancelled')).toBeInTheDocument()
    })
  })
})
