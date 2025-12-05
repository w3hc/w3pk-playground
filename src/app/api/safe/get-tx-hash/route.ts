import { NextRequest, NextResponse } from 'next/server'
import Safe from '@safe-global/protocol-kit'
import { createWeb3Passkey } from 'w3pk'

/**
 * POST /api/safe/get-tx-hash
 * Get the Safe transaction hash to be signed by the owner
 * Body: { safeAddress, to, data, value, chainId }
 *
 * Returns the EIP-712 hash that the Safe owner needs to sign
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { safeAddress, to, data, value, chainId } = body

    if (!safeAddress || !to || !data || !chainId) {
      return NextResponse.json(
        { error: 'Missing required fields: safeAddress, to, data, chainId' },
        { status: 400 }
      )
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(safeAddress) || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`📝 Getting Safe transaction hash`)
    console.log(`   Safe: ${safeAddress}`)
    console.log(`   To: ${to}`)

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

    // Initialize Safe with relayer (just to create the transaction)
    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY!,
      safeAddress: safeAddress,
    })

    // Create the Safe transaction
    const safeTransaction = await protocolKit.createTransaction({
      transactions: [
        {
          to: to,
          value: value || '0',
          data: data,
        },
      ],
    })

    // Get the transaction hash that needs to be signed
    const txHash = await protocolKit.getTransactionHash(safeTransaction)

    console.log(`✅ Transaction hash generated: ${txHash}`)

    return NextResponse.json(
      {
        success: true,
        txHash: txHash,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error generating transaction hash:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate transaction hash',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
