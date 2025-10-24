/**
 * React Hook for Safe Transaction History
 *
 * Fetches transaction history from the blockchain on-demand (no automatic polling)
 */

import { useState, useEffect, useCallback } from 'react'
import { Transaction } from '@/lib/safeStorage'

interface UseSafeTransactionHistoryOptions {
  safeAddress: string | null
  userAddress: string | null
  chainId: number
  deploymentBlockNumber?: number
  enabled?: boolean // whether to fetch on mount
}

interface UseSafeTransactionHistoryResult {
  transactions: Transaction[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => Promise<void>
  lastUpdated: Date | null
}

export function useSafeTransactionHistory({
  safeAddress,
  userAddress,
  chainId,
  deploymentBlockNumber,
  enabled = true,
}: UseSafeTransactionHistoryOptions): UseSafeTransactionHistoryResult {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [hasMounted, setHasMounted] = useState(false)

  /**
   * Fetch transaction history from the API
   */
  const fetchTransactions = useCallback(async () => {
    if (!safeAddress || !userAddress) {
      setIsLoading(false)
      return
    }

    try {
      setIsError(false)
      setError(null)

      const params = new URLSearchParams({
        safeAddress,
        userAddress,
        chainId: chainId.toString(),
      })

      // Include deployment block number if available to optimize query
      if (deploymentBlockNumber) {
        params.append('fromBlock', deploymentBlockNumber.toString())
      }

      const response = await fetch(`/api/safe/transaction-history?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setTransactions(data.transactions || [])
      setLastUpdated(new Date())
      console.log(`✅ Fetched ${data.transactions?.length || 0} transactions from blockchain`)
    } catch (err) {
      console.error('Error fetching transaction history:', err)
      setIsError(true)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setIsLoading(false)
    }
  }, [safeAddress, userAddress, chainId, deploymentBlockNumber])

  /**
   * Track if component has mounted (fixes hydration issues)
   */
  useEffect(() => {
    setHasMounted(true)
  }, [])

  /**
   * Initial fetch on mount (no polling)
   */
  useEffect(() => {
    if (!hasMounted || !enabled || !safeAddress || !userAddress) {
      return
    }

    // Fetch once on mount
    setIsLoading(true)
    fetchTransactions()
  }, [hasMounted, enabled, safeAddress, userAddress, fetchTransactions])

  return {
    transactions,
    isLoading,
    isError,
    error,
    refetch: fetchTransactions,
    lastUpdated,
  }
}
