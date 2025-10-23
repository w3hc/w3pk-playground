import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

/**
 * API Route: Safe Storage
 * 
 * This endpoint provides backup and restore functionality for Safe data
 * Data is stored as JSON files keyed by user address
 * 
 * POST /api/safe/storage - Backup data
 * GET /api/safe/storage?address=0x... - Restore data
 */

const STORAGE_DIR = path.join(process.cwd(), 'data', 'safe-storage')

// Ensure storage directory exists
async function ensureStorageDir() {
  if (!existsSync(STORAGE_DIR)) {
    await mkdir(STORAGE_DIR, { recursive: true })
  }
}

function getStorageFilePath(userAddress: string): string {
  return path.join(STORAGE_DIR, `${userAddress.toLowerCase()}.json`)
}

/**
 * POST - Backup Safe data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, safes } = body

    // Validation
    if (!userAddress || !safes) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, safes' },
        { status: 400 }
      )
    }

    // Validate address
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`💾 Backing up Safe data for ${userAddress}`)

    // Ensure directory exists
    await ensureStorageDir()

    // Prepare data with timestamp
    const backupData = {
      userAddress,
      safes,
      lastBackup: new Date().toISOString(),
    }

    // Write to file
    const filePath = getStorageFilePath(userAddress)
    await writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf-8')

    console.log(`✅ Data backed up successfully`)

    return NextResponse.json(
      {
        success: true,
        message: 'Data backed up successfully',
        timestamp: backupData.lastBackup,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error backing up data:', error)
    return NextResponse.json(
      {
        error: 'Failed to backup data',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Restore Safe data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('address')

    // Validation
    if (!userAddress) {
      return NextResponse.json(
        { error: 'Missing required parameter: address' },
        { status: 400 }
      )
    }

    // Validate address
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`📥 Restoring Safe data for ${userAddress}`)

    const filePath = getStorageFilePath(userAddress)

    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'No backup found for this address' },
        { status: 404 }
      )
    }

    // Read file
    const fileContent = await readFile(filePath, 'utf-8')
    const data = JSON.parse(fileContent)

    console.log(`✅ Data restored successfully`)

    return NextResponse.json(data, { status: 200 })
  } catch (error: any) {
    console.error('Error restoring data:', error)
    return NextResponse.json(
      {
        error: 'Failed to restore data',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * Implementation Notes:
 * 
 * Current implementation uses JSON files for simplicity.
 * For production, consider:
 * 
 * 1. Database storage (PostgreSQL, MongoDB):
 *    - Better concurrency handling
 *    - Easier querying and indexing
 *    - Built-in backup solutions
 * 
 * 2. Encryption:
 *    - Encrypt sensitive data before storing
 *    - Use user's W3PK-derived key for encryption
 * 
 * 3. Authentication:
 *    - Verify user owns the address before backup/restore
 *    - Sign a message with W3PK to prove ownership
 * 
 * 4. Rate limiting:
 *    - Prevent abuse of backup/restore endpoints
 * 
 * Example with encryption:
 * 
 * import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
 * 
 * function encrypt(data: string, key: Buffer): { encrypted: string; iv: string } {
 *   const iv = randomBytes(16)
 *   const cipher = createCipheriv('aes-256-gcm', key, iv)
 *   const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()])
 *   return {
 *     encrypted: encrypted.toString('hex'),
 *     iv: iv.toString('hex'),
 *   }
 * }
 * 
 * Example with authentication:
 * 
 * import { verifyMessage } from 'ethers'
 * 
 * const recoveredAddress = verifyMessage(message, signature)
 * if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
 *   throw new Error('Invalid signature')
 * }
 */
