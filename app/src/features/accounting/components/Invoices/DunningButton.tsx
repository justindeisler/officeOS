/**
 * DunningButton Component
 *
 * Button component shown on InvoiceList for overdue invoices.
 * Shows current dunning level (0/1/2/3) with color coding.
 * Click → opens dunning wizard.
 */

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Mail, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DunningButtonProps {
  dunningLevel: number
  onClick: () => void
  disabled?: boolean
  size?: 'sm' | 'default'
  className?: string
}

const levelConfig: Record<
  number,
  { label: string; shortLabel: string; color: string; icon: React.ElementType }
> = {
  0: {
    label: 'Erinnern',
    shortLabel: 'Erinnern',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Mail,
  },
  1: {
    label: '1. Mahnung',
    shortLabel: '1. Mahn.',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: Send,
  },
  2: {
    label: '2. Mahnung',
    shortLabel: '2. Mahn.',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertTriangle,
  },
  3: {
    label: 'Max. Stufe',
    shortLabel: 'Max.',
    color: 'bg-red-200 text-red-900 border-red-300',
    icon: AlertTriangle,
  },
}

export function DunningButton({
  dunningLevel,
  onClick,
  disabled,
  size = 'sm',
  className,
}: DunningButtonProps) {
  const config = levelConfig[dunningLevel] || levelConfig[0]
  const nextLevel = Math.min(dunningLevel + 1, 3)
  const nextConfig = levelConfig[nextLevel] || levelConfig[3]
  const isMaxLevel = dunningLevel >= 3
  const Icon = config.icon

  if (isMaxLevel) {
    return (
      <Badge className={cn(config.color, className)} variant="outline">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Max. Mahnstufe
      </Badge>
    )
  }

  return (
    <Button
      variant="outline"
      size={size}
      className={cn('gap-1.5', className)}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      disabled={disabled}
    >
      <Icon className="h-3.5 w-3.5" />
      {dunningLevel === 0 ? 'Erinnern' : `${nextConfig.shortLabel} senden`}
      {dunningLevel > 0 && (
        <Badge className={cn(config.color, 'text-[9px] h-4 px-1')} variant="outline">
          Stufe {dunningLevel}
        </Badge>
      )}
    </Button>
  )
}
