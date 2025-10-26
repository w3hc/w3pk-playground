import { NextRequest, NextResponse } from 'next/server'
import Safe from '@safe-global/protocol-kit'
import { createWeb3Passkey } from 'w3pk'

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

    const w3pk = createWeb3Passkey({
      debug: process.env.NODE_ENV === 'development',
    })

    const endpoints = await w3pk.getEndpoints(chainId)
    if (!endpoints || endpoints.length === 0) {
      return NextResponse.json({ error: `No RPC endpoints available for chain ID: ${chainId}` }, { status: 400 })
    }

    const rpcUrl = endpoints[0]

    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY!,
      safeAddress: safeAddress,
    })

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
