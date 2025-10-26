import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

/**
 * POST /api/safe/balance
 * Fetch the current balance of a Safe wallet
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

    console.log(`💰 Fetching balance for Safe ${safeAddress} on chain ${chainId}`)

    const rpcUrls: Record<number, string> = {
      10200: 'https://rpc.chiadochain.net',
      11155111: process.env.ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org',
      84532: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    }

    const rpcUrl = rpcUrls[chainId]
    if (!rpcUrl) {
      return NextResponse.json({ error: `Unsupported chain ID: ${chainId}` }, { status: 400 })
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const balance = await provider.getBalance(safeAddress)

    console.log(`✅ Balance: ${balance.toString()} wei`)

    return NextResponse.json(
      {
        success: true,
        balance: balance.toString(),
        safeAddress,
        chainId,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error fetching balance:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch balance',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

