import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import Safe from '@safe-global/protocol-kit'

/**
 * POST /api/safe/add-owner
 * Add the relayer as an owner to an existing Safe
 * Body: { safeAddress: string, chainId: number, userPrivateKey: string }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { safeAddress, chainId, userPrivateKey } = body

    if (!safeAddress || !chainId || !userPrivateKey) {
      return NextResponse.json(
        { error: 'Missing required fields: safeAddress, chainId, userPrivateKey' },
        { status: 400 }
      )
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(safeAddress)) {
      return NextResponse.json({ error: 'Invalid Safe address' }, { status: 400 })
    }

    console.log(`👥 Adding relayer as owner to Safe ${safeAddress}`)

    const rpcUrl = 'https://rpc.chiadochain.net'!
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY!, provider)
    const userWallet = new ethers.Wallet(userPrivateKey, provider)

    console.log(`   Relayer address: ${relayerWallet.address}`)
    console.log(`   User address: ${userWallet.address}`)

    const userProtocolKit = await Safe.init({
      provider: rpcUrl,
      signer: userPrivateKey,
      safeAddress: safeAddress,
    })

    const owners = await userProtocolKit.getOwners()
    console.log(`   Current owners:`, owners)

    if (owners.includes(relayerWallet.address)) {
      return NextResponse.json({
        success: true,
        message: 'Relayer is already an owner',
        owners,
      })
    }

    // Create transaction to add owner
    const safeTransaction = await userProtocolKit.createAddOwnerTx({
      ownerAddress: relayerWallet.address,
      threshold: 1, // Keep threshold at 1
    })

    console.log(`   Created add owner transaction`)

    // Sign the transaction with user's key
    const signedSafeTransaction = await userProtocolKit.signTransaction(safeTransaction)
    console.log(`   User signed the transaction`)

    // Now use relayer to execute (relayer pays gas)
    const relayerProtocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY!,
      safeAddress: safeAddress,
    })

    // Execute with user's signature, but relayer pays gas
    const txResponse = await relayerProtocolKit.executeTransaction(signedSafeTransaction)

    // Get transaction hash
    let txHash: string | undefined
    if (txResponse.transactionResponse) {
      const txResp = txResponse.transactionResponse as any
      if (txResp.wait) {
        const receipt = await txResp.wait()
        txHash = receipt?.hash
      } else if (txResp.hash) {
        txHash = txResp.hash
      }
    }

    if (!txHash && (txResponse as any).hash) {
      txHash = (txResponse as any).hash
    }

    console.log(`✅ Relayer added as owner! Tx: ${txHash}`)

    // Verify the relayer is now an owner
    const updatedOwners = await relayerProtocolKit.getOwners()

    return NextResponse.json({
      success: true,
      message: 'Relayer successfully added as owner',
      txHash,
      owners: updatedOwners,
    })
  } catch (error: any) {
    console.error('Error adding owner:', error)
    return NextResponse.json(
      {
        error: 'Failed to add owner',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
