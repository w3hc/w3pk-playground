import { NextRequest, NextResponse } from 'next/server'
import { fetchSafeTransactionHistory } from '@/lib/safeEventPoller'

/**
 * API Route: Get Safe Transaction History from Blockchain
 *
 * Queries ExecutionSuccess events from the Safe contract directly
 * instead of relying on localStorage
 *
 * GET /api/safe/transaction-history?safeAddress=0x...&userAddress=0x...&chainId=10200&fromBlock=123456
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const safeAddress = searchParams.get('safeAddress')
    const userAddress = searchParams.get('userAddress')
    const chainId = searchParams.get('chainId')
    const fromBlock = searchParams.get('fromBlock')

    // Validation
    if (!safeAddress || !userAddress || !chainId) {
      return NextResponse.json(
        { error: 'Missing required parameters: safeAddress, userAddress, chainId' },
        { status: 400 }
      )
    }

    // Validate Ethereum addresses
    if (!/^0x[a-fA-F0-9]{40}$/.test(safeAddress) || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    // Get RPC URL for the chain
    let rpcUrl: string
    if (chainId === '10200') {
      rpcUrl = 'https://rpc.chiadochain.net'!
    } else {
      return NextResponse.json({ error: 'Unsupported chain ID' }, { status: 400 })
    }

    // Default to block 0 if not provided, or use deployment block if available
    const startBlock = fromBlock ? parseInt(fromBlock, 10) : 18401088

    console.log(`📖 Fetching transaction history for Safe ${safeAddress}`)
    console.log(`   Chain: ${chainId}, From block: ${startBlock}`)

    // Fetch transaction history from blockchain
    const transactions = await fetchSafeTransactionHistory(
      rpcUrl,
      safeAddress,
      userAddress,
      startBlock,
      'latest',
      parseInt(chainId, 10)
    )

    console.log(`✅ Found ${transactions.length} transactions`)

    return NextResponse.json({
      success: true,
      transactions,
      count: transactions.length,
    })
  } catch (error: any) {
    console.error('Error fetching transaction history:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch transaction history',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
