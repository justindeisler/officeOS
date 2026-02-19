import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import { InvoiceForm } from './InvoiceForm'
import { createMockInvoice } from '@/test/mocks/data/accounting'

// Mock fetch to prevent network errors from useClients/useProjects hooks
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve([]),
  text: () => Promise.resolve('[]'),
  headers: new Headers({ 'content-type': 'application/json' }),
})

describe('InvoiceForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('rendering', () => {
    it('renders form title for new invoice', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByText(/new invoice/i)).toBeInTheDocument()
    })

    it('renders form title for editing invoice', () => {
      const invoice = createMockInvoice()
      render(
        <InvoiceForm
          invoice={invoice}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText(/edit invoice/i)).toBeInTheDocument()
    })

    it('renders all required form fields', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/invoice date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/due date/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/vat rate/i)).toBeInTheDocument()
    })

    it('renders VAT rate options', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Radix UI Select renders as a combobox, not native select
      const vatSelect = screen.getByLabelText(/vat rate/i)
      expect(vatSelect).toBeInTheDocument()
      // Default VAT rate is 19%, shown in the trigger(s)
      const vatTexts = screen.getAllByText('19%')
      expect(vatTexts.length).toBeGreaterThanOrEqual(1)
    })

    it('renders submit and cancel buttons', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('renders notes field', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
    })

    it('renders client selection field', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText(/client/i)).toBeInTheDocument()
    })
  })

  describe('line items', () => {
    it('renders at least one line item by default', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      // Component renders both mobile and desktop views, so multiple description inputs exist
      const descriptions = screen.getAllByPlaceholderText(/description/i)
      expect(descriptions.length).toBeGreaterThanOrEqual(1)
    })

    it('allows adding additional line items', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const initialDescriptions = screen.getAllByPlaceholderText(/description/i)
      const initialCount = initialDescriptions.length

      const addButton = screen.getByRole('button', { name: /add item|add line/i })
      await user.click(addButton)

      // Each line item renders 2 description inputs (mobile + desktop)
      const descriptions = screen.getAllByPlaceholderText(/description/i)
      expect(descriptions.length).toBe(initialCount * 2)
    })

    it('allows removing line items', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const initialDescriptions = screen.getAllByPlaceholderText(/description/i)
      const perItem = initialDescriptions.length // descriptions per line item (mobile + desktop)

      // Add a second item first
      const addButton = screen.getByRole('button', { name: /add item|add line/i })
      await user.click(addButton)

      // Should have 2 line items
      let descriptions = screen.getAllByPlaceholderText(/description/i)
      expect(descriptions.length).toBe(perItem * 2)

      // Remove one
      const removeButtons = screen.getAllByRole('button', { name: /remove|delete/i })
      await user.click(removeButtons[0])

      // Should have 1 line item
      descriptions = screen.getAllByPlaceholderText(/description/i)
      expect(descriptions.length).toBe(perItem)
    })

    it('calculates line item amount from quantity and unit price', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const quantityInput = screen.getAllByLabelText(/quantity/i)[0]
      await user.clear(quantityInput)
      await user.type(quantityInput, '5')

      const unitPriceInput = screen.getAllByLabelText(/unit price/i)[0]
      await user.clear(unitPriceInput)
      await user.type(unitPriceInput, '100')

      // Line amount = 5 * 100 = 500
      await waitFor(() => {
        // Find all instances - line item amount and subtotal
        const amounts = screen.getAllByText('500,00 €')
        expect(amounts.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('pre-filling', () => {
    it('pre-fills form when editing existing invoice', () => {
      const invoice = createMockInvoice({
        invoiceDate: new Date('2024-03-15'),
        dueDate: new Date('2024-03-29'),
        vatRate: 19,
        notes: 'Test notes',
      })

      render(
        <InvoiceForm
          invoice={invoice}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByLabelText(/invoice date/i)).toHaveValue('2024-03-15')
      expect(screen.getByLabelText(/due date/i)).toHaveValue('2024-03-29')
      // Radix Select renders 19% in multiple elements
      const vatTexts = screen.getAllByText('19%')
      expect(vatTexts.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByLabelText(/notes/i)).toHaveValue('Test notes')
    })

    it('pre-fills line items when editing existing invoice', () => {
      const invoice = createMockInvoice({
        items: [
          {
            id: 'item-1',
            invoiceId: 'inv-1',
            description: 'Consulting services',
            quantity: 10,
            unit: 'hours',
            unitPrice: 150,
            amount: 1500,
          },
          {
            id: 'item-2',
            invoiceId: 'inv-1',
            description: 'Development work',
            quantity: 20,
            unit: 'hours',
            unitPrice: 120,
            amount: 2400,
          },
        ],
      })

      render(
        <InvoiceForm
          invoice={invoice}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      const descriptions = screen.getAllByPlaceholderText(/description/i)
      // Each line item renders 2 description inputs (mobile + desktop)
      expect(descriptions.length).toBeGreaterThanOrEqual(2)
      // Check that both descriptions appear somewhere in the inputs
      const values = descriptions.map(d => (d as HTMLInputElement).value)
      expect(values).toContain('Consulting services')
      expect(values).toContain('Development work')
    })
  })

  describe('calculations', () => {
    it('calculates subtotal from all line items', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const quantityInput = screen.getAllByLabelText(/quantity/i)[0]
      await user.clear(quantityInput)
      await user.type(quantityInput, '10')

      const unitPriceInput = screen.getAllByLabelText(/unit price/i)[0]
      await user.clear(unitPriceInput)
      await user.type(unitPriceInput, '100')

      // Subtotal = 10 * 100 = 1000
      await waitFor(() => {
        expect(screen.getByText(/subtotal/i)).toBeInTheDocument()
        // May appear multiple times (line item amount + subtotal)
        const amounts = screen.getAllByText('1.000,00 €')
        expect(amounts.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('calculates VAT amount from subtotal', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const quantityInput = screen.getAllByLabelText(/quantity/i)[0]
      await user.clear(quantityInput)
      await user.type(quantityInput, '10')

      const unitPriceInput = screen.getAllByLabelText(/unit price/i)[0]
      await user.clear(unitPriceInput)
      await user.type(unitPriceInput, '100')

      // VAT at 19% of 1000 = 190
      await waitFor(() => {
        expect(screen.getByText('190,00 €')).toBeInTheDocument()
      })
    })

    it('calculates total from subtotal plus VAT', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const quantityInput = screen.getAllByLabelText(/quantity/i)[0]
      await user.clear(quantityInput)
      await user.type(quantityInput, '10')

      const unitPriceInput = screen.getAllByLabelText(/unit price/i)[0]
      await user.clear(unitPriceInput)
      await user.type(unitPriceInput, '100')

      // Total = 1000 + 190 = 1190
      await waitFor(() => {
        expect(screen.getByText('1.190,00 €')).toBeInTheDocument()
      })
    })

    it('updates calculations when VAT rate changes', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const quantityInput = screen.getAllByLabelText(/quantity/i)[0]
      await user.clear(quantityInput)
      await user.type(quantityInput, '10')

      const unitPriceInput = screen.getAllByLabelText(/unit price/i)[0]
      await user.clear(unitPriceInput)
      await user.type(unitPriceInput, '100')

      // Radix UI Select: click trigger to open, then click option
      const vatTrigger = screen.getByLabelText(/vat rate/i)
      await user.click(vatTrigger)
      // After opening, click the 7% option (use findByRole to target the Radix option)
      const option7 = await screen.findByRole('option', { name: '7%' })
      await user.click(option7)

      // VAT at 7% of 1000 = 70
      await waitFor(() => {
        expect(screen.getByText('70,00 €')).toBeInTheDocument()
      })
    })
  })

  describe('validation', () => {
    it('shows error when no line items', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Remove the default line item (may have multiple buttons from responsive views)
      const removeButtons = screen.getAllByRole('button', { name: /remove|delete/i })
      await user.click(removeButtons[0])

      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/at least one line item|add at least one item/i)).toBeInTheDocument()
      })
    })

    it('shows error for empty line item description', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Set quantity and price but not description
      const quantityInput = screen.getAllByLabelText(/quantity/i)[0]
      await user.clear(quantityInput)
      await user.type(quantityInput, '1')

      const unitPriceInput = screen.getAllByLabelText(/unit price/i)[0]
      await user.clear(unitPriceInput)
      await user.type(unitPriceInput, '100')

      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      await waitFor(() => {
        const errors = screen.getAllByText(/description is required/i)
        expect(errors.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('prevents submission with zero quantity', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Fill description to avoid that validation error
      const descInput = screen.getAllByPlaceholderText(/description/i)[0]
      await user.type(descInput, 'Test item')

      // Quantity starts at 1, set to 0
      const quantityInput = screen.getAllByLabelText(/quantity/i)[0] as HTMLInputElement
      await user.clear(quantityInput)
      // Type nothing to leave at 0

      const unitPriceInput = screen.getAllByLabelText(/unit price/i)[0] as HTMLInputElement
      await user.clear(unitPriceInput)
      await user.type(unitPriceInput, '100')

      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      // onSubmit should not be called due to validation
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })

    it('prevents submission with zero unit price', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const descInput = screen.getAllByPlaceholderText(/description/i)[0]
      await user.type(descInput, 'Test item')

      // Keep quantity at default (1) which is valid
      // Unit price starts at 0, which is invalid

      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      // onSubmit should not be called due to validation
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  describe('submission', () => {
    it('calls onSubmit with form data for new invoice', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Fill invoice date
      const dateInput = screen.getByLabelText(/invoice date/i)
      await user.clear(dateInput)
      await user.type(dateInput, '2024-03-15')

      // Fill due date
      const dueDateInput = screen.getByLabelText(/due date/i)
      await user.clear(dueDateInput)
      await user.type(dueDateInput, '2024-03-29')

      // Fill line item
      const descInput = screen.getAllByPlaceholderText(/description/i)[0]
      await user.type(descInput, 'Consulting services')

      const quantityInput = screen.getAllByLabelText(/quantity/i)[0]
      await user.clear(quantityInput)
      await user.type(quantityInput, '10')

      const unitPriceInput = screen.getAllByLabelText(/unit price/i)[0]
      await user.clear(unitPriceInput)
      await user.type(unitPriceInput, '100')

      // Submit
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            vatRate: 19,
            items: expect.arrayContaining([
              expect.objectContaining({
                description: 'Consulting services',
                quantity: 10,
                unitPrice: 100,
              }),
            ]),
          })
        )
      })
    })

    it('calls onSubmit with updated data for existing invoice', async () => {
      const invoice = createMockInvoice({
        vatRate: 19,
        notes: 'Original notes',
        items: [
          {
            id: 'item-1',
            invoiceId: 'inv-1',
            description: 'Original service',
            quantity: 5,
            unit: 'hours',
            unitPrice: 100,
            amount: 500,
          },
        ],
      })

      const { user } = render(
        <InvoiceForm
          invoice={invoice}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      )

      // Update notes
      const notesInput = screen.getByLabelText(/notes/i)
      await user.clear(notesInput)
      await user.type(notesInput, 'Updated notes')

      // Submit
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            notes: 'Updated notes',
          })
        )
      })
    })

    it('calls onCancel when cancel button is clicked', async () => {
      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  describe('loading state', () => {
    it('disables form during submission', async () => {
      let resolveSubmit: (value?: unknown) => void
      mockOnSubmit.mockImplementation(
        () => new Promise((resolve) => { resolveSubmit = resolve })
      )

      const { user } = render(
        <InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      )

      // Fill required fields
      const descInput = screen.getAllByPlaceholderText(/description/i)[0]
      await user.type(descInput, 'Test item')

      const quantityInput = screen.getAllByLabelText(/quantity/i)[0]
      await user.clear(quantityInput)
      await user.type(quantityInput, '1')

      const unitPriceInput = screen.getAllByLabelText(/unit price/i)[0]
      await user.clear(unitPriceInput)
      await user.type(unitPriceInput, '100')

      // Submit
      const submitButton = screen.getByRole('button', { name: /save/i })
      await user.click(submitButton)

      // Button should show loading state (disabled)
      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })

      // Cleanup - resolve the pending promise
      resolveSubmit!()
    })
  })

  describe('date defaults', () => {
    it('defaults invoice date to today', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const dateInput = screen.getByLabelText(/invoice date/i)
      const today = new Date().toISOString().split('T')[0]
      expect(dateInput).toHaveValue(today)
    })

    it('defaults due date to 14 days from invoice date', () => {
      render(<InvoiceForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />)

      const dueDateInput = screen.getByLabelText(/due date/i)
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 14)
      const expectedDueDate = futureDate.toISOString().split('T')[0]
      expect(dueDateInput).toHaveValue(expectedDueDate)
    })
  })
})
