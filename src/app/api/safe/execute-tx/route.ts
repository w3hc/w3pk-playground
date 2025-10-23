import { NextRequest, NextResponse } from 'next/server'
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
    const { safeAddress, to, data, value, signature, chainId, userPrivateKey } = body

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
    console.log(`   User signature received: ${signature ? 'Yes' : 'No'}`)

    // Get RPC provider
    const rpcUrl = process.env.GNOSIS_CHIADO_RPC!

    // Check if we have the user's private key (needed for signing as owner)
    if (!userPrivateKey) {
      return NextResponse.json(
        {
          error: 'User private key required',
          details:
            'The user must provide their private key to sign this transaction as the Safe owner',
        },
        { status: 400 }
      )
    }

    console.log(`   Using user private key to sign transaction`)

    // Initialize Safe Protocol Kit with user's private key (the actual owner)
    const userProtocolKit = await Safe.init({
      provider: rpcUrl,
      signer: userPrivateKey,
      safeAddress: safeAddress,
    })

    // Check Safe configuration
    const owners = await userProtocolKit.getOwners()
    const threshold = await userProtocolKit.getThreshold()
    console.log(`   Safe owners: ${owners.join(', ')}`)
    console.log(`   Safe threshold: ${threshold}`)

    // Create Safe transaction
    const safeTransaction = await userProtocolKit.createTransaction({
      transactions: [
        {
          to: to,
          value: value || '0',
          data: data,
        },
      ],
    })

    // Sign the transaction with user (who is the owner)
    const signedSafeTx = await userProtocolKit.signTransaction(safeTransaction)
    console.log(`   Transaction signed by user (owner)`)
    console.log(`   Signatures count: ${signedSafeTx.signatures.size}`)
    console.log(`   Required signatures: ${threshold}`)

    if (threshold > signedSafeTx.signatures.size) {
      return NextResponse.json(
        {
          error: 'Insufficient signatures',
          details: `This Safe requires ${threshold} signatures but only ${signedSafeTx.signatures.size} provided.`,
          owners: owners,
          threshold: threshold,
        },
        { status: 400 }
      )
    }

    console.log(`   Executing transaction...`)

    // Execute transaction (user signs, relayer pays gas)
    // We need to switch to relayer signer for execution to pay gas
    const relayerProtocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY!,
      safeAddress: safeAddress,
    })

    // Execute with the user-signed transaction
    const executeTxResponse = await relayerProtocolKit.executeTransaction(signedSafeTx)

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
