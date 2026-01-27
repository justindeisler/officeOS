import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { InvoiceList } from './InvoiceList'
import {
  createMockInvoice,
  createMockInvoices,
  createMockPaidInvoice,
  createMockOverdueInvoice,
  createMockInvoicesByStatus,
} from '@/test/mocks/data/accounting'
import type { Invoice } from '../../types'

// Mock the useInvoices hook
vi.mock('../../hooks/useInvoices', () => ({
  useInvoices: vi.fn(),
  default: vi.fn(),
}))

import { useInvoices } from '../../hooks/useInvoices'

const mockUseInvoices = vi.mocked(useInvoices)

describe('InvoiceList', () => {
  const defaultMockReturn = {
    invoices: [] as Invoice[],
    isLoading: false,
    error: null,
    fetchInvoices: vi.fn(),
    fetchByStatus: vi.fn(),
    fetchByClient: vi.fn(),
    createInvoice: vi.fn(),
    updateInvoice: vi.fn(),
    deleteInvoice: vi.fn(),
    markAsSent: vi.fn(),
    markAsPaid: vi.fn(),
    cancelInvoice: vi.fn(),
    getNextInvoiceNumber: vi.fn(),
    selectedInvoice: null,
    setSelectedInvoice: vi.fn(),
    refresh: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseInvoices.mockReturnValue(defaultMockReturn)
  })

  describe('rendering', () => {
    it('renders the invoice list header', () => {
      render(<InvoiceList />)

      expect(screen.getByText('Invoices')).toBeInTheDocument()
    })

    it('renders empty state when no invoices', () => {
      render(<InvoiceList />)

      expect(screen.getByText(/no invoices/i)).toBeInTheDocument()
    })

    it('renders loading state', () => {
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
      })

      render(<InvoiceList />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('renders error state', () => {
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        error: 'Failed to fetch invoices',
      })

      render(<InvoiceList />)

      expect(screen.getByText(/failed to fetch invoices/i)).toBeInTheDocument()
    })

    it('renders invoices in a table', () => {
      const mockInvoices = createMockInvoices(3)
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: mockInvoices,
      })

      render(<InvoiceList />)

      // Check table headers
      expect(screen.getByText('Invoice №')).toBeInTheDocument()
      expect(screen.getByText('Date')).toBeInTheDocument()
      expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Total')).toBeInTheDocument()

      // Check that all invoices are rendered
      mockInvoices.forEach((invoice) => {
        expect(screen.getByText(invoice.invoiceNumber)).toBeInTheDocument()
      })
    })
  })

  describe('status badges', () => {
    it('shows draft status badge', () => {
      const invoice = createMockInvoice({ status: 'draft' })
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
      })

      render(<InvoiceList />)

      // Find the badge within the table
      const rows = screen.getAllByRole('row')
      expect(rows.length).toBeGreaterThan(1) // header + data row
      expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1)
    })

    it('shows sent status badge', () => {
      const invoice = createMockInvoice({ status: 'sent' })
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
      })

      render(<InvoiceList />)

      expect(screen.getAllByText('Sent').length).toBeGreaterThanOrEqual(1)
    })

    it('shows paid status badge', () => {
      const invoice = createMockPaidInvoice()
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
      })

      render(<InvoiceList />)

      expect(screen.getAllByText('Paid').length).toBeGreaterThanOrEqual(1)
    })

    it('shows overdue status badge', () => {
      const invoice = createMockOverdueInvoice()
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
      })

      render(<InvoiceList />)

      expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1)
    })

    it('shows cancelled status badge', () => {
      const invoice = createMockInvoice({ status: 'cancelled' })
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
      })

      render(<InvoiceList />)

      expect(screen.getAllByText('Cancelled').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('formatting', () => {
    it('formats currency amounts correctly', () => {
      const invoice = createMockInvoice({
        subtotal: 1000,
        vatAmount: 190,
        total: 1190,
      })
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
      })

      render(<InvoiceList />)

      // German currency formatting
      expect(screen.getByText('1.190,00 €')).toBeInTheDocument()
    })

    it('formats dates in German locale', () => {
      const invoice = createMockInvoice({
        invoiceDate: new Date('2024-03-15'),
      })
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
      })

      render(<InvoiceList />)

      // German date format: DD.MM.YYYY
      expect(screen.getByText('15.03.2024')).toBeInTheDocument()
    })

    it('shows invoice number in correct format', () => {
      const invoice = createMockInvoice({
        invoiceNumber: 'RE-2024-042',
      })
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
      })

      render(<InvoiceList />)

      expect(screen.getByText('RE-2024-042')).toBeInTheDocument()
    })

    it('shows due date', () => {
      const invoice = createMockInvoice({
        dueDate: new Date('2024-03-29'),
      })
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
      })

      render(<InvoiceList />)

      expect(screen.getByText('29.03.2024')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls setSelectedInvoice when row is clicked', async () => {
      const invoice = createMockInvoice()
      const setSelectedInvoice = vi.fn()
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
        setSelectedInvoice,
      })

      const { user } = render(<InvoiceList />)

      await user.click(screen.getByText(invoice.invoiceNumber))

      expect(setSelectedInvoice).toHaveBeenCalledWith(invoice)
    })

    it('calls deleteInvoice when delete button is clicked', async () => {
      const invoice = createMockInvoice({ status: 'draft' })
      const deleteInvoice = vi.fn().mockResolvedValue(true)
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
        deleteInvoice,
      })

      // Mock window.confirm to return true
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      const { user } = render(<InvoiceList />)

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await user.click(deleteButton)

      expect(confirmSpy).toHaveBeenCalled()
      expect(deleteInvoice).toHaveBeenCalledWith(invoice.id)

      confirmSpy.mockRestore()
    })

    it('shows add invoice button', () => {
      render(<InvoiceList />)

      expect(screen.getByRole('button', { name: /new invoice/i })).toBeInTheDocument()
    })

    it('calls onAddInvoice when add button is clicked', async () => {
      const onAddInvoice = vi.fn()

      const { user } = render(<InvoiceList onAddInvoice={onAddInvoice} />)

      await user.click(screen.getByRole('button', { name: /new invoice/i }))

      expect(onAddInvoice).toHaveBeenCalled()
    })

    it('shows mark as sent action for draft invoices', () => {
      const invoice = createMockInvoice({ status: 'draft' })
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
      })

      render(<InvoiceList />)

      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
    })

    it('shows mark as paid action for sent invoices', () => {
      const invoice = createMockInvoice({ status: 'sent' })
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: [invoice],
      })

      render(<InvoiceList />)

      expect(screen.getByRole('button', { name: /paid/i })).toBeInTheDocument()
    })
  })

  describe('filtering', () => {
    it('filters by search term', async () => {
      const invoices = [
        createMockInvoice({ invoiceNumber: 'RE-2024-001' }),
        createMockInvoice({ invoiceNumber: 'RE-2024-002' }),
        createMockInvoice({ invoiceNumber: 'RE-2024-010' }),
      ]
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices,
      })

      const { user } = render(<InvoiceList />)

      const searchInput = screen.getByPlaceholderText(/search/i)
      await user.type(searchInput, '001')

      expect(screen.getByText('RE-2024-001')).toBeInTheDocument()
      expect(screen.queryByText('RE-2024-002')).not.toBeInTheDocument()
      expect(screen.queryByText('RE-2024-010')).not.toBeInTheDocument()
    })

    it('filters by status', async () => {
      const byStatus = createMockInvoicesByStatus()
      const invoiceList = Object.values(byStatus)
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices: invoiceList,
      })

      const { user } = render(<InvoiceList />)

      // Before filtering - should have multiple rows
      const rowsBefore = screen.getAllByRole('row')
      expect(rowsBefore.length).toBeGreaterThan(2) // header + multiple data rows

      // Filter to show only paid invoices
      const statusFilter = screen.getByLabelText(/status/i)
      await user.selectOptions(statusFilter, 'paid')

      // After filtering - should only have paid invoice
      const rowsAfter = screen.getAllByRole('row')
      expect(rowsAfter.length).toBe(2) // header + 1 paid row
    })
  })

  describe('summary', () => {
    it('shows total outstanding amount', () => {
      const invoices = [
        createMockInvoice({ status: 'sent', total: 1000 }),
        createMockInvoice({ status: 'sent', total: 2000 }),
        createMockInvoice({ status: 'paid', total: 500 }),
      ]
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices,
      })

      render(<InvoiceList />)

      // Outstanding: 1000 + 2000 = 3000
      expect(screen.getByText(/outstanding/i)).toBeInTheDocument()
      expect(screen.getByText('3.000,00 €')).toBeInTheDocument()
    })

    it('shows count of overdue invoices', () => {
      const invoices = [
        createMockOverdueInvoice(),
        createMockOverdueInvoice(),
        createMockInvoice({ status: 'sent' }),
      ]
      mockUseInvoices.mockReturnValue({
        ...defaultMockReturn,
        invoices,
      })

      render(<InvoiceList />)

      expect(screen.getByText(/2 overdue/i)).toBeInTheDocument()
    })
  })
})
