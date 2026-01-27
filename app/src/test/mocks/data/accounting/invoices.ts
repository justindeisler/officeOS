import type { Invoice, InvoiceItem, InvoiceStatus, VatRate, NewInvoiceItem } from '@/features/accounting/types'
import { generateTestId } from '@/test/utils/test-utils'

/**
 * Create a mock invoice item
 */
export function createMockInvoiceItem(
  invoiceId: string,
  overrides: Partial<InvoiceItem> = {}
): InvoiceItem {
  const id = overrides.id ?? generateTestId('item')
  const quantity = overrides.quantity ?? 10
  const unitPrice = overrides.unitPrice ?? 100
  const amount = overrides.amount ?? quantity * unitPrice

  return {
    id,
    invoiceId,
    description: 'Consulting Services',
    quantity,
    unit: 'hours',
    unitPrice,
    amount,
    ...overrides,
  }
}

/**
 * Create a mock invoice with sensible defaults
 * @example
 * const invoice = createMockInvoice({ status: 'paid' })
 * const draftInvoice = createMockInvoice({ status: 'draft' })
 */
export function createMockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const id = overrides.id ?? generateTestId('invoice')
  const now = new Date()
  const dueDate = new Date(now)
  dueDate.setDate(dueDate.getDate() + 14) // 14 days payment term

  const vatRate: VatRate = overrides.vatRate ?? 19
  const items = overrides.items ?? [createMockInvoiceItem(id)]
  const subtotal = overrides.subtotal ?? items.reduce((sum, item) => sum + item.amount, 0)
  const vatAmount = overrides.vatAmount ?? subtotal * (vatRate / 100)
  const total = overrides.total ?? subtotal + vatAmount

  // Generate invoice number in format RE-YYYY-XXX
  const year = now.getFullYear()
  const invoiceNumber = overrides.invoiceNumber ?? `RE-${year}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`

  return {
    id,
    invoiceNumber,
    invoiceDate: now,
    dueDate,
    status: 'draft',
    subtotal,
    vatRate,
    vatAmount,
    total,
    items,
    createdAt: now,
    ...overrides,
  }
}

/**
 * Create multiple mock invoices
 */
export function createMockInvoices(count: number, overrides: Partial<Invoice> = {}): Invoice[] {
  return Array.from({ length: count }, (_, index) =>
    createMockInvoice({
      invoiceNumber: `RE-2024-${String(index + 1).padStart(3, '0')}`,
      ...overrides,
    })
  )
}

/**
 * Create mock invoices for each status
 */
export function createMockInvoicesByStatus(): Record<InvoiceStatus, Invoice> {
  const statuses: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue', 'cancelled']
  const now = new Date()

  return statuses.reduce((acc, status, index) => {
    let paymentDate: Date | undefined
    let dueDate = new Date(now)
    dueDate.setDate(dueDate.getDate() + 14)

    if (status === 'paid') {
      paymentDate = new Date(now)
      paymentDate.setDate(paymentDate.getDate() - 2)
    }

    if (status === 'overdue') {
      dueDate = new Date(now)
      dueDate.setDate(dueDate.getDate() - 30) // 30 days overdue
    }

    return {
      ...acc,
      [status]: createMockInvoice({
        invoiceNumber: `RE-2024-${String(index + 1).padStart(3, '0')}`,
        status,
        dueDate,
        paymentDate,
      }),
    }
  }, {} as Record<InvoiceStatus, Invoice>)
}

/**
 * Create a paid invoice with linked payment date
 */
export function createMockPaidInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const now = new Date()
  const paymentDate = new Date(now)
  paymentDate.setDate(paymentDate.getDate() - 5) // Paid 5 days ago

  return createMockInvoice({
    status: 'paid',
    paymentDate,
    paymentMethod: 'bank_transfer',
    ...overrides,
  })
}

/**
 * Create an overdue invoice
 */
export function createMockOverdueInvoice(daysOverdue = 30, overrides: Partial<Invoice> = {}): Invoice {
  const now = new Date()
  const invoiceDate = new Date(now)
  invoiceDate.setDate(invoiceDate.getDate() - daysOverdue - 14) // Invoice date

  const dueDate = new Date(now)
  dueDate.setDate(dueDate.getDate() - daysOverdue)

  return createMockInvoice({
    status: 'overdue',
    invoiceDate,
    dueDate,
    ...overrides,
  })
}

/**
 * Create new invoice item (for form submission)
 */
export function createNewMockInvoiceItem(overrides: Partial<NewInvoiceItem> = {}): NewInvoiceItem {
  return {
    description: 'Consulting Services',
    quantity: 10,
    unit: 'hours',
    unitPrice: 100,
    ...overrides,
  }
}
