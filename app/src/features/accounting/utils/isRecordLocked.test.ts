import { describe, it, expect } from 'vitest'
import { isRecordLocked, getRecordLockReason } from './isRecordLocked'
import type { PeriodStatus } from '../hooks/usePeriodLocks'

describe('isRecordLocked', () => {
  const periods: PeriodStatus[] = [
    { key: '2024-01', type: 'month', locked: true, lock: { id: '1', period_type: 'month', period_key: '2024-01', locked_at: '2024-02-01', reason: 'USt-VA filed' } },
    { key: '2024-02', type: 'month', locked: false },
    { key: '2024-Q1', type: 'quarter', locked: false },
    { key: '2024-Q2', type: 'quarter', locked: true, lock: { id: '2', period_type: 'quarter', period_key: '2024-Q2', locked_at: '2024-07-01', reason: 'Quarter closed' } },
    { key: '2024', type: 'year', locked: false },
  ]

  it('returns true for a date in a locked month', () => {
    expect(isRecordLocked(new Date('2024-01-15'), periods)).toBe(true)
  })

  it('returns false for a date in an unlocked month', () => {
    expect(isRecordLocked(new Date('2024-02-15'), periods)).toBe(false)
  })

  it('returns true for a date in a locked quarter', () => {
    // April is in Q2
    expect(isRecordLocked(new Date('2024-04-15'), periods)).toBe(true)
    expect(isRecordLocked(new Date('2024-05-20'), periods)).toBe(true)
    expect(isRecordLocked(new Date('2024-06-30'), periods)).toBe(true)
  })

  it('returns false for a date in an unlocked quarter', () => {
    // March is Q1, which is unlocked (month 03 is also unlocked)
    expect(isRecordLocked(new Date('2024-03-15'), periods)).toBe(false)
  })

  it('handles string dates', () => {
    expect(isRecordLocked('2024-01-15', periods)).toBe(true)
    expect(isRecordLocked('2024-02-15', periods)).toBe(false)
  })

  it('handles invalid dates gracefully', () => {
    expect(isRecordLocked('not-a-date', periods)).toBe(false)
  })

  it('returns false with empty periods', () => {
    expect(isRecordLocked(new Date('2024-01-15'), [])).toBe(false)
  })

  it('checks year locks', () => {
    const yearLocked: PeriodStatus[] = [
      { key: '2023', type: 'year', locked: true, lock: { id: '3', period_type: 'year', period_key: '2023', locked_at: '2024-01-01', reason: 'Year closed' } },
    ]
    expect(isRecordLocked(new Date('2023-06-15'), yearLocked)).toBe(true)
    expect(isRecordLocked(new Date('2024-06-15'), yearLocked)).toBe(false)
  })
})

describe('getRecordLockReason', () => {
  const periods: PeriodStatus[] = [
    { key: '2024-01', type: 'month', locked: true, lock: { id: '1', period_type: 'month', period_key: '2024-01', locked_at: '2024-02-01', reason: 'USt-VA filed' } },
    { key: '2024-Q2', type: 'quarter', locked: true, lock: { id: '2', period_type: 'quarter', period_key: '2024-Q2', locked_at: '2024-07-01', reason: 'Quarter closed' } },
  ]

  it('returns the lock reason for a locked month', () => {
    expect(getRecordLockReason(new Date('2024-01-15'), periods)).toBe('USt-VA filed')
  })

  it('returns the lock reason for a locked quarter', () => {
    expect(getRecordLockReason(new Date('2024-04-15'), periods)).toBe('Quarter closed')
  })

  it('returns null for unlocked periods', () => {
    expect(getRecordLockReason(new Date('2024-03-15'), periods)).toBeNull()
  })

  it('returns null for invalid dates', () => {
    expect(getRecordLockReason('invalid', periods)).toBeNull()
  })
})
