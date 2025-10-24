/**
 * Safe Storage - Hybrid approach using localStorage + API backup
 * Stores Safe deployment data, session keys, and transaction history
 */

export interface SessionKey {
  keyAddress: string
  createdAt: string
  expiresAt: string
  permissions: {
    spendingLimit: string // in wei
    allowedTokens: string[] // token addresses
    validAfter: number // timestamp
    validUntil: number // timestamp
  }
  isActive: boolean
}

export interface Transaction {
  txId: string
  txHash?: string
  from: string
  to: string
  amount: string // in wei
  timestamp: number
  status: 'pending' | 'verified' | 'confirmed'
  direction: 'incoming' | 'outgoing'
  duration?: number // time to confirm in seconds
  sessionKeyAddress?: string // if sent via session key
}

export interface SafeData {
  safeAddress: string
  deployedAt: string
  deploymentTxHash: string
  sessionKeys: SessionKey[]
  lastBalance: string // cached for display
  lastChecked: string
  transactions: Transaction[] // transaction history
}

export interface UserSafeData {
  userAddress: string
  safes: Record<number, SafeData> // chainId => SafeData
}

class SafeStorageClass {
  private readonly STORAGE_PREFIX = 'w3pk_safe_'
  private readonly API_ENDPOINT = '/api/safe/storage'

  /**
   * Generate storage key for a user address
   */
  private getKey(userAddress: string): string {
    return `${this.STORAGE_PREFIX}${userAddress.toLowerCase()}`
  }

  /**
   * Get all Safe data for a user
   */
  getData(userAddress: string): UserSafeData | null {
    if (typeof window === 'undefined') return null

    try {
      const stored = localStorage.getItem(this.getKey(userAddress))
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('Error reading Safe data from localStorage:', error)
      return null
    }
  }

  /**
   * Check if user has a Safe on specific chain
   */
  hasSafe(userAddress: string, chainId: number): boolean {
    const data = this.getData(userAddress)
    return !!data?.safes?.[chainId]?.safeAddress
  }

  /**
   * Get Safe address for user on specific chain
   */
  getSafeAddress(userAddress: string, chainId: number): string | null {
    const data = this.getData(userAddress)
    return data?.safes?.[chainId]?.safeAddress || null
  }

  /**
   * Get Safe data for specific chain
   */
  getSafeData(userAddress: string, chainId: number): SafeData | null {
    const data = this.getData(userAddress)
    return data?.safes?.[chainId] || null
  }

  /**
   * Save or update Safe data
   */
  saveSafe(userAddress: string, chainId: number, safeData: SafeData): void {
    if (typeof window === 'undefined') return

    try {
      const data = this.getData(userAddress) || {
        userAddress,
        safes: {},
      }

      data.safes[chainId] = safeData

      localStorage.setItem(this.getKey(userAddress), JSON.stringify(data))
      console.log(`✅ Safe data saved locally for chain ${chainId}`)
    } catch (error) {
      console.error('Error saving Safe data to localStorage:', error)
      throw new Error('Failed to save Safe data locally')
    }
  }

  /**
   * Update Safe balance
   */
  updateBalance(userAddress: string, chainId: number, balance: string): void {
    const data = this.getData(userAddress)
    if (!data?.safes?.[chainId]) return

    data.safes[chainId].lastBalance = balance
    data.safes[chainId].lastChecked = new Date().toISOString()

    localStorage.setItem(this.getKey(userAddress), JSON.stringify(data))
  }

  /**
   * Add session key to Safe
   */
  addSessionKey(userAddress: string, chainId: number, sessionKey: SessionKey): void {
    const data = this.getData(userAddress)
    if (!data?.safes?.[chainId]) {
      throw new Error('Safe not found for this chain')
    }

    data.safes[chainId].sessionKeys.push(sessionKey)
    localStorage.setItem(this.getKey(userAddress), JSON.stringify(data))
    console.log(`✅ Session key added for Safe on chain ${chainId}`)
  }

  /**
   * Update session key status
   */
  updateSessionKey(
    userAddress: string,
    chainId: number,
    keyAddress: string,
    updates: Partial<SessionKey>
  ): void {
    const data = this.getData(userAddress)
    if (!data?.safes?.[chainId]) return

    const keyIndex = data.safes[chainId].sessionKeys.findIndex(
      key => key.keyAddress.toLowerCase() === keyAddress.toLowerCase()
    )

    if (keyIndex === -1) return

    data.safes[chainId].sessionKeys[keyIndex] = {
      ...data.safes[chainId].sessionKeys[keyIndex],
      ...updates,
    }

    localStorage.setItem(this.getKey(userAddress), JSON.stringify(data))
  }

  /**
   * Get active session keys for a Safe
   */
  getActiveSessionKeys(userAddress: string, chainId: number): SessionKey[] {
    const data = this.getData(userAddress)
    if (!data?.safes?.[chainId]) return []

    const now = Date.now() / 1000

    return data.safes[chainId].sessionKeys.filter(
      key => key.isActive && key.permissions.validUntil > now
    )
  }

  /**
   * Export Safe data as JSON (for backup)
   */
  exportData(userAddress: string): string {
    const data = this.getData(userAddress)
    return JSON.stringify(data, null, 2)
  }

  /**
   * Import Safe data from JSON backup
   */
  importData(jsonData: string): void {
    if (typeof window === 'undefined') return

    try {
      const data: UserSafeData = JSON.parse(jsonData)

      // Validate structure
      if (!data.userAddress || !data.safes) {
        throw new Error('Invalid backup data structure')
      }

      localStorage.setItem(this.getKey(data.userAddress), jsonData)
      console.log(`✅ Safe data imported for ${data.userAddress}`)
    } catch (error) {
      console.error('Error importing Safe data:', error)
      throw new Error('Failed to import Safe data')
    }
  }

  /**
   * Backup to API (optional persistence)
   */
  async backupToAPI(userAddress: string): Promise<void> {
    const data = this.getData(userAddress)
    if (!data) throw new Error('No data to backup')

    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to backup to API')
      }

      console.log('✅ Data backed up to API')
    } catch (error) {
      console.error('Error backing up to API:', error)
      throw error
    }
  }

  /**
   * Restore from API
   */
  async restoreFromAPI(userAddress: string): Promise<UserSafeData | null> {
    try {
      const response = await fetch(`${this.API_ENDPOINT}?address=${userAddress}`)

      if (!response.ok) {
        return null
      }

      const data: UserSafeData = await response.json()

      // Save to localStorage
      localStorage.setItem(this.getKey(userAddress), JSON.stringify(data))
      console.log('✅ Data restored from API')

      return data
    } catch (error) {
      console.error('Error restoring from API:', error)
      return null
    }
  }

  /**
   * Add transaction to history
   */
  addTransaction(userAddress: string, chainId: number, transaction: Transaction): void {
    console.log('💾 [SafeStorage.addTransaction]')
    console.log('  userAddress:', userAddress)
    console.log('  chainId:', chainId)
    console.log('  transaction:', JSON.stringify(transaction, null, 2))

    let data = this.getData(userAddress)
    console.log('  data exists:', !!data)
    console.log('  safes:', data?.safes ? Object.keys(data.safes) : 'none')

    // Auto-initialize if Safe data doesn't exist
    if (!data) {
      console.log('  Auto-initializing user data structure')
      data = {
        userAddress,
        safes: {},
      }
    }

    // Auto-initialize Safe for this chain if it doesn't exist
    if (!data.safes[chainId]) {
      console.log('  Auto-initializing Safe data for chain', chainId)
      // Determine safe address from transaction
      const safeAddress = transaction.direction === 'outgoing' ? transaction.from : transaction.to
      data.safes[chainId] = {
        safeAddress,
        deployedAt: new Date().toISOString(),
        deploymentTxHash: '',
        sessionKeys: [],
        lastBalance: '0',
        lastChecked: new Date().toISOString(),
        transactions: [],
      }
      console.log('  Created Safe structure for:', safeAddress)
    }

    // Initialize transactions array if it doesn't exist
    if (!data.safes[chainId].transactions) {
      console.log('  Initializing transactions array')
      data.safes[chainId].transactions = []
    }

    console.log('  Current transaction count:', data.safes[chainId].transactions.length)

    // Check if transaction already exists
    const existingIndex = data.safes[chainId].transactions.findIndex(
      tx => tx.txId === transaction.txId
    )

    if (existingIndex !== -1) {
      // Update existing transaction
      console.log('  Updating existing transaction at index:', existingIndex)
      data.safes[chainId].transactions[existingIndex] = transaction
    } else {
      // Add new transaction at the beginning (most recent first)
      console.log('  Adding new transaction')
      data.safes[chainId].transactions.unshift(transaction)

      // Keep only last 100 transactions
      if (data.safes[chainId].transactions.length > 100) {
        data.safes[chainId].transactions = data.safes[chainId].transactions.slice(0, 100)
      }
    }

    console.log('  New transaction count:', data.safes[chainId].transactions.length)
    localStorage.setItem(this.getKey(userAddress), JSON.stringify(data))
    console.log('✅ Transaction saved to localStorage')
  }

  /**
   * Get transaction history for a Safe by user address and chain
   */
  getTransactions(userAddress: string, chainId: number, limit?: number): Transaction[] {
    const data = this.getData(userAddress)
    if (!data?.safes?.[chainId]?.transactions) return []

    const transactions = data.safes[chainId].transactions
    return limit ? transactions.slice(0, limit) : transactions
  }

  /**
   * Get transaction history for a Safe by Safe address
   * More intuitive - directly filter by the Safe address
   */
  getTransactionsBySafe(
    userAddress: string,
    safeAddress: string,
    chainId: number,
    limit?: number
  ): Transaction[] {
    console.log('🔍 [SafeStorage.getTransactionsBySafe]')
    console.log('  userAddress:', userAddress)
    console.log('  safeAddress:', safeAddress)
    console.log('  chainId:', chainId)
    console.log('  limit:', limit)

    const data = this.getData(userAddress)
    console.log('  data exists:', !!data)
    console.log('  safes:', data?.safes ? Object.keys(data.safes) : 'none')

    if (!data?.safes?.[chainId]) {
      console.log('❌ No Safe data found for this chain')
      return []
    }

    console.log('  Safe address in storage:', data.safes[chainId].safeAddress)
    console.log('  Requested Safe address:', safeAddress)
    console.log('  Transactions in storage:', data.safes[chainId].transactions?.length || 0)

    // Verify this is the correct Safe
    if (data.safes[chainId].safeAddress.toLowerCase() !== safeAddress.toLowerCase()) {
      console.log('❌ Safe address mismatch!')
      return []
    }

    const transactions = data.safes[chainId].transactions || []
    console.log(`✅ Returning ${transactions.length} transactions`)
    return limit ? transactions.slice(0, limit) : transactions
  }

  /**
   * Update transaction status
   */
  updateTransaction(
    userAddress: string,
    chainId: number,
    txId: string,
    updates: Partial<Transaction>
  ): void {
    const data = this.getData(userAddress)
    if (!data?.safes?.[chainId]?.transactions) return

    const txIndex = data.safes[chainId].transactions.findIndex(tx => tx.txId === txId)

    if (txIndex === -1) return

    data.safes[chainId].transactions[txIndex] = {
      ...data.safes[chainId].transactions[txIndex],
      ...updates,
    }

    localStorage.setItem(this.getKey(userAddress), JSON.stringify(data))
  }

  /**
   * Clear all Safe data for user
   */
  clearData(userAddress: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(this.getKey(userAddress))
    console.log(`🗑️  Safe data cleared for ${userAddress}`)
  }
}

// Export singleton instance
export const SafeStorage = new SafeStorageClass()
