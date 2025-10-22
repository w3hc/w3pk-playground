import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import Safe from '@safe-global/protocol-kit'

/**
 * API Route: Deploy Safe
 *
 * This endpoint deploys a new Safe smart wallet for a user
 * The deployment is handled by a relayer, making it gasless for the user
 *
 * POST /api/safe/deploy-safe
 * Body: { userAddress: string, chainId: number }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, chainId } = body

    // Validation
    if (!userAddress || !chainId) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, chainId' },
        { status: 400 }
      )
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`📦 Deploying Safe for ${userAddress} on chain ${chainId}`)

    // Get chain RPC
    const rpcUrl = process.env.GNOSIS_CHIADO_RPC!
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY!, provider)

    // Configure Safe deployment
    // Both user and relayer are owners so relayer can execute transactions
    const safeAccountConfig = {
      owners: [userAddress, relayerWallet.address],
      threshold: 1, // Only 1 signature needed
    }

    // Initialize Safe SDK
    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY,
      predictedSafe: {
        safeAccountConfig,
      },
    })

    // Get predicted Safe address
    const safeAddress = await protocolKit.getAddress()
    console.log(`Predicted Safe address: ${safeAddress}`)

    // Deploy Safe
    const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction()

    const txResponse = await relayerWallet.sendTransaction({
      to: deploymentTransaction.to,
      data: deploymentTransaction.data,
      value: deploymentTransaction.value,
    })

    const receipt = await txResponse.wait()
    console.log(`✅ Safe deployed at ${safeAddress}`)

    // Send test tokens (0.1 xDAI) to the Safe
    console.log(`💰 Funding Safe with 0.1 xDAI...`)
    const fundingTx = await relayerWallet.sendTransaction({
      to: safeAddress,
      value: ethers.parseEther('0.1'),
    })

    await fundingTx.wait()
    console.log(`✅ Funded Safe with 0.1 xDAI`)

    return NextResponse.json({
      success: true,
      safeAddress,
      txHash: receipt?.hash,
      message: 'Safe deployed and funded successfully',
    })
  } catch (error: any) {
    console.error('Error deploying Safe:', error)
    return NextResponse.json(
      {
        error: 'Failed to deploy Safe',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * Implementation Notes:
 *
 * To complete this endpoint, you'll need to:
 *
 * 1. Install Safe SDK:
 *    npm install @safe-global/protocol-kit @safe-global/api-kit
 *
 * 2. Set up environment variables:
 *    RELAYER_PRIVATE_KEY=0x...
 *    GNOSIS_CHIADO_RPC=https://rpc.chiadochain.net
 *
 * 3. Implement Safe deployment:
 *
 * import { ethers } from 'ethers'
 * import Safe from '@safe-global/protocol-kit'
 *
 * const provider = new ethers.JsonRpcProvider(process.env.GNOSIS_CHIADO_RPC)
 * const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY!, provider)
 *
 * const safeAccountConfig = {
 *   owners: [userAddress],
 *   threshold: 1,
 * }
 *
 * const protocolKit = await Safe.init({
 *   provider: provider.connection.url,
 *   signer: process.env.RELAYER_PRIVATE_KEY,
 *   predictedSafe: {
 *     safeAccountConfig,
 *   },
 * })
 *
 * const safeAddress = await protocolKit.getAddress()
 * const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction()
 *
 * const txResponse = await relayerWallet.sendTransaction({
 *   to: deploymentTransaction.to,
 *   data: deploymentTransaction.data,
 *   value: deploymentTransaction.value,
 * })
 *
 * await txResponse.wait()
 *
 * 4. Add Session Keys Module:
 *    - Deploy or reference existing Session Keys module
 *    - Enable module on Safe during deployment
 */
