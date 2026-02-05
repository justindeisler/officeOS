/**
 * ExpenseForm Component
 *
 * Form for creating and editing expense records.
 * Features automatic VAT calculation, net/gross toggle,
 * GWG detection, recurring expense support, and validation.
 */

import { useState, useMemo, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Expense, NewExpense, VatRate, RecurringFrequency } from '../../types'
import { GWG_THRESHOLDS } from '../../types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertTriangle } from 'lucide-react'

// ============================================================================
// VAT Calculation Utilities
// ============================================================================

export interface VatCalculation {
  net: number
  vat: number
  gross: number
}

/**
 * Calculate VAT and gross from a net amount.
 */
export function calculateFromNet(netAmount: number, vatRate: number): VatCalculation {
  const net = Math.round(netAmount * 100) / 100
  const vat = Math.round(net * (vatRate / 100) * 100) / 100
  const gross = Math.round((net + vat) * 100) / 100
  return { net, vat, gross }
}

/**
 * Reverse-calculate net and VAT from a gross amount.
 */
export function calculateFromGross(grossAmount: number, vatRate: number): VatCalculation {
  const gross = Math.round(grossAmount * 100) / 100
  if (vatRate === 0) {
    return { net: gross, vat: 0, gross }
  }
  const net = Math.round((gross / (1 + vatRate / 100)) * 100) / 100
  const vat = Math.round((gross - net) * 100) / 100
  return { net, vat, gross }
}

/** Input mode for the amount field */
type AmountInputMode = 'net' | 'gross'

// Form validation schema
const expenseFormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  vendor: z.string().min(1, 'Vendor is required'),
  description: z.string().min(1, 'Description is required'),
  netAmount: z.number().positive('Amount must be positive'),
  vatRate: z.enum(['0', '7', '19']),
  euerCategory: z.string().default('software'),
  deductiblePercent: z.number().min(0).max(100, 'Must be between 0 and 100').default(100),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  receiptPath: z.string().optional(),
})

type ExpenseFormData = z.infer<typeof expenseFormSchema>

export interface ExpenseFormProps {
  /** Existing expense record for editing */
  expense?: Expense
  /** Callback when form is submitted */
  onSubmit: (data: NewExpense) => Promise<void> | void
  /** Callback when form is cancelled */
  onCancel: () => void
  /** Additional CSS classes */
  className?: string
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
 * EÜR Expense Categories
 */
const CATEGORY_OPTIONS = [
  { value: 'software', label: 'Software & Lizenzen', line: 34 },
  { value: 'telecom', label: 'Telekommunikation', line: 34 },
  { value: 'hosting', label: 'Hosting & Domains', line: 34 },
  { value: 'travel', label: 'Reisekosten', line: 34 },
  { value: 'insurance', label: 'Versicherungen', line: 34 },
  { value: 'bank_fees', label: 'Kontoführung', line: 34 },
  { value: 'training', label: 'Fortbildung', line: 34 },
  { value: 'books', label: 'Fachliteratur', line: 34 },
  { value: 'office_supplies', label: 'Büromaterial', line: 34 },
  { value: 'subcontractor', label: 'Fremdleistungen', line: 25 },
  { value: 'homeoffice', label: 'Arbeitszimmer', line: 33 },
]

/**
 * Detect GWG status based on net amount
 */
function detectGwgStatus(netAmount: number): 'immediate' | 'gwg' | 'pool' | 'afa' | null {
  if (netAmount <= 0) return null
  if (netAmount <= GWG_THRESHOLDS.SOFORTABSCHREIBUNG) return 'immediate'
  if (netAmount <= GWG_THRESHOLDS.GWG_MAX) return 'gwg'
  if (netAmount <= GWG_THRESHOLDS.POOL_MAX) return 'pool'
  return 'afa'
}

export function ExpenseForm({
  expense,
  onSubmit,
  onCancel,
  className,
}: ExpenseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inputMode, setInputMode] = useState<AmountInputMode>('net')

  const isEditing = !!expense

  const defaultValues: ExpenseFormData = {
    date: expense?.date
      ? expense.date.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    vendor: expense?.vendor ?? '',
    description: expense?.description ?? '',
    netAmount: expense?.netAmount ?? 0,
    vatRate: String(expense?.vatRate ?? 19) as '0' | '7' | '19',
    euerCategory: expense?.euerCategory ?? 'software',
    deductiblePercent: expense?.deductiblePercent ?? 100,
    isRecurring: expense?.isRecurring ?? false,
    recurringFrequency: expense?.recurringFrequency,
    receiptPath: expense?.receiptPath ?? '',
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues,
  })

  const watchNetAmount = watch('netAmount')
  const watchVatRate = watch('vatRate')
  const watchIsRecurring = watch('isRecurring')
  const watchEuerCategory = watch('euerCategory')

  // Calculate VAT and gross amounts based on input mode
  const calculations = useMemo(() => {
    const amount = Number(watchNetAmount) || 0
    const rate = watchVatRate != null ? Number(watchVatRate) : 19

    if (inputMode === 'gross') {
      // In gross mode, the form field holds the gross value;
      // reverse-calculate net and vat
      const result = calculateFromGross(amount, rate)
      return { ...result, rate }
    }

    // In net mode, calculate forward
    const result = calculateFromNet(amount, rate)
    return { ...result, rate }
  }, [watchNetAmount, watchVatRate, inputMode])

  // Handle toggling between net and gross input mode
  const handleModeSwitch = useCallback(
    (newMode: AmountInputMode) => {
      if (newMode === inputMode) return
      const currentAmount = Number(watchNetAmount) || 0
      const rate = Number(watchVatRate) || 19

      if (newMode === 'gross') {
        // Switching net → gross: convert current net to gross
        const result = calculateFromNet(currentAmount, rate)
        setValue('netAmount', result.gross)
      } else {
        // Switching gross → net: convert current gross to net
        const result = calculateFromGross(currentAmount, rate)
        setValue('netAmount', result.net)
      }
      setInputMode(newMode)
    },
    [inputMode, watchNetAmount, watchVatRate, setValue],
  )

  // GWG status detection (always based on net amount)
  const gwgStatus = useMemo(() => {
    return detectGwgStatus(calculations.net)
  }, [calculations.net])

  // Get EÜR line for selected category
  const selectedCategory = CATEGORY_OPTIONS.find(c => c.value === watchEuerCategory)

  // Handle form submission - always submit net amount
  const handleFormSubmit = async (data: ExpenseFormData) => {
    setIsSubmitting(true)

    try {
      // If in gross mode, reverse-calculate the net amount for storage
      let netAmount = data.netAmount
      if (inputMode === 'gross') {
        const result = calculateFromGross(data.netAmount, Number(data.vatRate))
        netAmount = result.net
      }

      const newExpense: NewExpense = {
        date: new Date(data.date),
        vendor: data.vendor,
        description: data.description,
        netAmount,
        vatRate: Number(data.vatRate) as VatRate,
        euerLine: selectedCategory?.line ?? 34,
        euerCategory: data.euerCategory,
        deductiblePercent: data.deductiblePercent,
        isRecurring: data.isRecurring,
        recurringFrequency: data.isRecurring ? data.recurringFrequency as RecurringFrequency : undefined,
        receiptPath: data.receiptPath || undefined,
      }

      await onSubmit(newExpense)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className={cn('space-y-6', className)}
    >
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">
          {isEditing ? 'Edit Expense' : 'Add Expense'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isEditing
            ? 'Update the expense record details below.'
            : 'Enter the details for the new expense record.'}
        </p>
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          {...register('date')}
          aria-invalid={!!errors.date}
        />
        {errors.date && (
          <p className="text-sm text-destructive">{errors.date.message}</p>
        )}
      </div>

      {/* Vendor */}
      <div className="space-y-2">
        <Label htmlFor="vendor">Vendor</Label>
        <Input
          id="vendor"
          placeholder="e.g., Amazon, Adobe, etc."
          {...register('vendor')}
          aria-invalid={!!errors.vendor}
        />
        {errors.vendor && (
          <p className="text-sm text-destructive">{errors.vendor.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          placeholder="e.g., Software subscription, Office supplies"
          {...register('description')}
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Net/Gross Toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit" role="radiogroup" aria-label="Amount input mode">
        <button
          type="button"
          role="radio"
          aria-checked={inputMode === 'net'}
          aria-label="Net Amount"
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            inputMode === 'net'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => handleModeSwitch('net')}
        >
          Net
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={inputMode === 'gross'}
          aria-label="Gross Amount"
          className={cn(
            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            inputMode === 'gross'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => handleModeSwitch('gross')}
        >
          Gross
        </button>
      </div>

      {/* Amount and VAT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Amount Input (label changes based on mode) */}
        <div className="space-y-2">
          <Label htmlFor="netAmount">
            {inputMode === 'gross' ? 'Gross Amount (€)' : 'Net Amount (€)'}
          </Label>
          <Input
            id="netAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('netAmount', { valueAsNumber: true })}
            aria-invalid={!!errors.netAmount}
          />
          {errors.netAmount && (
            <p className="text-sm text-destructive">{errors.netAmount.message}</p>
          )}
        </div>

        {/* VAT Rate */}
        <div className="space-y-2">
          <Label htmlFor="vatRate">VAT Rate</Label>
          <select
            id="vatRate"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register('vatRate')}
          >
            <option value="19">19%</option>
            <option value="7">7%</option>
            <option value="0">0%</option>
          </select>
        </div>
      </div>

      {/* VAT Calculation Display with GWG Status */}
      <div className="rounded-lg bg-muted p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-sm flex-1">
            <div>
              <div className="text-muted-foreground">Net</div>
              <div className="font-medium">{formatCurrency(calculations.net)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Vorsteuer ({calculations.rate}%)</div>
              <div className="font-medium">{formatCurrency(calculations.vat)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Gross</div>
              <div className="font-semibold">{formatCurrency(calculations.gross)}</div>
            </div>
          </div>
          {/* GWG Badge */}
          {gwgStatus === 'gwg' && (
            <Badge variant="default" className="ml-4">GWG</Badge>
          )}
        </div>

        {/* Asset Warning for amounts > €800 */}
        {(gwgStatus === 'pool' || gwgStatus === 'afa') && (
          <div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span>
              {gwgStatus === 'afa'
                ? 'This expense should be recorded as an asset with depreciation (AfA).'
                : 'This expense can be depreciated via pool method or regular AfA.'}
            </span>
          </div>
        )}
      </div>

      {/* Category and Deductible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="euerCategory">Category</Label>
          <select
            id="euerCategory"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register('euerCategory')}
          >
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Deductible Percent */}
        <div className="space-y-2">
          <Label htmlFor="deductiblePercent">Deductible (%)</Label>
          <Input
            id="deductiblePercent"
            type="number"
            step="1"
            min="0"
            max="100"
            {...register('deductiblePercent', { valueAsNumber: true })}
            aria-invalid={!!errors.deductiblePercent}
          />
          {errors.deductiblePercent && (
            <p className="text-sm text-destructive">{errors.deductiblePercent.message}</p>
          )}
        </div>
      </div>

      {/* Recurring Expense */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            id="isRecurring"
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            {...register('isRecurring')}
          />
          <Label htmlFor="isRecurring" className="cursor-pointer">
            Recurring expense
          </Label>
        </div>

        {watchIsRecurring && (
          <div className="space-y-2 ml-7">
            <Label htmlFor="recurringFrequency">Frequency</Label>
            <select
              id="recurringFrequency"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('recurringFrequency')}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        )}
      </div>

      {/* Receipt Path (optional) */}
      <div className="space-y-2">
        <Label htmlFor="receiptPath">Receipt Path (optional)</Label>
        <Input
          id="receiptPath"
          placeholder="e.g., /receipts/2024/invoice.pdf"
          {...register('receiptPath')}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  )
}

export default ExpenseForm
