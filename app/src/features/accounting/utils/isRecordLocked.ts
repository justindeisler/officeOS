/**
 * Period Lock Utility
 *
 * Determines whether a financial record falls within a locked period.
 * Used by IncomeList, ExpenseList, InvoiceList, and forms to show
 * lock indicators and disable editing.
 */

import type { PeriodStatus } from '../hooks/usePeriodLocks'

/**
 * Check if a record's date falls within any locked period.
 *
 * @param date - The record date
 * @param periods - The period status list from usePeriodLocks
 * @returns true if the record is in a locked period
 */
export function isRecordLocked(date: Date | string, periods: PeriodStatus[]): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return false

  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const quarter = Math.ceil(month / 3)

  // Check month lock
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  if (periods.some(p => p.key === monthKey && p.locked)) return true

  // Check quarter lock
  const quarterKey = `${year}-Q${quarter}`
  if (periods.some(p => p.key === quarterKey && p.locked)) return true

  // Check year lock
  const yearKey = String(year)
  if (periods.some(p => p.key === yearKey && p.locked)) return true

  return false
}

/**
 * Get the lock reason for a record's date if locked.
 */
export function getRecordLockReason(date: Date | string, periods: PeriodStatus[]): string | null {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return null

  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const quarter = Math.ceil(month / 3)

  // Check from most specific to least specific
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const monthLock = periods.find(p => p.key === monthKey && p.locked)
  if (monthLock?.lock?.reason) return monthLock.lock.reason

  const quarterKey = `${year}-Q${quarter}`
  const quarterLock = periods.find(p => p.key === quarterKey && p.locked)
  if (quarterLock?.lock?.reason) return quarterLock.lock.reason

  const yearKey = String(year)
  const yearLock = periods.find(p => p.key === yearKey && p.locked)
  if (yearLock?.lock?.reason) return yearLock.lock.reason

  return null
}

export default isRecordLocked
