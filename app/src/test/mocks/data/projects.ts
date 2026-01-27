import type { Project, ProjectStatus, Area } from '@/types'
import { generateTestId } from '@/test/utils/test-utils'

/**
 * Create a mock project with sensible defaults
 * @example
 * const project = createMockProject({ name: 'Website Redesign' })
 */
export function createMockProject(overrides: Partial<Project> = {}): Project {
  const id = overrides.id ?? generateTestId('project')
  const now = new Date().toISOString()

  return {
    id,
    name: 'Test Project',
    description: 'A test project description',
    status: 'active' as ProjectStatus,
    budgetAmount: 5000,
    budgetCurrency: 'EUR',
    area: 'freelance' as Area,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * Create multiple mock projects
 */
export function createMockProjects(count: number, overrides: Partial<Project> = {}): Project[] {
  return Array.from({ length: count }, (_, index) =>
    createMockProject({
      name: `Test Project ${index + 1}`,
      ...overrides,
    })
  )
}

/**
 * Create a mock project for each status (useful for pipeline tests)
 */
export function createMockProjectsByStatus(): Record<ProjectStatus, Project> {
  const statuses: ProjectStatus[] = ['pipeline', 'active', 'on_hold', 'completed', 'cancelled']
  return statuses.reduce(
    (acc, status) => ({
      ...acc,
      [status]: createMockProject({ status, name: `${status} Project` }),
    }),
    {} as Record<ProjectStatus, Project>
  )
}
