/**
 * Safe Storage - Hybrid approach using localStorage + API backup
 * Stores Safe deployment data and session keys
 * Transaction history is now queried from the blockchain
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
  isSelfTransfer?: boolean // true if Safe sent to itself
}

export interface SafeData {
  safeAddress: string
  deployedAt: string
  deploymentTxHash: string
  deploymentBlockNumber?: number // block number when Safe was deployed
  sessionKeys: SessionKey[]
  lastBalance: string // cached for display
  lastChecked: string
  // transactions removed - now queried from blockchain via /api/safe/transaction-history
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
   * Transaction history methods removed
   * Use /api/safe/transaction-history endpoint and useSafeTransactionHistory hook instead
   * Transactions are now queried directly from the blockchain via ExecutionSuccess events
   */

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
