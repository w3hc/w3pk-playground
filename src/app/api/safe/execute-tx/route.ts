import { NextRequest, NextResponse } from 'next/server'
import Safe from '@safe-global/protocol-kit'
import { createWeb3Passkey } from 'w3pk'

/**
 * POST /api/safe/execute-tx
 * Execute a Safe transaction with user authorization (relayer pays gas)
 * Body: { safeAddress, to, data, value, signature, chainId }
 *
 * The client sends transaction details signed with w3pk's signMessage().
 * The server creates and signs the Safe transaction with the relayer's key,
 * then executes it. This ensures the user's private key never leaves their device.
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { safeAddress, to, data, value, ownerAddress, signature, chainId } = body

    if (!safeAddress || !to || !data || !ownerAddress || !signature || !chainId) {
      return NextResponse.json(
        { error: 'Missing required fields: safeAddress, to, data, ownerAddress, signature, chainId' },
        { status: 400 }
      )
    }

    if (
      !/^0x[a-fA-F0-9]{40}$/.test(safeAddress) ||
      !/^0x[a-fA-F0-9]{40}$/.test(to) ||
      !/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)
    ) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`📤 Executing Safe transaction`)
    console.log(`   Safe: ${safeAddress}`)
    console.log(`   To: ${to}`)
    console.log(`   Owner: ${ownerAddress}`)
    console.log(`   User signature received: ${signature ? 'Yes' : 'No'}`)

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

    console.log(`   Initializing protocol kit...`)

    // Initialize Safe with relayer (who will pay for gas)
    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY!,
      safeAddress: safeAddress,
    })

    // Verify Safe ownership and threshold
    const owners = await protocolKit.getOwners()
    const threshold = await protocolKit.getThreshold()
    console.log(`   Safe owners: ${owners.join(', ')}`)
    console.log(`   Safe threshold: ${threshold}`)

    // Verify the owner address is actually an owner
    const isOwner = owners.some((owner) => owner.toLowerCase() === ownerAddress.toLowerCase())
    if (!isOwner) {
      return NextResponse.json(
        {
          error: 'Address is not a Safe owner',
          details: `${ownerAddress} is not an owner of this Safe`,
        },
        { status: 403 }
      )
    }

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

    console.log(`   Adding owner signature...`)
    console.log(`   Raw signature: ${signature}`)

    // The signature is now directly signed over the Safe transaction hash
    // No prefix adjustment needed since we're using ethers.SigningKey directly

    // Add the owner's signature to the transaction
    const signedSafeTx = await protocolKit.copyTransaction(safeTransaction)

    // Create a proper SafeSignature object
    const safeSignature = {
      signer: ownerAddress,
      data: signature,
      isContractSignature: false,
      staticPart: () => signature,
      dynamicPart: () => '',
    }

    signedSafeTx.addSignature(safeSignature as any)

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

    // Execute the signed transaction (relayer pays gas)
    const executeTxResponse = await protocolKit.executeTransaction(signedSafeTx)

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
