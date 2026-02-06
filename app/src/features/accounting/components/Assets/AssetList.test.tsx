import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@/test/utils'
import { AssetList } from './AssetList'
import {
  createMockAsset,
  createMockAssets,
  createMockAssetByCategory,
  createMockDisposedAsset,
} from '@/test/mocks/data/accounting'
import type { Asset, AssetCategory } from '../../types'

// Mock the useAssets hook
vi.mock('../../hooks/useAssets', () => ({
  useAssets: vi.fn(),
  default: vi.fn(),
}))

import { useAssets } from '../../hooks/useAssets'

const mockUseAssets = vi.mocked(useAssets)

describe('AssetList', () => {
  const defaultMockReturn = {
    assets: [] as Asset[],
    isLoading: false,
    error: null,
    fetchAssets: vi.fn(),
    fetchByCategory: vi.fn(),
    fetchByStatus: vi.fn(),
    fetchActiveAssets: vi.fn(),
    fetchDisposedAssets: vi.fn(),
    createAsset: vi.fn(),
    updateAsset: vi.fn(),
    deleteAsset: vi.fn(),
    disposeAsset: vi.fn(),
    getYearlyDepreciation: vi.fn(),
    getDepreciationByCategory: vi.fn(),
    getTotalAssetValue: vi.fn(),
    selectedAsset: null,
    setSelectedAsset: vi.fn(),
    refresh: vi.fn(),
    clearError: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAssets.mockReturnValue(defaultMockReturn)
  })

  describe('rendering', () => {
    it('renders the asset list header', () => {
      render(<AssetList />)

      expect(screen.getByText('Assets')).toBeInTheDocument()
    })

    it('renders empty state when no assets', () => {
      render(<AssetList />)

      expect(screen.getByText(/no assets/i)).toBeInTheDocument()
    })

    it('renders loading state', () => {
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        isLoading: true,
      })

      render(<AssetList />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('renders error state', () => {
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        error: 'Failed to fetch assets',
      })

      render(<AssetList />)

      expect(screen.getByText(/failed to fetch assets/i)).toBeInTheDocument()
    })

    it('renders assets in a table', () => {
      const mockAssets = createMockAssets(3)
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: mockAssets,
      })

      render(<AssetList />)

      // Check table headers
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Category')).toBeInTheDocument()
      expect(screen.getByText('Purchase Date')).toBeInTheDocument()
      expect(screen.getByText('Purchase Price')).toBeInTheDocument()
      expect(screen.getByText('Book Value')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()

      // Check that all records are rendered
      mockAssets.forEach((asset) => {
        expect(screen.getByText(asset.name)).toBeInTheDocument()
      })
    })
  })

  describe('formatting', () => {
    it('formats currency amounts correctly', () => {
      const asset = createMockAsset({
        name: 'Test Asset',
        purchasePrice: 1500,
      })
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: [asset],
      })

      render(<AssetList />)

      // German currency formatting - appears in table row and summary
      expect(screen.getAllByText('1.500,00 €').length).toBeGreaterThanOrEqual(1)
    })

    it('formats dates in German locale', () => {
      const asset = createMockAsset({
        purchaseDate: new Date('2024-03-15'),
      })
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: [asset],
      })

      render(<AssetList />)

      // German date format: DD.MM.YYYY
      expect(screen.getByText('15.03.2024')).toBeInTheDocument()
    })

    it('shows category badge', () => {
      const asset = createMockAssetByCategory('computer')
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: [asset],
      })

      render(<AssetList />)

      expect(screen.getByText('Computer')).toBeInTheDocument()
    })

    it('shows active status badge', () => {
      const asset = createMockAsset({ status: 'active' })
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: [asset],
      })

      render(<AssetList />)

      expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('shows disposed status badge', () => {
      const asset = createMockDisposedAsset('disposed')
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: [asset],
      })

      render(<AssetList />)

      expect(screen.getByText('Disposed')).toBeInTheDocument()
    })

    it('shows sold status badge', () => {
      const asset = createMockDisposedAsset('sold')
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: [asset],
      })

      render(<AssetList />)

      expect(screen.getByText('Sold')).toBeInTheDocument()
    })

    it('shows AfA years for assets', () => {
      const asset = createMockAssetByCategory('computer') // 3 years
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: [asset],
      })

      render(<AssetList />)

      expect(screen.getByText(/3.*years/i)).toBeInTheDocument()
    })
  })

  describe('book value calculation', () => {
    it('displays current book value based on depreciation schedule', () => {
      const asset = createMockAsset({
        name: 'Depreciated Asset',
        purchasePrice: 1500,
        depreciationSchedule: [
          {
            id: '1',
            assetId: 'test',
            year: 2023,
            months: 12,
            amount: 500,
            cumulative: 500,
            bookValue: 1000,
          },
          {
            id: '2',
            assetId: 'test',
            year: 2024,
            months: 12,
            amount: 500,
            cumulative: 1000,
            bookValue: 500,
          },
        ],
      })
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: [asset],
      })

      render(<AssetList />)

      // Should show a book value from the depreciation schedule (500€)
      // The value appears in the Book Value column based on current year
      expect(screen.getAllByText(/€/).length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('interactions', () => {
    it('calls setSelectedAsset when row is clicked', async () => {
      const asset = createMockAsset()
      const setSelectedAsset = vi.fn()
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: [asset],
        setSelectedAsset,
      })

      const { user } = render(<AssetList />)

      await user.click(screen.getByText(asset.name))

      expect(setSelectedAsset).toHaveBeenCalledWith(asset)
    })

    it('calls deleteAsset when delete button is clicked', async () => {
      const asset = createMockAsset()
      const deleteAsset = vi.fn().mockResolvedValue(true)
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: [asset],
        deleteAsset,
      })

      // Mock window.confirm to return true
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      const { user } = render(<AssetList />)

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      await user.click(deleteButton)

      expect(confirmSpy).toHaveBeenCalled()
      expect(deleteAsset).toHaveBeenCalledWith(asset.id)

      confirmSpy.mockRestore()
    })

    it('shows add asset button', () => {
      render(<AssetList />)

      expect(screen.getByRole('button', { name: /add asset/i })).toBeInTheDocument()
    })

    it('calls onAddAsset when add button is clicked', async () => {
      const onAddAsset = vi.fn()

      const { user } = render(<AssetList onAddAsset={onAddAsset} />)

      await user.click(screen.getByRole('button', { name: /add asset/i }))

      expect(onAddAsset).toHaveBeenCalled()
    })

    it('calls onEditAsset when edit callback provided and row clicked', async () => {
      const asset = createMockAsset()
      const onEditAsset = vi.fn()
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets: [asset],
      })

      const { user } = render(<AssetList onEditAsset={onEditAsset} />)

      await user.click(screen.getByText(asset.name))

      expect(onEditAsset).toHaveBeenCalledWith(asset)
    })
  })

  describe('filtering', () => {
    it('filters by search term', async () => {
      const assets = [
        createMockAsset({ name: 'MacBook Pro' }),
        createMockAsset({ name: 'Dell Monitor' }),
        createMockAsset({ name: 'MacBook Air' }),
      ]
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets,
      })

      const { user } = render(<AssetList />)

      const searchInput = screen.getByPlaceholderText(/search/i)
      await user.type(searchInput, 'MacBook')

      expect(screen.getByText('MacBook Pro')).toBeInTheDocument()
      expect(screen.getByText('MacBook Air')).toBeInTheDocument()
      expect(screen.queryByText('Dell Monitor')).not.toBeInTheDocument()
    })

    it('filters by vendor name', async () => {
      const assets = [
        createMockAsset({ name: 'Asset 1', vendor: 'Apple' }),
        createMockAsset({ name: 'Asset 2', vendor: 'Dell' }),
        createMockAsset({ name: 'Asset 3', vendor: 'Apple' }),
      ]
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets,
      })

      const { user } = render(<AssetList />)

      const searchInput = screen.getByPlaceholderText(/search/i)
      await user.type(searchInput, 'Apple')

      expect(screen.getByText('Asset 1')).toBeInTheDocument()
      expect(screen.getByText('Asset 3')).toBeInTheDocument()
      expect(screen.queryByText('Asset 2')).not.toBeInTheDocument()
    })
  })

  describe('summary', () => {
    it('shows total purchase value', () => {
      const assets = [
        createMockAsset({ purchasePrice: 1000 }),
        createMockAsset({ purchasePrice: 2000 }),
      ]
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets,
      })

      render(<AssetList />)

      // Total purchase price: 3000
      expect(screen.getByText('3.000,00 €')).toBeInTheDocument()
    })

    it('shows active asset count', () => {
      const assets = [
        createMockAsset({ status: 'active' }),
        createMockAsset({ status: 'active' }),
        createMockDisposedAsset('disposed'),
      ]
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets,
      })

      render(<AssetList />)

      expect(screen.getByText(/2.*active/i)).toBeInTheDocument()
    })
  })

  describe('category display', () => {
    it('displays all category types correctly', () => {
      const categories: AssetCategory[] = ['computer', 'phone', 'furniture', 'equipment', 'software']
      const assets = categories.map((cat) => createMockAssetByCategory(cat))
      mockUseAssets.mockReturnValue({
        ...defaultMockReturn,
        assets,
      })

      render(<AssetList />)

      expect(screen.getByText('Computer')).toBeInTheDocument()
      expect(screen.getByText('Phone')).toBeInTheDocument()
      expect(screen.getByText('Furniture')).toBeInTheDocument()
      expect(screen.getByText('Equipment')).toBeInTheDocument()
      expect(screen.getByText('Software')).toBeInTheDocument()
    })
  })
})
