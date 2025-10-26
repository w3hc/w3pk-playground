import { NextRequest, NextResponse } from 'next/server'
import { fetchSafeTransactionHistory } from '@/lib/safeEventPoller'

/**
 * GET /api/safe/transaction-history
 * Query ExecutionSuccess events from Safe contract
 * Query params: safeAddress, userAddress, chainId, fromBlock (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const safeAddress = searchParams.get('safeAddress')
    const userAddress = searchParams.get('userAddress')
    const chainId = searchParams.get('chainId')
    const fromBlock = searchParams.get('fromBlock')

    if (!safeAddress || !userAddress || !chainId) {
      return NextResponse.json(
        { error: 'Missing required parameters: safeAddress, userAddress, chainId' },
        { status: 400 }
      )
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(safeAddress) || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    let rpcUrl: string
    if (chainId === '10200') {
      rpcUrl = 'https://rpc.chiadochain.net'!
    } else {
      return NextResponse.json({ error: 'Unsupported chain ID' }, { status: 400 })
    }

    const startBlock = fromBlock ? parseInt(fromBlock, 10) : 18401088

    console.log(`📖 Fetching transaction history for Safe ${safeAddress}`)
    console.log(`   Chain: ${chainId}, From block: ${startBlock}`)

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
