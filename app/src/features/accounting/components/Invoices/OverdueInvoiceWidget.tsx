/**
 * OverdueInvoiceWidget Component
 *
 * Dashboard widget showing:
 * - Count + total amount of overdue invoices
 * - Grouped by dunning level
 * - Quick link to dunning workflow
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Mail,
  Send,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'

export interface OverdueInvoice {
  id: string
  invoice_number: string
  total: number
  due_date: string
  client_name: string | null
  dunning_level: number
}

export interface OverdueInvoiceWidgetProps {
  invoices: OverdueInvoice[]
  isLoading?: boolean
  className?: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

const levelConfig: Record<number, { label: string; color: string; icon: React.ElementType }> = {
  0: { label: 'Keine Mahnung', color: 'text-yellow-600 bg-yellow-100', icon: Clock },
  1: { label: 'Erinnerung', color: 'text-orange-600 bg-orange-100', icon: Mail },
  2: { label: '1. Mahnung', color: 'text-red-600 bg-red-100', icon: Send },
  3: { label: '2. Mahnung', color: 'text-red-800 bg-red-200', icon: AlertTriangle },
}

export function OverdueInvoiceWidget({
  invoices,
  isLoading,
  className,
}: OverdueInvoiceWidgetProps) {
  const navigate = useNavigate()

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.total, 0)

  // Group by dunning level
  const byLevel = invoices.reduce<Record<number, OverdueInvoice[]>>(
    (acc, inv) => {
      const level = inv.dunning_level || 0
      if (!acc[level]) acc[level] = []
      acc[level].push(inv)
      return acc
    },
    {}
  )

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (invoices.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <div className="text-green-500 mb-2">✓</div>
          <p className="text-sm text-muted-foreground">
            Keine überfälligen Rechnungen
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('border-orange-200 dark:border-orange-900', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-sm font-medium">
              Überfällige Rechnungen
            </CardTitle>
          </div>
          <Badge variant="destructive" className="h-6">
            {invoices.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Total */}
        <div className="text-2xl font-bold text-red-600 mb-3">
          {formatCurrency(totalAmount)}
        </div>

        {/* By level */}
        <div className="space-y-1.5 mb-3">
          {Object.entries(byLevel)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([level, items]) => {
              const config = levelConfig[Number(level)] || levelConfig[0]
              const LevelIcon = config.icon
              return (
                <div
                  key={level}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(config.color, 'text-[10px]')}
                      variant="outline"
                    >
                      <LevelIcon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground">
                    {items.length} Stk. ·{' '}
                    {formatCurrency(items.reduce((s, i) => s + i.total, 0))}
                  </span>
                </div>
              )
            })}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate('/accounting/dunning')}
        >
          Mahnwesen öffnen
          <ArrowRight className="h-3.5 w-3.5 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}
