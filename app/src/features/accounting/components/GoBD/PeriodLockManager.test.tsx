import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import { PeriodLockManager } from './PeriodLockManager'

const mockGetPeriodLocks = vi.fn()

// Mock api module
vi.mock('@/lib/api', () => ({
  api: {
    getPeriodLocks: (...args: unknown[]) => mockGetPeriodLocks(...args),
    lockPeriod: vi.fn(),
    unlockPeriod: vi.fn(),
  },
}))

describe('PeriodLockManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetPeriodLocks.mockResolvedValue({
      locks: [],
      periods: [
        { key: '2025-01', type: 'month', locked: false },
        { key: '2025-02', type: 'month', locked: true, lock: { id: '1', period_type: 'month', period_key: '2025-01', locked_at: '2025-02-01', reason: 'Filed' } },
        { key: '2025-03', type: 'month', locked: false },
        { key: '2025-04', type: 'month', locked: false },
        { key: '2025-05', type: 'month', locked: false },
        { key: '2025-06', type: 'month', locked: false },
        { key: '2025-07', type: 'month', locked: false },
        { key: '2025-08', type: 'month', locked: false },
        { key: '2025-09', type: 'month', locked: false },
        { key: '2025-10', type: 'month', locked: false },
        { key: '2025-11', type: 'month', locked: false },
        { key: '2025-12', type: 'month', locked: false },
        { key: '2025-Q1', type: 'quarter', locked: false },
        { key: '2025-Q2', type: 'quarter', locked: false },
        { key: '2025-Q3', type: 'quarter', locked: false },
        { key: '2025-Q4', type: 'quarter', locked: false },
        { key: '2025', type: 'year', locked: false },
      ],
    })
  })

  it('renders the title', async () => {
    render(<PeriodLockManager />)
    await waitFor(() => {
      expect(screen.getByText('Zeiträume sperren')).toBeInTheDocument()
    })
  })

  it('renders month grid', async () => {
    render(<PeriodLockManager />)
    await waitFor(() => {
      expect(screen.getByText('Monate')).toBeInTheDocument()
      expect(screen.getByText('Jan')).toBeInTheDocument()
      expect(screen.getByText('Dez')).toBeInTheDocument()
    })
  })

  it('renders quarter section', async () => {
    render(<PeriodLockManager />)
    await waitFor(() => {
      expect(screen.getByText('Quartale')).toBeInTheDocument()
      expect(screen.getByText('Q1')).toBeInTheDocument()
      expect(screen.getByText('Q4')).toBeInTheDocument()
    })
  })

  it('renders year section', async () => {
    render(<PeriodLockManager />)
    await waitFor(() => {
      expect(screen.getByText('Geschäftsjahr')).toBeInTheDocument()
    })
  })

  it('renders legend', async () => {
    render(<PeriodLockManager />)
    await waitFor(() => {
      // Legend items appear along with badges, so use getAllByText
      expect(screen.getAllByText('Offen').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Gesperrt').length).toBeGreaterThan(0)
      expect(screen.getByText('Zukünftig')).toBeInTheDocument()
    })
  })
})
