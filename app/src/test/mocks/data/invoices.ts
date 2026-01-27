import type { Invoice, InvoiceLineItem, InvoiceStatus } from '@/types'
import { generateTestId } from '@/test/utils/test-utils'

/**
 * Create a mock invoice line item
 */
export function createMockLineItem(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  const quantity = overrides.quantity ?? 10
  const unitPrice = overrides.unitPrice ?? 100
  return {
    description: 'Development work',
    quantity,
    unitPrice,
    total: quantity * unitPrice,
    ...overrides,
  }
}

/**
 * Create a mock invoice with sensible defaults
 * @example
 * const invoice = createMockInvoice({ status: 'paid' })
 */
export function createMockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const id = overrides.id ?? generateTestId('inv')
  const now = new Date()
  const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

  const lineItems = overrides.lineItems ?? [createMockLineItem()]
  const amount = lineItems.reduce((sum, item) => sum + item.total, 0)
  const taxRate = overrides.taxRate ?? 19
  const taxAmount = amount * (taxRate / 100)
  const totalAmount = amount + taxAmount

  return {
    id,
    clientId: overrides.clientId ?? generateTestId('client'),
    invoiceNumber: `INV-${Date.now()}`,
    amount,
    currency: 'EUR',
    taxRate,
    taxAmount,
    totalAmount,
    status: 'draft' as InvoiceStatus,
    issueDate: now.toISOString(),
    dueDate: dueDate.toISOString(),
    lineItems,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...overrides,
  }
}

/**
 * Create multiple mock invoices
 */
export function createMockInvoices(count: number, overrides: Partial<Invoice> = {}): Invoice[] {
  return Array.from({ length: count }, (_, index) =>
    createMockInvoice({
      invoiceNumber: `INV-${1000 + index}`,
      ...overrides,
    })
  )
}
