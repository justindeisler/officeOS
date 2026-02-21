import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import { ElsterHistoryList } from './ElsterHistoryList'

const mockGetElsterSubmissions = vi.fn()

// Mock api module
vi.mock('@/lib/api', () => ({
  api: {
    getElsterSubmissions: (...args: unknown[]) => mockGetElsterSubmissions(...args),
  },
}))

describe('ElsterHistoryList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetElsterSubmissions.mockResolvedValue([])
  })

  it('renders the title', () => {
    render(<ElsterHistoryList />)
    expect(screen.getByText('ELSTER-Verlauf')).toBeInTheDocument()
  })

  it('renders filter selectors', () => {
    render(<ElsterHistoryList />)
    expect(screen.getByText('Typ:')).toBeInTheDocument()
    expect(screen.getByText('Jahr:')).toBeInTheDocument()
  })

  it('shows empty state when no submissions', async () => {
    render(<ElsterHistoryList />)
    await waitFor(() => {
      expect(screen.getByText(/Keine ELSTER-Übermittlungen/)).toBeInTheDocument()
    })
  })

  it('shows submissions in table', async () => {
    mockGetElsterSubmissions.mockResolvedValue([
      {
        id: 'sub-1',
        type: 'ust_va',
        period_key: '2024-Q1',
        status: 'submitted',
        xml: '<xml/>',
        tax_data: '{}',
        test_mode: false,
        transfer_ticket: 'et12345',
        created_at: '2024-04-15T10:00:00Z',
        updated_at: '2024-04-15T10:00:00Z',
      },
    ])

    render(<ElsterHistoryList />)

    await waitFor(() => {
      expect(screen.getByText('USt-VA')).toBeInTheDocument()
      expect(screen.getByText('2024-Q1')).toBeInTheDocument()
      expect(screen.getByText('Übermittelt')).toBeInTheDocument()
      expect(screen.getByText('et12345')).toBeInTheDocument()
    })
  })
})
