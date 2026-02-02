/**
 * AssetDialog Component
 *
 * Dialog wrapper for AssetForm to create and edit assets.
 * Manages the dialog state and connects form submission to the assets store.
 */

import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { AssetForm } from './AssetForm'
import { useAssets } from '../../hooks/useAssets'
import type { Asset, NewAsset } from '../../types'

export interface AssetDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Asset to edit (null for create mode) */
  asset?: Asset | null
  /** Callback when dialog should close */
  onClose: () => void
  /** Callback when asset is successfully created or updated */
  onSuccess?: () => void
}

export function AssetDialog({
  open,
  onOpenChange,
  asset,
  onClose,
  onSuccess,
}: AssetDialogProps) {
  const { createAsset, updateAsset, error, clearError } = useAssets()

  // Clear error when dialog opens/closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      clearError()
    }
    onOpenChange(isOpen)
  }

  const handleSubmit = async (data: NewAsset) => {
    try {
      let result: Asset | null
      if (asset) {
        result = await updateAsset(asset.id, data)
      } else {
        result = await createAsset(data)
      }

      if (!result) {
        // Error was set in hook, don't close dialog
        // The error will be displayed by the hook's error state
        return
      }

      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Failed to save asset:', error)
      // Error state is already set in the hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[600px] max-h-[90vh] overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            {error}
          </div>
        )}
        <AssetForm
          asset={asset || undefined}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}

export default AssetDialog
