/**
 * useBankAccounts Hook
 *
 * Manages bank account state: CRUD, sync, and loading states.
 */

import { useState, useCallback, useEffect } from 'react'
import {
  getBankAccounts,
  createBankAccount,
  syncBankAccount,
  deleteBankAccount,
} from '../api/banking'
import type { BankAccount } from '../api/banking'

export interface UseBankAccountsReturn {
  accounts: BankAccount[]
  isLoading: boolean
  error: string | null
  fetchAccounts: () => Promise<void>
  addAccount: (data: {
    bank_name: string
    iban: string
    bic?: string
    account_name?: string
    balance?: number
  }) => Promise<BankAccount | null>
  syncAccount: (
    accountId: string,
    transactions?: unknown[]
  ) => Promise<{ transactions_imported: number; duplicates_skipped: number } | null>
  removeAccount: (accountId: string) => Promise<boolean>
  totalBalance: number
  refresh: () => Promise<void>
}

export function useBankAccounts(): UseBankAccountsReturn {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getBankAccounts()
      setAccounts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Bankkonten')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addAccount = useCallback(
    async (data: {
      bank_name: string
      iban: string
      bic?: string
      account_name?: string
      balance?: number
    }): Promise<BankAccount | null> => {
      setError(null)
      try {
        const account = await createBankAccount(data)
        setAccounts((prev) => [...prev, account])
        return account
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Erstellen des Bankkontos')
        return null
      }
    },
    []
  )

  const syncAccount = useCallback(
    async (
      accountId: string,
      transactions?: unknown[]
    ): Promise<{ transactions_imported: number; duplicates_skipped: number } | null> => {
      setError(null)
      try {
        const result = await syncBankAccount(accountId, transactions)
        // Refresh accounts to get updated balances
        await fetchAccounts()
        return result
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler bei der Synchronisierung')
        return null
      }
    },
    [fetchAccounts]
  )

  const removeAccount = useCallback(async (accountId: string): Promise<boolean> => {
    setError(null)
    try {
      await deleteBankAccount(accountId)
      setAccounts((prev) => prev.filter((a) => a.id !== accountId))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen des Bankkontos')
      return false
    }
  }, [])

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0)

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  return {
    accounts,
    isLoading,
    error,
    fetchAccounts,
    addAccount,
    syncAccount,
    removeAccount,
    totalBalance,
    refresh: fetchAccounts,
  }
}
