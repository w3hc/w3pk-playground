import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createWeb3Passkey } from 'w3pk'
import { EURO_TOKEN_ADDRESS, ERC20_ABI } from '@/lib/constants'

/**
 * POST /api/safe/faucet
 * Mint EUR tokens to a Safe wallet
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

    console.log(`💶 Minting 10,000 EUR to Safe ${safeAddress}`)

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

    const rpcUrl = endpoints[0]
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY!, provider)

    // Mint 10,000 EUR tokens
    const euroContract = new ethers.Contract(EURO_TOKEN_ADDRESS, ERC20_ABI, relayerWallet)
    const mintAmount = ethers.parseUnits('10000', 18) // 10,000 EUR with 18 decimals

    const mintTx = await euroContract.mint(safeAddress, mintAmount)
    const receipt = await mintTx.wait()

    console.log(`✅ Minted 10,000 EUR to ${safeAddress}`)
    console.log(`   Transaction hash: ${receipt.hash}`)

    return NextResponse.json({
      success: true,
      safeAddress,
      amount: '10000',
      txHash: receipt.hash,
      message: 'Successfully minted 10,000 EUR to Safe',
    })
  } catch (error: any) {
    console.error('Error minting EUR tokens:', error)
    return NextResponse.json(
      {
        error: 'Failed to mint EUR tokens',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
