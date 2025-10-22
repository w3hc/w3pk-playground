import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

/**
 * API Route: Get Safe Balance
 *
 * This endpoint fetches the current balance of a Safe wallet
 *
 * POST /api/safe/balance
 * Body: { safeAddress: string, chainId: number }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { safeAddress, chainId } = body

    // Validation
    if (!safeAddress || !chainId) {
      return NextResponse.json(
        { error: 'Missing required fields: safeAddress, chainId' },
        { status: 400 }
      )
    }

    // Validate address
    if (!/^0x[a-fA-F0-9]{40}$/.test(safeAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`💰 Fetching balance for Safe ${safeAddress} on chain ${chainId}`)

    // RPC URLs for different chains
    const rpcUrls: Record<number, string> = {
      10200: process.env.GNOSIS_CHIADO_RPC || 'https://rpc.chiadochain.net',
      11155111: process.env.ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org',
      84532: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
      // Add more chains as needed
    }

    const rpcUrl = rpcUrls[chainId]
    if (!rpcUrl) {
      return NextResponse.json(
        { error: `Unsupported chain ID: ${chainId}` },
        { status: 400 }
      )
    }

    // Connect to RPC and fetch balance
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

/**
 * Implementation Notes:
 * 
 * To complete this endpoint:
 * 
 * 1. Set up RPC connections:
 * 
 * import { ethers } from 'ethers'
 * 
 * const rpcUrls: Record<number, string> = {
 *   10200: 'https://rpc.chiadochain.net', // Gnosis Chiado
 *   // Add other chains...
 * }
 * 
 * const provider = new ethers.JsonRpcProvider(rpcUrls[chainId])
 * 
 * 2. Fetch balance:
 * 
 * const balance = await provider.getBalance(safeAddress)
 * const balanceInWei = balance.toString()
 * 
 * 3. Optionally fetch token balances:
 * 
 * // For ERC20 tokens
 * const tokenContract = new ethers.Contract(
 *   tokenAddress,
 *   ['function balanceOf(address) view returns (uint256)'],
 *   provider
 * )
 * 
 * const tokenBalance = await tokenContract.balanceOf(safeAddress)
 * 
 * 4. Return comprehensive balance data:
 * 
 * return {
 *   native: balanceInWei,
 *   tokens: [
 *     {
 *       address: tokenAddress,
 *       symbol: 'USDC',
 *       balance: tokenBalance.toString(),
 *       decimals: 6,
 *     },
 *   ],
 * }
 */
