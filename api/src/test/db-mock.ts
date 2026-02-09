/**
 * Shared mutable database reference for tests.
 *
 * vi.mock hoists the mock declaration, so we can't directly reference
 * a test-local variable. Instead, all test files import and use this
 * shared mutable container.
 */

import Database from 'better-sqlite3';

/** The current test database. Set by each test's beforeEach. */
export let currentTestDb: Database.Database | null = null;

/** Set the active test database */
export function setCurrentTestDb(db: Database.Database): void {
  currentTestDb = db;
}

/** Get the active test database (throws if not set) */
export function getCurrentTestDb(): Database.Database {
  if (!currentTestDb) {
    throw new Error('Test DB not initialized. Call setCurrentTestDb() in beforeEach.');
  }
  return currentTestDb;
}

/** Close the current test database */
export function closeCurrentTestDb(): void {
  if (currentTestDb) {
    currentTestDb.close();
    currentTestDb = null;
  }
}
