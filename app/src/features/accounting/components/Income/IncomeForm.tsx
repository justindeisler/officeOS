/**
 * IncomeForm Component
 *
 * Form for creating and editing income records.
 * Features automatic VAT calculation and validation.
 */

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Income, NewIncome, VatRate } from '../../types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

// Form validation schema
const incomeFormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required'),
  netAmount: z.number().positive('Amount must be positive'),
  vatRate: z.enum(['0', '7', '19']),
  euerCategory: z.string().default('services'),
  paymentMethod: z.string().optional(),
  bankReference: z.string().optional(),
})

type IncomeFormData = z.infer<typeof incomeFormSchema>

export interface IncomeFormProps {
  /** Existing income record for editing */
  income?: Income
  /** Callback when form is submitted */
  onSubmit: (data: NewIncome) => Promise<void> | void
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
 * EÜR Income Categories
 */
const INCOME_CATEGORIES = [
  { value: 'services', label: 'Dienstleistungen (Services)' },
  { value: 'products', label: 'Warenverkauf (Products)' },
  { value: 'license', label: 'Lizenzgebühren (License Fees)' },
  { value: 'other', label: 'Sonstige (Other)' },
]

export function IncomeForm({
  income,
  onSubmit,
  onCancel,
  className,
}: IncomeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!income

  const defaultValues: IncomeFormData = {
    date: income?.date
      ? income.date.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    description: income?.description ?? '',
    netAmount: income?.netAmount ?? 0,
    vatRate: String(income?.vatRate ?? 19) as '0' | '7' | '19',
    euerCategory: income?.euerCategory ?? 'services',
    paymentMethod: income?.paymentMethod ?? '',
    bankReference: income?.bankReference ?? '',
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IncomeFormData>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues,
  })

  const watchNetAmount = watch('netAmount')
  const watchVatRate = watch('vatRate')

  // Calculate VAT and gross amounts
  const calculations = useMemo(() => {
    const net = Number(watchNetAmount) || 0
    const rate = Number(watchVatRate) || 19
    const vat = Math.round(net * (rate / 100) * 100) / 100
    const gross = Math.round((net + vat) * 100) / 100

    return { net, vat, gross, rate }
  }, [watchNetAmount, watchVatRate])

  // Handle form submission
  const handleFormSubmit = async (data: IncomeFormData) => {
    setIsSubmitting(true)

    try {
      const newIncome: NewIncome = {
        date: new Date(data.date),
        description: data.description,
        netAmount: data.netAmount,
        vatRate: Number(data.vatRate) as VatRate,
        euerCategory: data.euerCategory,
        paymentMethod: data.paymentMethod as NewIncome['paymentMethod'],
        bankReference: data.bankReference,
      }

      await onSubmit(newIncome)
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
          {isEditing ? 'Edit Income' : 'Add Income'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isEditing
            ? 'Update the income record details below.'
            : 'Enter the details for the new income record.'}
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

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          placeholder="e.g., Consulting services for Project X"
          {...register('description')}
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Amount and VAT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Net Amount */}
        <div className="space-y-2">
          <Label htmlFor="netAmount">Net Amount (€)</Label>
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

      {/* VAT Calculation Display */}
      <div className="rounded-lg bg-muted p-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Net</div>
            <div className="font-medium">{formatCurrency(calculations.net)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">VAT ({calculations.rate}%)</div>
            <div className="font-medium">{formatCurrency(calculations.vat)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Gross</div>
            <div className="font-semibold">{formatCurrency(calculations.gross)}</div>
          </div>
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="euerCategory">Category</Label>
        <select
          id="euerCategory"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register('euerCategory')}
        >
          {INCOME_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Optional Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="paymentMethod">Payment Method (optional)</Label>
          <select
            id="paymentMethod"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register('paymentMethod')}
          >
            <option value="">Select...</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="paypal">PayPal</option>
            <option value="credit_card">Credit Card</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bankReference">Bank Reference (optional)</Label>
          <Input
            id="bankReference"
            placeholder="e.g., Transaction ID"
            {...register('bankReference')}
          />
        </div>
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

export default IncomeForm
