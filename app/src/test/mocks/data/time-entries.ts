import type { TimeEntry, TimeCategory } from '@/types'
import { generateTestId } from '@/test/utils/test-utils'

/**
 * Create a mock time entry with sensible defaults
 * @example
 * const entry = createMockTimeEntry({ category: 'coding' })
 * const runningEntry = createMockTimeEntry({ isRunning: true })
 */
export function createMockTimeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  const id = overrides.id ?? generateTestId('time')
  const now = new Date()
  const startTime = overrides.startTime ?? now.toISOString()

  return {
    id,
    category: 'coding' as TimeCategory,
    description: 'Test time entry',
    startTime,
    endTime: overrides.isRunning ? undefined : new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    durationMinutes: overrides.isRunning ? undefined : 60,
    isRunning: false,
    createdAt: startTime,
    ...overrides,
  }
}

/**
 * Create multiple mock time entries
 */
export function createMockTimeEntries(count: number, overrides: Partial<TimeEntry> = {}): TimeEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createMockTimeEntry({
      description: `Time entry ${index + 1}`,
      ...overrides,
    })
  )
}

/**
 * Create a running time entry (no end time)
 */
export function createMockRunningTimeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return createMockTimeEntry({
    isRunning: true,
    endTime: undefined,
    durationMinutes: undefined,
    ...overrides,
  })
}
