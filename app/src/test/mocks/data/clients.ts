import type { Client } from '@/types'
import { generateTestId } from '@/test/utils/test-utils'

/**
 * Create a mock client with sensible defaults
 * @example
 * const client = createMockClient({ name: 'Acme Corp' })
 */
export function createMockClient(overrides: Partial<Client> = {}): Client {
  const id = overrides.id ?? generateTestId('client')
  const now = new Date().toISOString()

  return {
    id,
    name: 'Test Client',
    email: 'client@example.com',
    company: 'Test Company Inc.',
    contactInfo: '+1 555-0123',
    notes: 'Test client notes',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * Create multiple mock clients
 */
export function createMockClients(count: number, overrides: Partial<Client> = {}): Client[] {
  return Array.from({ length: count }, (_, index) =>
    createMockClient({
      name: `Test Client ${index + 1}`,
      email: `client${index + 1}@example.com`,
      ...overrides,
    })
  )
}
