import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getExpenseSuggestions,
  getIncomeSuggestions,
  getInvoiceSuggestions,
  getNextInvoiceNumber,
} from './suggestions'

// Mock the centralized API client
vi.mock('@/api', () => ({
  accountingClient: {
    request: vi.fn(),
  },
}))

import { accountingClient } from '@/api'

const mockRequest = vi.mocked(accountingClient.request)

describe('Suggestions API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getExpenseSuggestions', () => {
    it('fetches without vendor parameter', async () => {
      const mockResponse = {
        recentVendors: [{ vendor: 'Test', count: 5, lastAmount: 100 }],
      }
      mockRequest.mockResolvedValue(mockResponse)

      const result = await getExpenseSuggestions()

      expect(mockRequest).toHaveBeenCalledWith('/smart-suggestions/expense')
      expect(result).toEqual(mockResponse)
    })

    it('fetches with vendor parameter', async () => {
      mockRequest.mockResolvedValue({ suggestedCategory: 'telecom' })

      await getExpenseSuggestions('Deutsche Telekom')

      expect(mockRequest).toHaveBeenCalledWith(
        '/smart-suggestions/expense?vendor=Deutsche%20Telekom'
      )
    })

    it('encodes special characters in vendor name', async () => {
      mockRequest.mockResolvedValue({})

      await getExpenseSuggestions('A&B Company')

      expect(mockRequest).toHaveBeenCalledWith(
        '/smart-suggestions/expense?vendor=A%26B%20Company'
      )
    })
  })

  describe('getIncomeSuggestions', () => {
    it('fetches income suggestions', async () => {
      const mockResponse = {
        recentClients: [{ client: 'Acme', count: 3, lastAmount: 5000 }],
      }
      mockRequest.mockResolvedValue(mockResponse)

      const result = await getIncomeSuggestions()

      expect(mockRequest).toHaveBeenCalledWith('/smart-suggestions/income')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getInvoiceSuggestions', () => {
    it('fetches without clientId', async () => {
      mockRequest.mockResolvedValue({ nextInvoiceNumber: 'RE-2026-001' })

      await getInvoiceSuggestions()

      expect(mockRequest).toHaveBeenCalledWith('/smart-suggestions/invoice')
    })

    it('fetches with clientId', async () => {
      mockRequest.mockResolvedValue({
        nextInvoiceNumber: 'RE-2026-001',
        suggestedPaymentTerms: 30,
      })

      await getInvoiceSuggestions('client-123')

      expect(mockRequest).toHaveBeenCalledWith(
        '/smart-suggestions/invoice?clientId=client-123'
      )
    })
  })

  describe('getNextInvoiceNumber', () => {
    it('fetches and unwraps the invoice number', async () => {
      mockRequest.mockResolvedValue({ nextInvoiceNumber: 'RE-2026-003' })

      const result = await getNextInvoiceNumber()

      expect(mockRequest).toHaveBeenCalledWith('/smart-suggestions/invoice-number')
      expect(result).toBe('RE-2026-003')
    })
  })
})
