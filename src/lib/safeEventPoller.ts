/**
 * Safe Transaction History - Queries from Blockscout API
 *
 * Uses Blockscout block explorer API to fetch ALL transactions (incoming + outgoing)
 * instead of querying RPC for ExecutionSuccess events.
 */

import { Transaction } from './safeStorage'

export interface SafeTransactionEvent {
  blockNumber: number
  blockTimestamp: number
  transactionHash: string
  to: string
  value: string
  from: string
  operation: number
  safeTxHash: string
  payment: string
}

/**
 * Query ALL transactions (incoming + outgoing) using Blockscout API
 * Uses both regular transactions AND internal transactions
 */
export async function querySafeTransactionsFromBlockscout(
  safeAddress: string,
  chainId: number
): Promise<SafeTransactionEvent[]> {
  try {
    const blockscoutUrl = 'https://gnosis-chiado.blockscout.com/api'
    const EURO_TOKEN_ADDRESS = '0xfD988C187183FCb484f93a360BaA99e45B48c7Fb'

    // Fetch ERC-20 token transfers (EUR token)
    const tokenTxUrl = `${blockscoutUrl}?module=account&action=tokentx&address=${safeAddress}&contractaddress=${EURO_TOKEN_ADDRESS}&sort=desc`
    console.log(`🔍 Querying Blockscout for EUR token transfers for ${safeAddress}`)

    const tokenResponse = await fetch(tokenTxUrl)
    const tokenData = await tokenResponse.json()

    // Fetch regular transactions (for native currency - kept for compatibility)
    const txListUrl = `${blockscoutUrl}?module=account&action=txlist&address=${safeAddress}&sort=desc`
    console.log(`🔍 Querying Blockscout for regular transactions for ${safeAddress}`)

    const txResponse = await fetch(txListUrl)
    const txData = await txResponse.json()

    // Fetch internal transactions (where Safe transfers value)
    const internalTxUrl = `${blockscoutUrl}?module=account&action=txlistinternal&address=${safeAddress}&sort=desc`
    console.log(`🔍 Querying Blockscout for internal transactions for ${safeAddress}`)

    const internalResponse = await fetch(internalTxUrl)
    const internalData = await internalResponse.json()

    const transactions: SafeTransactionEvent[] = []
    const incomingTxHashes = new Set<string>() // Track incoming transaction hashes

    // Process ERC-20 token transfers FIRST (these are what we care about now)
    if (tokenData.status === '1' && tokenData.result) {
      console.log(`   Found ${tokenData.result.length} EUR token transfers`)

      const tokenTxs = tokenData.result
        .filter((tx: any) => tx.value !== '0')
        .map((tx: any) => ({
          blockNumber: parseInt(tx.blockNumber, 10),
          blockTimestamp: parseInt(tx.timeStamp, 10),
          transactionHash: tx.hash,
          to: tx.to || '',
          value: tx.value,
          from: tx.from,
          operation: 0,
          safeTxHash: tx.hash,
          payment: '0',
        }))

      console.log(`   Added ${tokenTxs.length} EUR token transfers to history`)
      transactions.push(...tokenTxs)

      // Track token transfer hashes to avoid duplicates
      tokenTxs.forEach((tx: SafeTransactionEvent) => {
        if (tx.to.toLowerCase() === safeAddress.toLowerCase()) {
          incomingTxHashes.add(tx.transactionHash)
        }
      })
    }

    // Process regular transactions (incoming payments TO the Safe)
    if (txData.status === '1' && txData.result) {
      console.log(`   Found ${txData.result.length} regular transactions`)

      const regularTxs = txData.result
        .filter(
          (tx: any) =>
            tx.value !== '0' &&
            tx.to?.toLowerCase() === safeAddress.toLowerCase() &&
            tx.from?.toLowerCase() !== safeAddress.toLowerCase() // Not from itself
        )
        .map((tx: any) => {
          incomingTxHashes.add(tx.hash) // Track this incoming transaction
          return {
            blockNumber: parseInt(tx.blockNumber, 10),
            blockTimestamp: parseInt(tx.timeStamp, 10),
            transactionHash: tx.hash,
            to: tx.to || '',
            value: tx.value,
            from: tx.from,
            operation: 0,
            safeTxHash: tx.hash,
            payment: '0',
          }
        })

      console.log(`   Filtered to ${regularTxs.length} incoming transactions`)
      transactions.push(...regularTxs)
    }

    // Process internal transactions (can be both incoming AND outgoing)
    if (internalData.status === '1' && internalData.result) {
      console.log(`   Found ${internalData.result.length} internal transactions`)

      const internalTxs = internalData.result
        .filter((tx: any) => tx.value !== '0') // Has value
        .map((tx: any) => ({
          blockNumber: parseInt(tx.blockNumber, 10),
          blockTimestamp: parseInt(tx.timeStamp, 10),
          transactionHash: tx.transactionHash || tx.hash, // Try both field names
          to: tx.to || '',
          value: tx.value,
          from: tx.from,
          operation: 0,
          safeTxHash: tx.transactionHash || tx.hash,
          payment: '0',
        }))

      // Split into incoming and outgoing
      // For self-transfers, only count as outgoing (to avoid showing duplicate)
      const internalIncoming = internalTxs.filter(
        (tx: SafeTransactionEvent) =>
          tx.to.toLowerCase() === safeAddress.toLowerCase() &&
          tx.from.toLowerCase() !== safeAddress.toLowerCase() // Exclude self-transfers
      )

      // Also add internal incoming hashes to the set to prevent duplicates
      internalIncoming.forEach((tx: SafeTransactionEvent) =>
        incomingTxHashes.add(tx.transactionHash)
      )

      // Filter outgoing: exclude transactions that are already counted as incoming
      const internalOutgoing = internalTxs.filter(
        (tx: SafeTransactionEvent) =>
          tx.from.toLowerCase() === safeAddress.toLowerCase() &&
          !incomingTxHashes.has(tx.transactionHash) // Exclude if already in incoming regular txs
      )

      console.log(
        `   Filtered to ${internalIncoming.length} incoming internal transactions (excl. self-transfers)`
      )
      console.log(
        `   Filtered to ${internalOutgoing.length} outgoing internal transactions (incl. self-transfers)`
      )

      transactions.push(...internalIncoming, ...internalOutgoing)
    }

    // Deduplicate transactions by hash + value only
    // The same blockchain transaction should only appear once in history
    const uniqueTransactions = transactions.filter((tx, index, self) => {
      // Find all transactions with same hash and value
      const duplicates = self.filter(
        t => t.transactionHash === tx.transactionHash && t.value === tx.value
      )

      if (duplicates.length === 1) {
        // No duplicates, keep it
        return true
      }

      // Multiple entries exist - determine which to keep
      const isSafeFrom = tx.from.toLowerCase() === safeAddress.toLowerCase()
      const isSafeTo = tx.to.toLowerCase() === safeAddress.toLowerCase()

      // Priority rules:
      // 1. For transactions where Safe is sender (from), keep that version
      // 2. For transactions where Safe is receiver (to), keep that version
      // 3. Otherwise keep first occurrence

      if (isSafeFrom) {
        // Keep the version where Safe is the sender
        return (
          index ===
          self.findIndex(
            t =>
              t.transactionHash === tx.transactionHash &&
              t.value === tx.value &&
              t.from.toLowerCase() === safeAddress.toLowerCase()
          )
        )
      } else if (isSafeTo) {
        // Keep the version where Safe is the receiver
        return (
          index ===
          self.findIndex(
            t =>
              t.transactionHash === tx.transactionHash &&
              t.value === tx.value &&
              t.to.toLowerCase() === safeAddress.toLowerCase()
          )
        )
      } else {
        // Neither from nor to is Safe - keep first occurrence
        return (
          index ===
          self.findIndex(t => t.transactionHash === tx.transactionHash && t.value === tx.value)
        )
      }
    })

    console.log(`   Total transactions: ${transactions.length}`)
    console.log(`   After deduplication: ${uniqueTransactions.length}`)

    return uniqueTransactions
  } catch (error) {
    console.error('Error querying Blockscout:', error)
    throw error
  }
}

/**
 * Transform blockchain event to Transaction interface
 * Direction is determined by whether Safe is the sender (outgoing) or receiver (incoming)
 * For self-transfers (Safe -> Safe), mark with isSelfTransfer flag
 */
export function transformEventToTransaction(
  event: SafeTransactionEvent,
  safeAddress: string,
  userAddress: string
): Transaction {
  const isOutgoing = event.from.toLowerCase() === safeAddress.toLowerCase()
  const isIncoming = event.to.toLowerCase() === safeAddress.toLowerCase()
  const isSelfTransfer = isOutgoing && isIncoming

  return {
    txId: event.safeTxHash,
    txHash: event.transactionHash,
    from: event.from, // Keep original from address
    to: event.to, // Keep original to address
    amount: event.value,
    timestamp: event.blockTimestamp * 1000, // Convert to milliseconds
    status: 'confirmed', // Blockscout only returns confirmed transactions
    direction: isOutgoing ? 'outgoing' : 'incoming',
    isSelfTransfer,
  }
}

/**
 * Fetch and transform Safe transaction history from Blockscout
 */
export async function fetchSafeTransactionHistory(
  rpcUrl: string,
  safeAddress: string,
  userAddress: string,
  fromBlock: number,
  toBlock?: number | 'latest',
  chainId: number = 10200
): Promise<Transaction[]> {
  // Query all transactions from Blockscout (ignoring fromBlock/toBlock for now)
  const events = await querySafeTransactionsFromBlockscout(safeAddress, chainId)

  // Transform to Transaction format
  const transactions = events.map(event =>
    transformEventToTransaction(event, safeAddress, userAddress)
  )

  // Sort by timestamp descending (most recent first)
  transactions.sort((a, b) => b.timestamp - a.timestamp)

  return transactions
}
