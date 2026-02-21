/**
 * VendorSuggestions Component
 *
 * Autocomplete dropdown for vendor selection.
 * Shows recent vendors with transaction frequency badges and last amounts.
 * Uses shadcn/ui Command (combobox pattern) with Popover.
 */

import { useState, useEffect } from 'react'
import { ChevronsUpDown, Store, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { VendorSuggestion } from '../../api/suggestions'

export interface VendorSuggestionsProps {
  /** Called when a vendor is selected from suggestions */
  onSelect: (vendor: string) => void
  /** Currently selected/entered vendor */
  selectedVendor?: string
  /** List of vendor suggestions (from useExpenseSuggestions) */
  vendors?: VendorSuggestion[]
  /** Loading state */
  isLoading?: boolean
  /** Custom label text */
  label?: string
  /** Custom placeholder */
  placeholder?: string
  /** Error state from react-hook-form */
  error?: string
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

export function VendorSuggestions({
  onSelect,
  selectedVendor = '',
  vendors = [],
  isLoading = false,
  label = 'Vendor',
  placeholder = 'Search vendors...',
  error,
}: VendorSuggestionsProps) {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(selectedVendor)

  // Sync input with external selectedVendor changes
  useEffect(() => {
    setInputValue(selectedVendor)
  }, [selectedVendor])

  const handleSelect = (vendor: string) => {
    setInputValue(vendor)
    onSelect(vendor)
    setOpen(false)
  }

  const handleInputChange = (value: string) => {
    setInputValue(value)
    // Let the parent know immediately for debounced API calls
    onSelect(value)
  }

  const hasVendors = vendors.length > 0

  return (
    <div className="space-y-2">
      <Label htmlFor="vendor">{label}</Label>
      <div className="flex gap-2">
        <Input
          id="vendor"
          placeholder="e.g., Amazon, Adobe, etc."
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          aria-invalid={!!error}
          className="flex-1"
          data-testid="vendor-input"
        />
        {hasVendors && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                aria-label="Select from recent vendors"
                className="w-10 p-0 shrink-0"
                data-testid="vendor-suggestions-trigger"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronsUpDown className="h-4 w-4" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="end">
              <Command>
                <CommandInput placeholder={placeholder} />
                <CommandList>
                  <CommandEmpty>No vendors found.</CommandEmpty>
                  <CommandGroup heading="Recent Vendors">
                    {vendors.map((v) => (
                      <CommandItem
                        key={v.vendor}
                        value={v.vendor}
                        onSelect={() => handleSelect(v.vendor)}
                        className="flex items-center justify-between"
                        data-testid={`vendor-option-${v.vendor}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{v.vendor}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <Badge variant="secondary" className="text-xs font-normal">
                            {v.count}×
                          </Badge>
                          {v.lastAmount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(v.lastAmount)}
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
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}

export default VendorSuggestions
