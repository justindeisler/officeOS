/**
 * Invoice API
 *
 * Database operations for invoices.
 * Uses @tauri-apps/plugin-sql for Tauri-compatible database operations.
 */

import { getDb } from './db'
import { createIncome } from './income'
import type {
  Invoice,
  NewInvoice,
  InvoiceItem,
  InvoiceStatus,
  VatRate,
  PaymentMethod,
} from '../types'

/**
 * Database row type for invoices
 */
interface InvoiceRow {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  status: string
  client_id: string | null
  project_id: string | null
  subtotal: number | null
  vat_rate: number | null
  vat_amount: number | null
  total: number | null
  payment_date: string | null
  payment_method: string | null
  notes: string | null
  created_at: string
}

/**
 * Database row type for invoice items
 */
interface InvoiceItemRow {
  id: string
  invoice_id: string
  description: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  amount: number | null
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate the next invoice number in format RE-YYYY-XXX
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `RE-${year}-`

  try {
    const db = await getDb()
    const result = await db.select<{ invoice_number: string }[]>(
      `SELECT invoice_number FROM invoices
       WHERE invoice_number LIKE $1
       ORDER BY invoice_number DESC
       LIMIT 1`,
      [`${prefix}%`]
    )

    if (result.length === 0) {
      return `${prefix}001`
    }

    const lastNumber = result[0].invoice_number
    const lastSequence = parseInt(lastNumber.replace(prefix, ''), 10)
    const nextSequence = lastSequence + 1

    return `${prefix}${String(nextSequence).padStart(3, '0')}`
  } catch {
    return `${prefix}001`
  }
}

/**
 * Calculate VAT amount from subtotal and rate
 */
function calculateVatAmount(subtotal: number, vatRate: VatRate): number {
  return Math.round(subtotal * (vatRate / 100) * 100) / 100
}

/**
 * Calculate line item amount
 */
function calculateItemAmount(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100
}

/**
 * Map database row to Invoice type
 */
function rowToInvoice(row: InvoiceRow, items: InvoiceItem[]): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceDate: new Date(row.invoice_date),
    dueDate: new Date(row.due_date),
    status: row.status as InvoiceStatus,
    clientId: row.client_id ?? undefined,
    projectId: row.project_id ?? undefined,
    subtotal: row.subtotal ?? 0,
    vatRate: (row.vat_rate ?? 19) as VatRate,
    vatAmount: row.vat_amount ?? 0,
    total: row.total ?? 0,
    paymentDate: row.payment_date ? new Date(row.payment_date) : undefined,
    paymentMethod: row.payment_method as Invoice['paymentMethod'],
    notes: row.notes ?? undefined,
    items,
    createdAt: new Date(row.created_at),
  }
}

/**
 * Map database row to InvoiceItem type
 */
function rowToInvoiceItem(row: InvoiceItemRow): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    description: row.description,
    quantity: row.quantity ?? 1,
    unit: row.unit ?? 'hours',
    unitPrice: row.unit_price ?? 0,
    amount: row.amount ?? 0,
  }
}

/**
 * Get items for an invoice
 */
async function getInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const db = await getDb()
  const rows = await db.select<InvoiceItemRow[]>(
    'SELECT * FROM invoice_items WHERE invoice_id = $1',
    [invoiceId]
  )
  return rows.map(rowToInvoiceItem)
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Get all invoices
 */
export async function getAllInvoices(): Promise<Invoice[]> {
  try {
    const db = await getDb()
    const rows = await db.select<InvoiceRow[]>(
      'SELECT * FROM invoices ORDER BY invoice_date DESC'
    )

    const result: Invoice[] = []
    for (const row of rows) {
      try {
        const items = await getInvoiceItems(row.id)
        result.push(rowToInvoice(row, items))
      } catch (itemErr) {
        console.error(`Failed to get items for invoice ${row.id}:`, itemErr)
        // Still include the invoice but with empty items
        result.push(rowToInvoice(row, []))
      }
    }

    return result
  } catch (err) {
    console.error('getAllInvoices error:', err)
    throw err
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const db = await getDb()
  const rows = await db.select<InvoiceRow[]>(
    'SELECT * FROM invoices WHERE id = $1',
    [id]
  )

  if (rows.length === 0) {
    return null
  }

  const items = await getInvoiceItems(id)
  return rowToInvoice(rows[0], items)
}

/**
 * Get invoices by status
 */
export async function getInvoicesByStatus(status: InvoiceStatus): Promise<Invoice[]> {
  const db = await getDb()
  const rows = await db.select<InvoiceRow[]>(
    'SELECT * FROM invoices WHERE status = $1 ORDER BY invoice_date DESC',
    [status]
  )

  const result: Invoice[] = []
  for (const row of rows) {
    const items = await getInvoiceItems(row.id)
    result.push(rowToInvoice(row, items))
  }

  return result
}

/**
 * Get invoices by client
 */
export async function getInvoicesByClient(clientId: string): Promise<Invoice[]> {
  const db = await getDb()
  const rows = await db.select<InvoiceRow[]>(
    'SELECT * FROM invoices WHERE client_id = $1 ORDER BY invoice_date DESC',
    [clientId]
  )

  const result: Invoice[] = []
  for (const row of rows) {
    const items = await getInvoiceItems(row.id)
    result.push(rowToInvoice(row, items))
  }

  return result
}

/**
 * Get overdue invoices
 */
export async function getOverdueInvoices(): Promise<Invoice[]> {
  const today = new Date().toISOString().split('T')[0]
  const db = await getDb()

  const rows = await db.select<InvoiceRow[]>(
    `SELECT * FROM invoices
     WHERE status = 'sent' AND due_date < $1
     ORDER BY due_date DESC`,
    [today]
  )

  const result: Invoice[] = []
  for (const row of rows) {
    const items = await getInvoiceItems(row.id)
    // Mark as overdue
    result.push(rowToInvoice({ ...row, status: 'overdue' }, items))
  }

  return result
}

/**
 * Create a new invoice
 */
export async function createInvoice(data: NewInvoice): Promise<Invoice> {
  const db = await getDb()
  const id = crypto.randomUUID()
  const invoiceNumber = await getNextInvoiceNumber()
  const now = new Date().toISOString()

  // Calculate subtotal from items
  const subtotal = data.items.reduce((sum, item) => {
    return sum + calculateItemAmount(item.quantity, item.unitPrice)
  }, 0)

  const vatAmount = calculateVatAmount(subtotal, data.vatRate)
  const total = Math.round((subtotal + vatAmount) * 100) / 100

  // Insert invoice
  await db.execute(
    `INSERT INTO invoices (
      id, invoice_number, invoice_date, due_date, status, client_id, project_id,
      subtotal, vat_rate, vat_amount, total, notes, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      id,
      invoiceNumber,
      data.invoiceDate.toISOString().split('T')[0],
      data.dueDate.toISOString().split('T')[0],
      'draft',
      data.clientId ?? null,
      data.projectId ?? null,
      subtotal,
      data.vatRate,
      vatAmount,
      total,
      data.notes ?? null,
      now,
    ]
  )

  // Insert invoice items
  const items: InvoiceItem[] = []
  for (const item of data.items) {
    const itemId = crypto.randomUUID()
    const amount = calculateItemAmount(item.quantity, item.unitPrice)

    await db.execute(
      `INSERT INTO invoice_items (
        id, invoice_id, description, quantity, unit, unit_price, amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        itemId,
        id,
        item.description,
        item.quantity,
        item.unit ?? 'hours',
        item.unitPrice,
        amount,
      ]
    )

    items.push({
      id: itemId,
      invoiceId: id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit ?? 'hours',
      unitPrice: item.unitPrice,
      amount,
    })
  }

  return {
    id,
    invoiceNumber,
    invoiceDate: data.invoiceDate,
    dueDate: data.dueDate,
    status: 'draft',
    clientId: data.clientId,
    projectId: data.projectId,
    subtotal,
    vatRate: data.vatRate,
    vatAmount,
    total,
    notes: data.notes,
    items,
    createdAt: new Date(now),
  }
}

/**
 * Update an existing invoice
 */
export async function updateInvoice(
  id: string,
  data: Partial<NewInvoice>
): Promise<Invoice | null> {
  const existing = await getInvoiceById(id)
  if (!existing) {
    return null
  }

  // Only allow updates for draft invoices
  if (existing.status !== 'draft') {
    throw new Error('Can only update draft invoices')
  }

  const db = await getDb()

  // Build dynamic update
  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  if (data.invoiceDate !== undefined) {
    updates.push(`invoice_date = $${paramIndex++}`)
    values.push(data.invoiceDate.toISOString().split('T')[0])
  }

  if (data.dueDate !== undefined) {
    updates.push(`due_date = $${paramIndex++}`)
    values.push(data.dueDate.toISOString().split('T')[0])
  }

  if (data.clientId !== undefined) {
    updates.push(`client_id = $${paramIndex++}`)
    values.push(data.clientId ?? null)
  }

  if (data.projectId !== undefined) {
    updates.push(`project_id = $${paramIndex++}`)
    values.push(data.projectId ?? null)
  }

  if (data.notes !== undefined) {
    updates.push(`notes = $${paramIndex++}`)
    values.push(data.notes ?? null)
  }

  if (data.vatRate !== undefined) {
    updates.push(`vat_rate = $${paramIndex++}`)
    values.push(data.vatRate)
  }

  // If items are updated, recalculate totals
  if (data.items) {
    // Delete existing items
    await db.execute('DELETE FROM invoice_items WHERE invoice_id = $1', [id])

    // Insert new items
    const subtotal = data.items.reduce((sum, item) => {
      return sum + calculateItemAmount(item.quantity, item.unitPrice)
    }, 0)

    const vatRate = data.vatRate ?? existing.vatRate
    const vatAmount = calculateVatAmount(subtotal, vatRate)
    const total = Math.round((subtotal + vatAmount) * 100) / 100

    updates.push(`subtotal = $${paramIndex++}`)
    values.push(subtotal)
    updates.push(`vat_amount = $${paramIndex++}`)
    values.push(vatAmount)
    updates.push(`total = $${paramIndex++}`)
    values.push(total)

    for (const item of data.items) {
      const itemId = crypto.randomUUID()
      const amount = calculateItemAmount(item.quantity, item.unitPrice)

      await db.execute(
        `INSERT INTO invoice_items (
          id, invoice_id, description, quantity, unit, unit_price, amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          itemId,
          id,
          item.description,
          item.quantity,
          item.unit ?? 'hours',
          item.unitPrice,
          amount,
        ]
      )
    }
  }

  if (updates.length > 0) {
    values.push(id)
    await db.execute(
      `UPDATE invoices SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    )
  }

  return getInvoiceById(id)
}

/**
 * Delete an invoice
 */
export async function deleteInvoice(id: string): Promise<boolean> {
  const existing = await getInvoiceById(id)
  if (!existing) {
    return false
  }

  const db = await getDb()

  // Delete any associated income records
  await db.execute('DELETE FROM income WHERE invoice_id = $1', [id])

  // Delete invoice items
  await db.execute('DELETE FROM invoice_items WHERE invoice_id = $1', [id])

  // Delete the invoice
  await db.execute('DELETE FROM invoices WHERE id = $1', [id])

  return true
}

// ============================================================================
// STATUS MANAGEMENT
// ============================================================================

/**
 * Mark invoice as sent
 */
export async function markAsSent(id: string): Promise<Invoice | null> {
  const existing = await getInvoiceById(id)
  if (!existing) {
    return null
  }

  if (existing.status !== 'draft') {
    throw new Error('Can only send draft invoices')
  }

  const db = await getDb()
  await db.execute(
    `UPDATE invoices SET status = 'sent' WHERE id = $1`,
    [id]
  )

  return getInvoiceById(id)
}

/**
 * Mark invoice as paid
 *
 * When an invoice is marked as paid, automatically creates a corresponding
 * income record for tax reporting (EÜR/USt-Voranmeldung).
 */
export async function markAsPaid(
  id: string,
  paymentDate: Date,
  paymentMethod?: string
): Promise<Invoice | null> {
  const existing = await getInvoiceById(id)
  if (!existing) {
    return null
  }

  if (existing.status === 'paid') {
    return existing // Already paid
  }

  if (existing.status === 'cancelled') {
    throw new Error('Cannot pay cancelled invoices')
  }

  const db = await getDb()
  await db.execute(
    `UPDATE invoices SET status = 'paid', payment_date = $1, payment_method = $2 WHERE id = $3`,
    [paymentDate.toISOString().split('T')[0], paymentMethod ?? null, id]
  )

  // Auto-create income record for tax reporting
  // This links the invoice to the income record for audit trail
  try {
    await createIncome({
      date: paymentDate,
      clientId: existing.clientId,
      invoiceId: existing.id,
      description: `Invoice ${existing.invoiceNumber}`,
      netAmount: existing.subtotal,
      vatRate: existing.vatRate,
      euerLine: 14, // Betriebseinnahmen (operating income)
      euerCategory: 'services',
      paymentMethod: paymentMethod as PaymentMethod | undefined,
    })
  } catch (error) {
    // Log error but don't fail the payment marking
    // Income can be created manually if auto-creation fails
    console.error('Failed to auto-create income record:', error)
  }

  return getInvoiceById(id)
}

/**
 * Cancel an invoice
 */
export async function cancelInvoice(id: string): Promise<Invoice | null> {
  const existing = await getInvoiceById(id)
  if (!existing) {
    return null
  }

  if (existing.status === 'paid') {
    throw new Error('Cannot cancel paid invoices')
  }

  const db = await getDb()
  await db.execute(
    `UPDATE invoices SET status = 'cancelled' WHERE id = $1`,
    [id]
  )

  return getInvoiceById(id)
}

// ============================================================================
// SUMMARY & STATISTICS
// ============================================================================

/**
 * Get outstanding amount (sent + overdue invoices)
 */
export async function getOutstandingAmount(): Promise<number> {
  const db = await getDb()
  const result = await db.select<{ total_sum: number | null }[]>(
    `SELECT SUM(total) as total_sum FROM invoices WHERE status IN ('sent', 'overdue')`
  )

  return result[0]?.total_sum ?? 0
}

/**
 * Get invoice statistics
 */
export async function getInvoiceStatistics(): Promise<{
  totalCount: number
  draftCount: number
  sentCount: number
  paidCount: number
  overdueCount: number
  cancelledCount: number
  outstandingAmount: number
  paidAmount: number
}> {
  const today = new Date().toISOString().split('T')[0]
  const allInvoices = await getAllInvoices()

  let draftCount = 0
  let sentCount = 0
  let paidCount = 0
  let overdueCount = 0
  let cancelledCount = 0
  let outstandingAmount = 0
  let paidAmount = 0

  for (const invoice of allInvoices) {
    switch (invoice.status) {
      case 'draft':
        draftCount++
        break
      case 'sent':
        if (invoice.dueDate < new Date(today)) {
          overdueCount++
        } else {
          sentCount++
        }
        outstandingAmount += invoice.total
        break
      case 'paid':
        paidCount++
        paidAmount += invoice.total
        break
      case 'overdue':
        overdueCount++
        outstandingAmount += invoice.total
        break
      case 'cancelled':
        cancelledCount++
        break
    }
  }

  return {
    totalCount: allInvoices.length,
    draftCount,
    sentCount,
    paidCount,
    overdueCount,
    cancelledCount,
    outstandingAmount,
    paidAmount,
  }
}
