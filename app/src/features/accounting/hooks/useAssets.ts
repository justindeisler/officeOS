/**
 * useAssets Hook
 *
 * React hook for managing asset state and operations.
 * Provides CRUD operations with loading and error states.
 * Includes depreciation tracking and disposal management.
 */

import { useState, useCallback, useEffect } from 'react'
import type { Asset, NewAsset, AssetCategory, AssetStatus } from '../types'
import * as assetsApi from '../api/assets'
import { attachmentService } from '@/services/attachmentService'

export interface UseAssetsOptions {
  /** Auto-fetch assets on mount */
  autoFetch?: boolean
  /** Filter by category */
  category?: AssetCategory
  /** Filter by status */
  status?: AssetStatus
}

export interface DepreciationSummary {
  totalDepreciation: number
  byCategory: Record<AssetCategory, number>
}

export interface UseAssetsReturn {
  /** List of assets */
  assets: Asset[]
  /** Loading state */
  isLoading: boolean
  /** Error message if any */
  error: string | null
  /** Fetch all assets */
  fetchAssets: () => Promise<void>
  /** Fetch assets by category */
  fetchByCategory: (category: AssetCategory) => Promise<void>
  /** Fetch assets by status */
  fetchByStatus: (status: AssetStatus) => Promise<void>
  /** Get active assets */
  fetchActiveAssets: () => Promise<void>
  /** Get disposed assets */
  fetchDisposedAssets: () => Promise<void>
  /** Create a new asset */
  createAsset: (data: NewAsset) => Promise<Asset | null>
  /** Update an existing asset */
  updateAsset: (id: string, data: Partial<NewAsset>) => Promise<Asset | null>
  /** Delete an asset */
  deleteAsset: (id: string) => Promise<boolean>
  /** Dispose of an asset */
  disposeAsset: (
    id: string,
    disposalDate: Date,
    status: 'disposed' | 'sold',
    disposalPrice?: number
  ) => Promise<Asset | null>
  /** Get yearly depreciation total */
  getYearlyDepreciation: (year: number) => Promise<number>
  /** Get depreciation summary by category */
  getDepreciationByCategory: (year: number) => Promise<Record<AssetCategory, number>>
  /** Get total asset value */
  getTotalAssetValue: () => Promise<number>
  /** Currently selected asset */
  selectedAsset: Asset | null
  /** Set selected asset */
  setSelectedAsset: (asset: Asset | null) => void
  /** Refresh the asset list */
  refresh: () => Promise<void>
  /** Clear error state */
  clearError: () => void
}

/**
 * Hook for managing assets
 */
export function useAssets(options: UseAssetsOptions = {}): UseAssetsReturn {
  const { autoFetch = true, category, status } = options

  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  /**
   * Fetch all assets
   */
  const fetchAssets = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await assetsApi.getAllAssets()
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assets')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch assets by category
   */
  const fetchByCategory = useCallback(async (cat: AssetCategory) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await assetsApi.getAssetsByCategory(cat)
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assets')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch assets by status
   */
  const fetchByStatus = useCallback(async (stat: AssetStatus) => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await assetsApi.getAssetsByStatus(stat)
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assets')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch active assets only
   */
  const fetchActiveAssets = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await assetsApi.getActiveAssets()
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch active assets')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Fetch disposed assets
   */
  const fetchDisposedAssets = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await assetsApi.getDisposedAssets()
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch disposed assets')
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Create a new asset
   * If billPath is provided, copies the file to app data directory
   */
  const createAsset = useCallback(async (data: NewAsset): Promise<Asset | null> => {
    setIsLoading(true)
    setError(null)

    try {
      // Generate asset ID upfront so we can use it for file storage
      const assetId = crypto.randomUUID()
      console.log(`[useAssets] Creating asset with ID: ${assetId}`)
      console.log(`[useAssets] Input billPath: ${data.billPath}`)

      // If a bill file path is provided, copy it to app data
      let finalBillPath = data.billPath
      if (data.billPath) {
        try {
          // Extract filename from path
          const pathParts = data.billPath.split(/[/\\]/)
          const fileName = pathParts[pathParts.length - 1]
          console.log(`[useAssets] Extracted filename: ${fileName}`)

          // Copy file to app data directory
          finalBillPath = await attachmentService.saveAttachment(
            assetId,
            data.billPath,
            fileName
          )
          console.log(`[useAssets] Final billPath after save: ${finalBillPath}`)
        } catch (fileError) {
          console.error('[useAssets] Failed to save attachment:', fileError)
          // Surface error to user instead of silently continuing
          throw new Error('Failed to save attachment file. Please try again.')
        }
      }

      // Create asset with the final bill path
      const assetData: NewAsset = {
        ...data,
        billPath: finalBillPath,
      }
      console.log(`[useAssets] Creating asset with data:`, { ...assetData, description: '...' })

      // Pass the pre-generated ID so file storage and asset ID match
      const newAsset = await assetsApi.createAsset(assetData, assetId)
      console.log(`[useAssets] Asset created with billPath: ${newAsset.billPath}`)
      setAssets((prev) => [newAsset, ...prev])
      return newAsset
    } catch (err) {
      console.error('[useAssets] Failed to create asset:', err)
      setError(err instanceof Error ? err.message : 'Failed to create asset')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Update an existing asset
   * Handles file attachment changes (add/remove/replace)
   */
  const updateAsset = useCallback(
    async (id: string, data: Partial<NewAsset>): Promise<Asset | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // Get current asset to check if bill path is changing
        const currentAsset = assets.find((a) => a.id === id)
        let finalBillPath = data.billPath

        // Handle bill path changes
        if (data.billPath !== undefined) {
          const isNewPath = data.billPath !== currentAsset?.billPath

          if (isNewPath && data.billPath) {
            // New file being attached - copy to app data
            try {
              const pathParts = data.billPath.split(/[/\\]/)
              const fileName = pathParts[pathParts.length - 1]
              finalBillPath = await attachmentService.saveAttachment(
                id,
                data.billPath,
                fileName
              )

              // Delete old attachment if it exists
              if (currentAsset?.billPath) {
                await attachmentService.deleteAttachment(currentAsset.billPath)
              }
            } catch (fileError) {
              console.error('Failed to save attachment:', fileError)
              // Keep existing bill path on error
              finalBillPath = currentAsset?.billPath
            }
          } else if (isNewPath && !data.billPath && currentAsset?.billPath) {
            // Attachment being removed
            try {
              await attachmentService.deleteAttachment(currentAsset.billPath)
              finalBillPath = undefined
            } catch (fileError) {
              console.error('Failed to delete attachment:', fileError)
              // Keep existing bill path on error
              finalBillPath = currentAsset?.billPath
            }
          }
        }

        const updateData: Partial<NewAsset> = {
          ...data,
          billPath: finalBillPath,
        }

        const updated = await assetsApi.updateAsset(id, updateData)
        if (updated) {
          setAssets((prev) =>
            prev.map((item) => (item.id === id ? updated : item))
          )
          if (selectedAsset?.id === id) {
            setSelectedAsset(updated)
          }
        }
        return updated
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update asset')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [selectedAsset, assets]
  )

  /**
   * Delete an asset
   */
  const deleteAsset = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true)
      setError(null)

      try {
        const success = await assetsApi.deleteAsset(id)
        if (success) {
          setAssets((prev) => prev.filter((item) => item.id !== id))
          if (selectedAsset?.id === id) {
            setSelectedAsset(null)
          }
        }
        return success
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete asset')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [selectedAsset]
  )

  /**
   * Dispose of an asset (mark as disposed or sold)
   */
  const disposeAsset = useCallback(
    async (
      id: string,
      disposalDate: Date,
      disposalStatus: 'disposed' | 'sold',
      disposalPrice?: number
    ): Promise<Asset | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const updated = await assetsApi.disposeAsset(id, disposalDate, disposalStatus, disposalPrice)
        if (updated) {
          setAssets((prev) =>
            prev.map((item) => (item.id === id ? updated : item))
          )
          if (selectedAsset?.id === id) {
            setSelectedAsset(updated)
          }
        }
        return updated
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to dispose asset')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [selectedAsset]
  )

  /**
   * Get yearly depreciation total
   */
  const getYearlyDepreciation = useCallback(async (year: number): Promise<number> => {
    try {
      return await assetsApi.getYearlyDepreciation(year)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get depreciation')
      return 0
    }
  }, [])

  /**
   * Get depreciation summary by category
   */
  const getDepreciationByCategory = useCallback(
    async (year: number): Promise<Record<AssetCategory, number>> => {
      try {
        return await assetsApi.getDepreciationByCategory(year)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get depreciation by category')
        return {
          computer: 0,
          phone: 0,
          furniture: 0,
          equipment: 0,
          software: 0,
        }
      }
    },
    []
  )

  /**
   * Get total asset value
   */
  const getTotalAssetValue = useCallback(async (): Promise<number> => {
    try {
      return await assetsApi.getTotalAssetValue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get total asset value')
      return 0
    }
  }, [])

  /**
   * Refresh the asset list based on current filters
   */
  const refresh = useCallback(async () => {
    if (category) {
      await fetchByCategory(category)
    } else if (status) {
      await fetchByStatus(status)
    } else {
      await fetchAssets()
    }
  }, [category, status, fetchByCategory, fetchByStatus, fetchAssets])

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    assets,
    isLoading,
    error,
    fetchAssets,
    fetchByCategory,
    fetchByStatus,
    fetchActiveAssets,
    fetchDisposedAssets,
    createAsset,
    updateAsset,
    deleteAsset,
    disposeAsset,
    getYearlyDepreciation,
    getDepreciationByCategory,
    getTotalAssetValue,
    selectedAsset,
    setSelectedAsset,
    refresh,
    clearError,
  }
}

export default useAssets
