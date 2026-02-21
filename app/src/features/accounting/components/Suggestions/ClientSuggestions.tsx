/**
 * ClientSuggestions Component
 *
 * Autocomplete dropdown for client selection in income/invoice forms.
 * Shows recent clients with transaction frequency badges and last amounts.
 * Uses shadcn/ui Command (combobox pattern) with Popover.
 */

import { useState } from 'react'
import { ChevronsUpDown, Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { ClientSuggestion } from '../../api/suggestions'

export interface ClientSuggestionsProps {
  /** Called when a client is selected from suggestions */
  onSelect: (client: string) => void
  /** Currently selected client name */
  selectedClient?: string
  /** List of client suggestions (from useIncomeSuggestions) */
  clients?: ClientSuggestion[]
  /** Loading state */
  isLoading?: boolean
  /** Custom placeholder */
  placeholder?: string
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

export function ClientSuggestions({
  onSelect,
  selectedClient = '',
  clients = [],
  isLoading = false,
  placeholder = 'Search clients...',
}: ClientSuggestionsProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (client: string) => {
    onSelect(client)
    setOpen(false)
  }

  if (clients.length === 0 && !isLoading) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select from recent clients"
          className="w-full justify-between"
          data-testid="client-suggestions-trigger"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate text-left">
              {selectedClient || 'Select a recent client...'}
            </span>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0 ml-2" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup heading="Recent Clients">
              {clients.map((c) => (
                <CommandItem
                  key={c.client}
                  value={c.client}
                  onSelect={() => handleSelect(c.client)}
                  className="flex items-center justify-between"
                  data-testid={`client-option-${c.client}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{c.client}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {c.count > 0 && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {c.count}×
                      </Badge>
                    )}
                    {c.lastAmount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(c.lastAmount)}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default ClientSuggestions
