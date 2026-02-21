import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/utils'
import { AuditLog } from './AuditLog'

const mockSearchAudit = vi.fn()
const mockGetAuditLog = vi.fn()

// Mock api module
vi.mock('@/lib/api', () => ({
  api: {
    searchAudit: (...args: unknown[]) => mockSearchAudit(...args),
    getAuditLog: (...args: unknown[]) => mockGetAuditLog(...args),
  },
}))

describe('AuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchAudit.mockResolvedValue({ entries: [], total: 0, limit: 50, offset: 0 })
    mockGetAuditLog.mockResolvedValue([])
  })

  it('renders the title in standalone mode', async () => {
    render(<AuditLog />)
    await waitFor(() => {
      expect(screen.getByText('Audit-Log')).toBeInTheDocument()
    })
  })

  it('shows empty state when no entries', async () => {
    render(<AuditLog />)
    await waitFor(() => {
      expect(screen.getByText(/Keine Audit-Einträge/)).toBeInTheDocument()
    })
  })

  it('renders entries from entity-specific query', async () => {
    mockGetAuditLog.mockResolvedValue([
      {
        id: 'audit-1',
        entity_type: 'income',
        entity_id: 'inc-1',
        action: 'create',
        timestamp: '2024-06-15T10:00:00Z',
        user_id: 'admin',
      },
    ])

    render(<AuditLog entityType="income" entityId="inc-1" />)

    await waitFor(() => {
      expect(screen.getByText('Erstellt')).toBeInTheDocument()
    })
  })

  it('renders filter controls in search mode', async () => {
    render(<AuditLog />)
    await waitFor(() => {
      expect(screen.getByText('Typ')).toBeInTheDocument()
      expect(screen.getByText('Aktion')).toBeInTheDocument()
    })
  })

  it('hides title in embedded mode', async () => {
    render(<AuditLog embedded />)
    await waitFor(() => {
      expect(screen.queryByText('Audit-Log')).not.toBeInTheDocument()
    })
  })
})
