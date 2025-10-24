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
    // User's W3PK derived address is the sole owner
    // Session keys (also derived addresses) will be used for transactions
    const safeAccountConfig = {
      owners: [userAddress],
      threshold: 1,
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

    // Check if Safe is already deployed
    const isSafeDeployed = await protocolKit.isSafeDeployed()
    console.log(`Safe deployment status: ${isSafeDeployed ? 'Already deployed' : 'Not deployed'}`)

    let txHash: string | undefined
    let deploymentBlockNumber: number | undefined

    if (!isSafeDeployed) {
      // Deploy Safe
      console.log(`Deploying new Safe...`)
      const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction()

      const txResponse = await relayerWallet.sendTransaction({
        to: deploymentTransaction.to,
        data: deploymentTransaction.data,
        value: deploymentTransaction.value,
      })

      const receipt = await txResponse.wait()
      txHash = receipt?.hash
      deploymentBlockNumber = receipt?.blockNumber
      console.log(`✅ Safe deployed at ${safeAddress} in block ${deploymentBlockNumber}`)

      // Send test tokens (0.1 xDAI) to the Safe
      console.log(`💰 Funding Safe with 0.1 xDAI...`)
      const fundingTx = await relayerWallet.sendTransaction({
        to: safeAddress,
        value: ethers.parseEther('0.1'),
      })

      await fundingTx.wait()
      console.log(`✅ Funded Safe with 0.1 xDAI`)
    } else {
      console.log(`✅ Safe already exists at ${safeAddress}`)

      // Check balance
      const balance = await provider.getBalance(safeAddress)
      console.log(`Current balance: ${ethers.formatEther(balance)} xDAI`)

      // Top up if balance is low (less than 0.05 xDAI)
      if (balance < ethers.parseEther('0.05')) {
        console.log(`💰 Balance low, topping up with 0.1 xDAI...`)
        const fundingTx = await relayerWallet.sendTransaction({
          to: safeAddress,
          value: ethers.parseEther('0.1'),
        })
        await fundingTx.wait()
        console.log(`✅ Topped up Safe with 0.1 xDAI`)
      }
    }

    // Enable Session Keys Module
    // NOTE: This requires user signature since relayer is not an owner
    // For now, we'll return the Safe address and module enablement will be done
    // when user creates their first session key (they'll sign the enableModule tx)
    console.log(`📝 Session Keys Module must be enabled by user when creating first session key`)
    console.log(`   Module address: ${process.env.SESSION_KEYS_MODULE_ADDRESS}`)

    return NextResponse.json({
      success: true,
      safeAddress,
      txHash,
      deploymentBlockNumber,
      alreadyDeployed: isSafeDeployed,
      moduleAddress: process.env.SESSION_KEYS_MODULE_ADDRESS,
      message: isSafeDeployed
        ? 'Safe already deployed and ready to use.'
        : 'Safe deployed and funded successfully.',
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
