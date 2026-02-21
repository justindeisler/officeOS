import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@/test/utils'
import { DuplicateAlert, type DuplicateAlertProps } from './DuplicateAlert'
import type { DuplicateCandidate } from '../../api/duplicates'

const mockDuplicates: DuplicateCandidate[] = [
  {
    id: 'dup-1',
    type: 'expense',
    amount: 199.99,
    date: '2024-03-15',
    partner: 'Adobe Systems',
    description: 'Creative Cloud',
    similarity_score: 0.95,
    matched_fields: ['amount', 'date', 'vendor'],
  },
  {
    id: 'dup-2',
    type: 'expense',
    amount: 199.99,
    date: '2024-03-14',
    partner: 'Adobe Inc',
    description: 'Creative Cloud License',
    similarity_score: 0.82,
    matched_fields: ['amount', 'date'],
  },
  {
    id: 'dup-3',
    type: 'expense',
    amount: 199.99,
    date: '2024-03-16',
    partner: 'Adobe',
    description: 'CC Subscription',
    similarity_score: 0.68,
    matched_fields: ['amount'],
  },
]

describe('DuplicateAlert', () => {
  const mockOnIgnore = vi.fn()
  const mockOnView = vi.fn()

  const defaultProps: DuplicateAlertProps = {
    type: 'expense',
    duplicates: mockDuplicates,
    onIgnore: mockOnIgnore,
    onView: mockOnView,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders nothing when no duplicates', () => {
      const { container } = render(
        <DuplicateAlert {...defaultProps} duplicates={[]} />,
      )
      expect(container.innerHTML).toBe('')
    })

    it('renders alert when duplicates exist', () => {
      render(<DuplicateAlert {...defaultProps} />)
      expect(screen.getByTestId('duplicate-alert')).toBeInTheDocument()
    })

    it('renders correct title for single duplicate', () => {
      render(<DuplicateAlert {...defaultProps} duplicates={[mockDuplicates[0]]} />)
      expect(screen.getByText('Possible duplicate detected')).toBeInTheDocument()
    })

    it('renders correct title for multiple duplicates', () => {
      render(<DuplicateAlert {...defaultProps} />)
      expect(screen.getByText('3 possible duplicates detected')).toBeInTheDocument()
    })

    it('renders all duplicate candidates', () => {
      render(<DuplicateAlert {...defaultProps} />)
      const candidates = screen.getAllByTestId('duplicate-candidate')
      expect(candidates).toHaveLength(3)
    })

    it('shows partner name, amount and date for each candidate', () => {
      render(<DuplicateAlert {...defaultProps} />)
      expect(screen.getByText(/Adobe Systems/)).toBeInTheDocument()
      // All 3 candidates have 199.99 so we expect 3 matches
      expect(screen.getAllByText(/199,99/)).toHaveLength(3)
    })

    it('shows similarity score as percentage', () => {
      render(<DuplicateAlert {...defaultProps} />)
      expect(screen.getByText(/95% match/)).toBeInTheDocument()
      expect(screen.getByText(/82% match/)).toBeInTheDocument()
      expect(screen.getByText(/68% match/)).toBeInTheDocument()
    })

    it('renders View button for each candidate', () => {
      render(<DuplicateAlert {...defaultProps} />)
      const viewButtons = screen.getAllByText('View')
      expect(viewButtons).toHaveLength(3)
    })

    it('renders Not a duplicate button', () => {
      render(<DuplicateAlert {...defaultProps} />)
      expect(screen.getByTestId('dismiss-duplicates')).toBeInTheDocument()
      expect(screen.getByText('Not a duplicate')).toBeInTheDocument()
    })

    it('has role=alert for accessibility', () => {
      render(<DuplicateAlert {...defaultProps} />)
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows checking spinner when isChecking and no duplicates', () => {
      render(
        <DuplicateAlert {...defaultProps} duplicates={[]} isChecking={true} />,
      )
      expect(screen.getByTestId('duplicate-checking')).toBeInTheDocument()
      expect(screen.getByText('Checking for duplicates...')).toBeInTheDocument()
    })

    it('shows duplicates even when still checking', () => {
      render(
        <DuplicateAlert {...defaultProps} isChecking={true} />,
      )
      expect(screen.getByTestId('duplicate-alert')).toBeInTheDocument()
      expect(screen.getAllByTestId('duplicate-candidate')).toHaveLength(3)
    })
  })

  describe('interactions', () => {
    it('calls onIgnore when dismiss button clicked', async () => {
      const { user } = render(<DuplicateAlert {...defaultProps} />)
      await user.click(screen.getByTestId('dismiss-duplicates'))
      expect(mockOnIgnore).toHaveBeenCalledTimes(1)
    })

    it('calls onView with correct ID when View button clicked', async () => {
      const { user } = render(<DuplicateAlert {...defaultProps} />)
      await user.click(screen.getByTestId('view-duplicate-dup-1'))
      expect(mockOnView).toHaveBeenCalledWith('dup-1')
    })

    it('calls onView with correct ID for different candidates', async () => {
      const { user } = render(<DuplicateAlert {...defaultProps} />)
      await user.click(screen.getByTestId('view-duplicate-dup-2'))
      expect(mockOnView).toHaveBeenCalledWith('dup-2')
    })
  })

  describe('income type', () => {
    it('renders correctly for income type', () => {
      const incDuplicates: DuplicateCandidate[] = [
        {
          id: 'inc-dup-1',
          type: 'income',
          amount: 5000,
          date: '2024-03-15',
          partner: 'Client XYZ',
          description: 'Consulting services',
          similarity_score: 0.90,
          matched_fields: ['amount', 'date', 'client'],
        },
      ]
      render(
        <DuplicateAlert
          {...defaultProps}
          type="income"
          duplicates={incDuplicates}
        />,
      )
      expect(screen.getByText(/Client XYZ/)).toBeInTheDocument()
      expect(screen.getByText(/90% match/)).toBeInTheDocument()
    })
  })
})
