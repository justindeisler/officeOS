/**
 * InvoiceForm Component
 *
 * Form for creating and editing invoices.
 * Includes dynamic line items with automatic calculations.
 */

import { useState, useMemo, useEffect } from 'react'
import type { Invoice, NewInvoice, NewInvoiceItem, VatRate } from '../../types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useClients } from '../../hooks/useClients'
import { useProjectStore } from '@/stores/projectStore'
import { Trash2, Plus, Loader2, Building2, FolderKanban, Calendar, Percent } from 'lucide-react'
import { useInvoiceSuggestions } from '../../hooks/useInvoiceSuggestions'
import { InvoiceNumberPreview } from '../Suggestions/InvoiceNumberPreview'

export interface InvoiceFormProps {
  /** Invoice to edit (undefined for new invoice) */
  invoice?: Invoice
  /** Callback when form is submitted */
  onSubmit: (data: NewInvoice) => Promise<void> | void
  /** Callback when cancel is clicked */
  onCancel: () => void
  /** Additional CSS classes */
  className?: string
}

interface LineItem {
  id: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  vatRate: VatRate
}

interface FormErrors {
  items?: string
  itemDescriptions?: Record<string, string>
  itemQuantities?: Record<string, string>
  itemPrices?: Record<string, string>
}

/**
 * Format number as German currency
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Generate unique ID for line items
 */
function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Get default dates
 */
function getDefaultDates(): { invoiceDate: string; dueDate: string } {
  const today = new Date()
  const dueDate = new Date(today)
  dueDate.setDate(dueDate.getDate() + 14)

  return {
    invoiceDate: today.toISOString().split('T')[0],
    dueDate: dueDate.toISOString().split('T')[0],
  }
}

export function InvoiceForm({
  invoice,
  onSubmit,
  onCancel,
  className,
}: InvoiceFormProps) {
  const isEditing = !!invoice
  const defaults = getDefaultDates()

  // Data hooks
  const { clients } = useClients()
  const { projects, initialize: initializeProjects } = useProjectStore()

  // Initialize projects store on mount
  useEffect(() => {
    initializeProjects()
  }, [initializeProjects])

  // Form state
  const [invoiceDate, setInvoiceDate] = useState(
    invoice?.invoiceDate
      ? invoice.invoiceDate.toISOString().split('T')[0]
      : defaults.invoiceDate
  )
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate
      ? invoice.dueDate.toISOString().split('T')[0]
      : defaults.dueDate
  )
  const [vatRate, setVatRate] = useState<VatRate>(invoice?.vatRate ?? 19)
  const [notes, setNotes] = useState(invoice?.notes ?? '')
  const [clientId, setClientId] = useState(invoice?.clientId ?? '')
  const [projectId, setProjectId] = useState(invoice?.projectId ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  // Smart suggestions for invoices
  const { suggestions: invoiceSuggestions } = useInvoiceSuggestions(clientId)
  const [invoiceNumberAccepted, setInvoiceNumberAccepted] = useState(false)

  // Auto-update due date when suggested payment terms change
  useEffect(() => {
    if (invoiceSuggestions?.suggestedDueDate && !isEditing) {
      setDueDate(invoiceSuggestions.suggestedDueDate)
    }
  }, [invoiceSuggestions?.suggestedDueDate, isEditing])

  // E-Rechnung fields
  const [eInvoiceFormat, setEInvoiceFormat] = useState<string>(
    (invoice as any)?.eInvoiceFormat ?? 'none'
  )
  const [leitwegId, setLeitwegId] = useState<string>(
    (invoice as any)?.leitwegId ?? ''
  )
  const [buyerReference, setBuyerReference] = useState<string>(
    (invoice as any)?.buyerReference ?? ''
  )

  // Filter projects by selected client
  const filteredProjects = useMemo(() => {
    if (!clientId) return []
    return projects.filter((p) => p.clientId === clientId)
  }, [projects, clientId])

  // Reset projectId when client changes
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId)
    // Clear project if it doesn't belong to the new client
    if (projectId) {
      const projectBelongsToClient = projects.some(
        (p) => p.id === projectId && p.clientId === newClientId
      )
      if (!projectBelongsToClient) {
        setProjectId('')
      }
    }
  }

  // Line items state - each item now has its own VAT rate for multi-VAT support
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (invoice?.items && invoice.items.length > 0) {
      return invoice.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit ?? 'hours',
        unitPrice: item.unitPrice,
        vatRate: (item as unknown as { vatRate?: VatRate }).vatRate ?? vatRate,
      }))
    }
    return [
      {
        id: generateId(),
        description: '',
        quantity: 1,
        unit: 'hours',
        unitPrice: 0,
        vatRate: 19 as VatRate,
      },
    ]
  })

  // Calculate line item amounts
  const lineItemAmounts = useMemo(() => {
    return lineItems.map((item) => {
      return Math.round(item.quantity * item.unitPrice * 100) / 100
    })
  }, [lineItems])

  // Calculate totals with per-line VAT breakdown (multi-VAT support)
  const calculations = useMemo(() => {
    const subtotal = lineItemAmounts.reduce((sum, amount) => sum + amount, 0)

    // Group VAT by rate for multi-VAT breakdown
    const vatBreakdown: Record<number, { net: number; vat: number }> = {}
    lineItems.forEach((item, idx) => {
      const itemNet = lineItemAmounts[idx]
      const rate = item.vatRate ?? vatRate
      if (!vatBreakdown[rate]) {
        vatBreakdown[rate] = { net: 0, vat: 0 }
      }
      vatBreakdown[rate].net += itemNet
      vatBreakdown[rate].vat += Math.round(itemNet * (rate / 100) * 100) / 100
    })

    const totalVatAmount = Object.values(vatBreakdown).reduce(
      (sum, { vat }) => sum + vat,
      0
    )
    const total = Math.round((subtotal + totalVatAmount) * 100) / 100

    return { subtotal, vatAmount: totalVatAmount, total, vatBreakdown }
  }, [lineItemAmounts, lineItems, vatRate])

  // Update line item
  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  // Add line item
  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: generateId(),
        description: '',
        quantity: 1,
        unit: 'hours',
        unitPrice: 0,
        vatRate: vatRate,
      },
    ])
  }

  // Remove line item
  const removeLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id))
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Check for at least one line item
    if (lineItems.length === 0) {
      newErrors.items = 'At least one line item is required'
    }

    // Validate each line item
    const itemDescErrors: Record<string, string> = {}
    const itemQuantityErrors: Record<string, string> = {}
    const itemPriceErrors: Record<string, string> = {}

    lineItems.forEach((item) => {
      if (!item.description.trim()) {
        itemDescErrors[item.id] = 'Description is required'
      }
      if (item.quantity <= 0) {
        itemQuantityErrors[item.id] = 'Quantity must be positive'
      }
      if (item.unitPrice <= 0) {
        itemPriceErrors[item.id] = 'Price must be positive'
      }
    })

    if (Object.keys(itemDescErrors).length > 0) {
      newErrors.itemDescriptions = itemDescErrors
    }
    if (Object.keys(itemQuantityErrors).length > 0) {
      newErrors.itemQuantities = itemQuantityErrors
    }
    if (Object.keys(itemPriceErrors).length > 0) {
      newErrors.itemPrices = itemPriceErrors
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const items: NewInvoiceItem[] = lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
      }))

      const data: NewInvoice = {
        invoiceDate: new Date(invoiceDate),
        dueDate: new Date(dueDate),
        vatRate,
        items,
        clientId: clientId || undefined,
        projectId: projectId || undefined,
        notes: notes || undefined,
      }

      await onSubmit(data)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-5 w-full max-w-full overflow-hidden', className)}>
      {/* Header */}
      <h2 className="text-xl font-semibold">
        {isEditing ? 'Edit Invoice' : 'New Invoice'}
      </h2>

      {/* Invoice Number Preview (for new invoices only) */}
      {!isEditing && invoiceSuggestions?.nextInvoiceNumber && (
        <InvoiceNumberPreview
          nextNumber={invoiceSuggestions.nextInvoiceNumber}
          pattern={invoiceSuggestions.invoiceNumberPattern}
          onAccept={() => setInvoiceNumberAccepted(true)}
          accepted={invoiceNumberAccepted}
        />
      )}

      {/* Invoice Details */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {/* Invoice Date */}
        <div className="space-y-2">
          <Label htmlFor="invoiceDate" className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            Invoice Date
          </Label>
          <Input
            id="invoiceDate"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className="h-10"
          />
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <Label htmlFor="dueDate" className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            Due Date
          </Label>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-10"
          />
        </div>

        {/* Client */}
        <div className="space-y-2">
          <Label htmlFor="client" className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            Client
          </Label>
          <Select
            value={clientId || undefined}
            onValueChange={handleClientChange}
          >
            <SelectTrigger id="client">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No clients available
                </div>
              ) : (
                clients
                  .filter((client) => client.id) // Ensure valid IDs
                  .map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* VAT Rate */}
        <div className="space-y-2">
          <Label htmlFor="vatRate" className="flex items-center gap-2">
            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            VAT Rate
          </Label>
          <Select
            value={String(vatRate)}
            onValueChange={(v) => setVatRate(Number(v) as VatRate)}
          >
            <SelectTrigger id="vatRate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="19">19%</SelectItem>
              <SelectItem value="7">7%</SelectItem>
              <SelectItem value="0">0%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Project Selection - Only show when client has projects */}
        {clientId && filteredProjects.length > 0 && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="project" className="flex items-center gap-2">
              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
              Project
              <span className="text-xs font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Select
              value={projectId || '__none__'}
              onValueChange={(v) => setProjectId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger id="project">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">No project</span>
                </SelectItem>
                {filteredProjects
                  .filter((project) => project.id) // Ensure valid IDs
                  .map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full',
                            project.status === 'active' && 'bg-green-500',
                            project.status === 'pipeline' && 'bg-blue-500',
                            project.status === 'on_hold' && 'bg-yellow-500',
                            project.status === 'completed' && 'bg-gray-400',
                            project.status === 'cancelled' && 'bg-red-400'
                          )}
                        />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Line Items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>

        {errors.items && (
          <p className="text-sm text-destructive">{errors.items}</p>
        )}

        <div className="space-y-3 w-full">
          {lineItems.map((item, index) => (
            <div key={item.id} className="rounded-lg border p-3 sm:p-4 w-full">
              {/* Mobile Layout */}
              <div className="flex flex-col gap-3 sm:hidden w-full">
                {/* Description - full width */}
                <div className="w-full">
                  <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
                  <Input
                    placeholder="Description"
                    className="h-10 w-full"
                    value={item.description}
                    onChange={(e) =>
                      updateLineItem(item.id, 'description', e.target.value)
                    }
                  />
                  {errors.itemDescriptions?.[item.id] && (
                    <p className="mt-1 text-xs text-destructive">
                      {errors.itemDescriptions[item.id]}
                    </p>
                  )}
                </div>

                {/* Quantity - full width */}
                <div className="w-full">
                  <Label className="text-xs text-muted-foreground mb-1 block">Quantity</Label>
                  <Input
                    id={`quantity-${item.id}`}
                    aria-label="Quantity"
                    className="h-10 w-full"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                    }
                  />
                </div>

                {/* Unit - full width */}
                <div className="w-full">
                  <Label className="text-xs text-muted-foreground mb-1 block">Unit</Label>
                  <Select
                    value={item.unit}
                    onValueChange={(v) => updateLineItem(item.id, 'unit', v)}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="units">Units</SelectItem>
                      <SelectItem value="pieces">Pieces</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Unit Price - full width */}
                <div className="w-full">
                  <Label className="text-xs text-muted-foreground mb-1 block">Einzelpreis (€)</Label>
                  <Input
                    id={`unitPrice-${item.id}`}
                    aria-label="Unit Price"
                    className="h-10 w-full"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                    }
                  />
                </div>

                {/* Per-line VAT Rate */}
                <div className="w-full">
                  <Label className="text-xs text-muted-foreground mb-1 block">MwSt</Label>
                  <Select
                    value={String(item.vatRate ?? vatRate)}
                    onValueChange={(v) => updateLineItem(item.id, 'vatRate', Number(v) as VatRate)}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="19">19%</SelectItem>
                      <SelectItem value="7">7%</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount and Delete - row */}
                <div className="flex items-center justify-between pt-2 border-t w-full">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive -ml-2"
                    onClick={() => removeLineItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                  <span className="font-semibold text-base">
                    {formatCurrency(lineItemAmounts[index])}
                  </span>
                </div>
              </div>

              {/* Desktop Layout - with per-line VAT column */}
              <div className="hidden sm:block">
                <div className="grid items-start gap-3 grid-cols-[1fr_70px_80px_90px_70px_40px]">
                  {/* Description */}
                  <div>
                    <Input
                      placeholder="Beschreibung"
                      className="h-9"
                      value={item.description}
                      onChange={(e) =>
                        updateLineItem(item.id, 'description', e.target.value)
                      }
                    />
                    {errors.itemDescriptions?.[item.id] && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.itemDescriptions[item.id]}
                      </p>
                    )}
                  </div>

                  {/* Quantity */}
                  <div>
                    <Input
                      id={`quantity-desktop-${item.id}`}
                      aria-label="Quantity"
                      className="h-9"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                      }
                    />
                    {errors.itemQuantities?.[item.id] && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.itemQuantities[item.id]}
                      </p>
                    )}
                  </div>

                  {/* Unit */}
                  <Select
                    value={item.unit}
                    onValueChange={(v) => updateLineItem(item.id, 'unit', v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Std</SelectItem>
                      <SelectItem value="days">Tage</SelectItem>
                      <SelectItem value="month">Mon</SelectItem>
                      <SelectItem value="units">Stk</SelectItem>
                      <SelectItem value="pieces">Stk</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Unit Price */}
                  <div>
                    <Input
                      id={`unitPrice-desktop-${item.id}`}
                      aria-label="Unit Price"
                      className="h-9"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                      }
                    />
                    {errors.itemPrices?.[item.id] && (
                      <p className="mt-1 text-xs text-destructive">
                        {errors.itemPrices[item.id]}
                      </p>
                    )}
                  </div>

                  {/* Per-line VAT Rate */}
                  <Select
                    value={String(item.vatRate ?? vatRate)}
                    onValueChange={(v) => updateLineItem(item.id, 'vatRate', Number(v) as VatRate)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="19">19%</SelectItem>
                      <SelectItem value="7">7%</SelectItem>
                      <SelectItem value="0">0%</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Remove Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => removeLineItem(item.id)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>

                {/* Line Amount */}
                <div className="mt-3 text-right text-sm font-medium">
                  {formatCurrency(lineItemAmounts[index])}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals with multi-VAT breakdown */}
      <div className="space-y-2 rounded-lg bg-muted p-3 sm:p-4 w-full">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Netto</span>
          <span>{formatCurrency(calculations.subtotal)}</span>
        </div>
        {/* Multi-VAT breakdown: show each VAT rate separately */}
        {Object.entries(calculations.vatBreakdown)
          .filter(([, { net }]) => net > 0)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([rate, { net, vat }]) => (
            <div key={rate} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                MwSt {rate}% auf {formatCurrency(net)}
              </span>
              <span>{formatCurrency(vat)}</span>
            </div>
          ))}
        <div className="flex justify-between border-t pt-2 font-semibold">
          <span>Gesamt</span>
          <span>{formatCurrency(calculations.total)}</span>
        </div>
      </div>

      {/* E-Rechnung Section */}
      <div className="space-y-3 rounded-lg border p-4">
        <Label className="text-sm font-semibold">E-Rechnung (optional)</Label>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="eInvoiceFormat" className="text-xs text-muted-foreground">Format</Label>
            <Select
              value={eInvoiceFormat}
              onValueChange={setEInvoiceFormat}
            >
              <SelectTrigger id="eInvoiceFormat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine E-Rechnung</SelectItem>
                <SelectItem value="zugferd">ZUGFeRD</SelectItem>
                <SelectItem value="xrechnung">X-Rechnung</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {eInvoiceFormat === 'xrechnung' && (
            <div className="space-y-2">
              <Label htmlFor="leitwegId" className="text-xs text-muted-foreground">Leitweg-ID</Label>
              <Input
                id="leitwegId"
                value={leitwegId}
                onChange={(e) => setLeitwegId(e.target.value)}
                placeholder="z.B. 04011000-1234512345-06"
              />
            </div>
          )}
          {eInvoiceFormat !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="buyerReference" className="text-xs text-muted-foreground">Buyer Reference</Label>
              <Input
                id="buyerReference"
                value={buyerReference}
                onChange={(e) => setBuyerReference(e.target.value)}
                placeholder="Käufer-Referenz"
              />
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2 w-full">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={3}
          className="w-full"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Invoice
        </Button>
      </div>
    </form>
  )
}

export default InvoiceForm
