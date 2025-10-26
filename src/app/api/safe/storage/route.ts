import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

/**
 * POST /api/safe/storage - Backup Safe data
 * GET /api/safe/storage?address=0x... - Restore Safe data
 */

const STORAGE_DIR = path.join(process.cwd(), 'data', 'safe-storage')

async function ensureStorageDir() {
  if (!existsSync(STORAGE_DIR)) {
    await mkdir(STORAGE_DIR, { recursive: true })
  }
}

function getStorageFilePath(userAddress: string): string {
  return path.join(STORAGE_DIR, `${userAddress.toLowerCase()}.json`)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, safes } = body

    if (!userAddress || !safes) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, safes' },
        { status: 400 }
      )
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`💾 Backing up Safe data for ${userAddress}`)

    await ensureStorageDir()

    const backupData = {
      userAddress,
      safes,
      lastBackup: new Date().toISOString(),
    }

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userAddress = searchParams.get('address')

    if (!userAddress) {
      return NextResponse.json({ error: 'Missing required parameter: address' }, { status: 400 })
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`📥 Restoring Safe data for ${userAddress}`)

    const filePath = getStorageFilePath(userAddress)

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'No backup found for this address' }, { status: 404 })
    }

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

