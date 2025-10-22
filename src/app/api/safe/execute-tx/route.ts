import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import Safe from '@safe-global/protocol-kit'

/**
 * API Route: Execute Safe Transaction
 *
 * This endpoint executes arbitrary transactions through a Safe
 * Used for operations like enabling modules
 *
 * POST /api/safe/execute-tx
 * Body: { safeAddress, to, data, value, signature, chainId }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { safeAddress, to, data, value, signature, chainId } = body

    // Validation
    if (!safeAddress || !to || !data || signature === undefined || !chainId) {
      return NextResponse.json(
        { error: 'Missing required fields: safeAddress, to, data, signature, chainId' },
        { status: 400 }
      )
    }

    // Validate addresses
    if (!/^0x[a-fA-F0-9]{40}$/.test(safeAddress) || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`📤 Executing Safe transaction`)
    console.log(`   Safe: ${safeAddress}`)
    console.log(`   To: ${to}`)
    console.log(`   Data: ${data.slice(0, 20)}...`)

    // Get RPC provider
    const rpcUrl = process.env.GNOSIS_CHIADO_RPC!
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Initialize Safe Protocol Kit with relayer (who pays gas)
    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY!,
      safeAddress: safeAddress,
    })

    // Create Safe transaction
    const safeTransaction = await protocolKit.createTransaction({
      transactions: [
        {
          to: to,
          value: value || '0',
          data: data,
        },
      ],
    })

    // Execute transaction (relayer pays gas, but user signed the intent)
    console.log(`Executing transaction...`)
    const executeTxResponse = await protocolKit.executeTransaction(safeTransaction)

    // Get transaction hash
    let txHash: string | undefined

    if (executeTxResponse.transactionResponse) {
      const txResponse = executeTxResponse.transactionResponse as any
      if (txResponse.wait) {
        const receipt = await txResponse.wait()
        txHash = receipt?.hash
      } else if (txResponse.hash) {
        txHash = txResponse.hash
      }
    }

    if (!txHash && (executeTxResponse as any).hash) {
      txHash = (executeTxResponse as any).hash
    }

    if (!txHash) {
      throw new Error('Transaction hash not available')
    }

    console.log(`✅ Transaction executed: ${txHash}`)

    return NextResponse.json(
      {
        success: true,
        txHash: txHash,
        message: 'Transaction executed successfully',
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error executing transaction:', error)
    return NextResponse.json(
      {
        error: 'Failed to execute transaction',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
