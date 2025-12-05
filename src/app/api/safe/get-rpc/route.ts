import { NextRequest, NextResponse } from 'next/server'
import { createWeb3Passkey } from 'w3pk'

/**
 * POST /api/safe/get-rpc
 * Get RPC endpoint for a given chain ID
 * Body: { chainId }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chainId } = body

    if (!chainId) {
      return NextResponse.json(
        { error: 'Missing required field: chainId' },
        { status: 400 }
      )
    }

    const w3pk = createWeb3Passkey({
      debug: process.env.NODE_ENV === 'development',
    })

    const endpoints = await w3pk.getEndpoints(chainId)
    if (!endpoints || endpoints.length === 0) {
      return NextResponse.json(
        { error: `No RPC endpoints available for chain ID: ${chainId}` },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        rpcUrl: endpoints[0],
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error getting RPC endpoint:', error)
    return NextResponse.json(
      {
        error: 'Failed to get RPC endpoint',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
