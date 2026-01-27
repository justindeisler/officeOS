/**
 * Asset Management Components
 *
 * Components for managing fixed assets with German AfA (Absetzung für Abnutzung)
 * depreciation tracking, including:
 * - AssetList: Display and filter assets with status badges
 * - AssetForm: Create/edit assets with VAT and GWG detection
 * - AssetDetail: Detailed asset view with depreciation schedule
 * - DepreciationTable: Year-by-year depreciation display
 */

export { AssetList } from './AssetList'
export { AssetForm } from './AssetForm'
export { AssetDialog } from './AssetDialog'
export { AssetDetail } from './AssetDetail'
export { DepreciationTable } from './DepreciationTable'

// Re-export types for convenience
export type { AssetListProps } from './AssetList'
export type { AssetFormProps } from './AssetForm'
export type { AssetDialogProps } from './AssetDialog'
export type { AssetDetailProps } from './AssetDetail'
export type { DepreciationTableProps } from './DepreciationTable'
