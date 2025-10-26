import { NextRequest, NextResponse } from 'next/server'
import Safe from '@safe-global/protocol-kit'

/**
 * POST /api/safe/get-owners
 * Retrieve the list of owners for a Safe wallet
 * Body: { safeAddress: string, chainId: number }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { safeAddress, chainId } = body

    if (!safeAddress || !chainId) {
      return NextResponse.json(
        { error: 'Missing required fields: safeAddress, chainId' },
        { status: 400 }
      )
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(safeAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`👥 Getting owners for Safe ${safeAddress}`)

    const rpcUrls: Record<number, string> = {
      10200: 'https://rpc.chiadochain.net',
      11155111: process.env.ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org',
      84532: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    }

    const rpcUrl = rpcUrls[chainId]
    if (!rpcUrl) {
      return NextResponse.json({ error: `Unsupported chain ID: ${chainId}` }, { status: 400 })
    }

    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY!,
      safeAddress: safeAddress,
    })

    // Get owners
    const owners = await protocolKit.getOwners()
    const threshold = await protocolKit.getThreshold()

    console.log(`✅ Found ${owners.length} owner(s)`)

    return NextResponse.json(
      {
        success: true,
        owners,
        threshold,
        safeAddress,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error getting Safe owners:', error)
    return NextResponse.json(
      {
        error: 'Failed to get Safe owners',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
