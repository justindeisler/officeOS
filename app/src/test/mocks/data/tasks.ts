import type { Task, TaskStatus, TaskPriority, Area, Tag } from '@/types'
import { generateTestId } from '@/test/utils/test-utils'

/**
 * Create a mock task with sensible defaults
 * @example
 * const task = createMockTask({ title: 'My Task' })
 * const urgentTask = createMockTask({ priority: 1, status: 'in_progress' })
 */
export function createMockTask(overrides: Partial<Task> = {}): Task {
  const id = overrides.id ?? generateTestId('task')
  const now = new Date().toISOString()

  return {
    id,
    title: 'Test Task',
    description: 'A test task description',
    status: 'backlog' as TaskStatus,
    priority: 2 as TaskPriority,
    area: 'freelance' as Area,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * Create multiple mock tasks
 */
export function createMockTasks(count: number, overrides: Partial<Task> = {}): Task[] {
  return Array.from({ length: count }, (_, index) =>
    createMockTask({
      title: `Test Task ${index + 1}`,
      sortOrder: index,
      ...overrides,
    })
  )
}

/**
 * Create a mock task for each status (useful for Kanban board tests)
 */
export function createMockTasksByStatus(): Record<TaskStatus, Task> {
  const statuses: TaskStatus[] = ['backlog', 'queue', 'in_progress', 'done']
  return statuses.reduce(
    (acc, status) => ({
      ...acc,
      [status]: createMockTask({ status, title: `${status} Task` }),
    }),
    {} as Record<TaskStatus, Task>
  )
}

/**
 * Create a mock tag
 */
export function createMockTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: generateTestId('tag'),
    name: 'Test Tag',
    color: '#3b82f6',
    ...overrides,
  }
}
