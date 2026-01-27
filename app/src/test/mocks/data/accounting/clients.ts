import type { Client, NewClient } from '@/features/accounting/types'
import { generateTestId } from '@/test/utils/test-utils'

/**
 * Create a mock client with sensible defaults
 * @example
 * const client = createMockAccountingClient({ name: 'Acme Corp' })
 * const euClient = createMockAccountingClient({ vatId: 'DE123456789' })
 */
export function createMockAccountingClient(overrides: Partial<Client> = {}): Client {
  const id = overrides.id ?? generateTestId('client')
  const now = new Date()

  return {
    id,
    name: 'Test Client GmbH',
    address: 'Musterstraße 123\n12345 Berlin\nGermany',
    vatId: 'DE123456789',
    email: 'contact@testclient.de',
    createdAt: now,
    ...overrides,
  }
}

/**
 * Create multiple mock clients
 */
export function createMockAccountingClients(count: number, overrides: Partial<Client> = {}): Client[] {
  const clientNames = [
    'Acme Corp GmbH',
    'Tech Solutions AG',
    'Digital Partners KG',
    'Innovation Labs UG',
    'Cloud Services GmbH',
    'Data Systems AG',
    'Web Agency Berlin',
    'Software House Munich',
    'IT Consulting Hamburg',
    'Startup Factory',
  ]

  return Array.from({ length: count }, (_, index) =>
    createMockAccountingClient({
      name: clientNames[index % clientNames.length],
      email: `contact@client${index + 1}.de`,
      vatId: `DE${String(100000000 + index).padStart(9, '0')}`,
      ...overrides,
    })
  )
}

/**
 * Create a mock client without VAT ID (for non-EU clients or B2C)
 */
export function createMockPrivateClient(overrides: Partial<Client> = {}): Client {
  return createMockAccountingClient({
    name: 'Max Mustermann',
    vatId: undefined,
    address: 'Privatstraße 1\n10115 Berlin',
    email: 'max@example.de',
    ...overrides,
  })
}

/**
 * Create a mock EU client (for reverse charge scenarios)
 */
export function createMockEuClient(country: string, overrides: Partial<Client> = {}): Client {
  const vatPrefixes: Record<string, string> = {
    AT: 'ATU',
    FR: 'FR',
    NL: 'NL',
    IT: 'IT',
    ES: 'ES',
    PL: 'PL',
    BE: 'BE',
  }

  const prefix = vatPrefixes[country] ?? country

  return createMockAccountingClient({
    name: `${country} Client Ltd`,
    vatId: `${prefix}${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
    address: `Business Street 1\n${country}`,
    email: `contact@client.${country.toLowerCase()}`,
    ...overrides,
  })
}

/**
 * Create new client data (for form submission)
 */
export function createNewMockAccountingClient(overrides: Partial<NewClient> = {}): NewClient {
  return {
    name: 'New Client GmbH',
    address: 'Neue Straße 1\n10115 Berlin',
    vatId: 'DE987654321',
    email: 'new@client.de',
    ...overrides,
  }
}
