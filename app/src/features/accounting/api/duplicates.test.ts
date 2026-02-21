import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the accountingClient
const mockGet = vi.fn()
const mockPost = vi.fn()

vi.mock('@/api', () => ({
  accountingClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
}))

import {
  checkForDuplicates,
  checkForDuplicatesByFields,
  markAsDuplicate,
  unmarkDuplicate,
  listMarkedDuplicates,
} from './duplicates'

const mockCandidate = {
  id: 'dup-1',
  type: 'expense' as const,
  amount: 100,
  date: '2024-03-15',
  partner: 'Test Vendor',
  description: 'Test expense',
  similarity_score: 0.9,
  matched_fields: ['amount', 'date', 'vendor'],
}

describe('duplicates API client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkForDuplicates', () => {
    it('calls GET /duplicates/check/:type/:recordId', async () => {
      mockGet.mockResolvedValue({
        record_id: 'rec-1',
        type: 'expense',
        duplicates: [mockCandidate],
        has_duplicates: true,
      })

      const result = await checkForDuplicates('expense', 'rec-1')

      expect(mockGet).toHaveBeenCalledWith('/duplicates/check/expense/rec-1')
      expect(result).toEqual([mockCandidate])
    })

    it('returns empty array when no duplicates', async () => {
      mockGet.mockResolvedValue({
        record_id: 'rec-1',
        type: 'expense',
        duplicates: [],
        has_duplicates: false,
      })

      const result = await checkForDuplicates('expense', 'rec-1')
      expect(result).toEqual([])
    })
  })

  describe('checkForDuplicatesByFields', () => {
    it('calls GET with query params', async () => {
      mockGet.mockResolvedValue({
        record_id: 'new',
        type: 'expense',
        duplicates: [mockCandidate],
        has_duplicates: true,
      })

      const result = await checkForDuplicatesByFields(
        'expense', 100, '2024-03-15', 'Test Vendor',
      )

      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('/duplicates/check/expense/new?'),
      )
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('amount=100'),
      )
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('date=2024-03-15'),
      )
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining('partner=Test+Vendor'),
      )
      expect(result).toEqual([mockCandidate])
    })
  })

  describe('markAsDuplicate', () => {
    it('calls POST /duplicates/mark with correct body', async () => {
      mockPost.mockResolvedValue({ success: true })

      await markAsDuplicate('expense', 'rec-1', 'rec-2')

      expect(mockPost).toHaveBeenCalledWith('/duplicates/mark', {
        type: 'expense',
        recordId: 'rec-1',
        duplicateOfId: 'rec-2',
      })
    })
  })

  describe('unmarkDuplicate', () => {
    it('calls POST /duplicates/unmark with correct body', async () => {
      mockPost.mockResolvedValue({ success: true })

      await unmarkDuplicate('expense', 'rec-1')

      expect(mockPost).toHaveBeenCalledWith('/duplicates/unmark', {
        type: 'expense',
        recordId: 'rec-1',
      })
    })
  })

  describe('listMarkedDuplicates', () => {
    const mockMarkedDuplicate = {
      id: 'dup-1',
      type: 'expense' as const,
      amount: 100,
      date: '2024-03-15',
      partner: 'Test Vendor',
      description: 'Test',
      duplicate_of_id: 'orig-1',
    }

    it('calls GET /duplicates/list without filter', async () => {
      mockGet.mockResolvedValue({
        duplicates: [mockMarkedDuplicate],
        total: 1,
      })

      const result = await listMarkedDuplicates()

      expect(mockGet).toHaveBeenCalledWith('/duplicates/list')
      expect(result).toEqual([mockMarkedDuplicate])
    })

    it('calls GET /duplicates/list?type=expense with filter', async () => {
      mockGet.mockResolvedValue({
        duplicates: [mockMarkedDuplicate],
        total: 1,
      })

      const result = await listMarkedDuplicates('expense')

      expect(mockGet).toHaveBeenCalledWith('/duplicates/list?type=expense')
      expect(result).toEqual([mockMarkedDuplicate])
    })

    it('calls GET /duplicates/list?type=income with income filter', async () => {
      mockGet.mockResolvedValue({
        duplicates: [],
        total: 0,
      })

      const result = await listMarkedDuplicates('income')

      expect(mockGet).toHaveBeenCalledWith('/duplicates/list?type=income')
      expect(result).toEqual([])
    })
  })
})
