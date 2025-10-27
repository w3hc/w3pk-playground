import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import Safe from '@safe-global/protocol-kit'
import { createWeb3Passkey } from 'w3pk'
import { EURO_TOKEN_ADDRESS, ERC20_ABI } from '@/lib/constants'

/**
 * POST /api/safe/deploy-safe
 * Deploy a new Safe smart wallet (gasless via relayer)
 * Body: { userAddress: string, chainId: number }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, chainId } = body

    if (!userAddress || !chainId) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, chainId' },
        { status: 400 }
      )
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`📦 Deploying Safe for ${userAddress} on chain ${chainId}`)

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

    const safeAccountConfig = {
      owners: [userAddress],
      threshold: 1,
    }

    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY,
      predictedSafe: {
        safeAccountConfig,
      },
    })

    const safeAddress = await protocolKit.getAddress()
    console.log(`Predicted Safe address: ${safeAddress}`)

    const isSafeDeployed = await protocolKit.isSafeDeployed()
    console.log(`Safe deployment status: ${isSafeDeployed ? 'Already deployed' : 'Not deployed'}`)

    let txHash: string | undefined
    let deploymentBlockNumber: number | undefined

    if (!isSafeDeployed) {
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

      // console.log(`💰 Funding Safe with 0.05 xDAI...`)
      // const fundingTx = await relayerWallet.sendTransaction({
      //   to: safeAddress,
      //   value: ethers.parseEther('0.05'),
      // })

      // await fundingTx.wait()
      // console.log(`✅ Funded Safe with 0.05 xDAI`)

      // Mint 42 EUR to the newly deployed Safe
      console.log(`💶 Minting 42 EUR to Safe...`)
      const euroContract = new ethers.Contract(EURO_TOKEN_ADDRESS, ERC20_ABI, relayerWallet)
      const mintAmount = ethers.parseUnits('42', 18) // 42 EUR with 18 decimals
      const mintTx = await euroContract.mint(safeAddress, mintAmount)
      await mintTx.wait()
      console.log(`✅ Minted 42 EUR to Safe`)
    } else {
      console.log(`✅ Safe already exists at ${safeAddress}`)

      const balance = await provider.getBalance(safeAddress)
      console.log(`Current balance: ${ethers.formatEther(balance)} xDAI`)

      if (balance < ethers.parseEther('0.005')) {
        console.log(`💰 Balance low, topping up with 0.05 xDAI...`)
        const fundingTx = await relayerWallet.sendTransaction({
          to: safeAddress,
          value: ethers.parseEther('0.05'),
        })
        await fundingTx.wait()
        console.log(`✅ Topped up Safe with 0.05 xDAI`)
      }
    }

    console.log(`📝 Session Keys Module must be enabled by user when creating first session key`)
    console.log(`   Module address: 0x00000000008bDABA73cD9815d79069c247Eb4bDA`)

    return NextResponse.json({
      success: true,
      safeAddress,
      txHash,
      deploymentBlockNumber,
      alreadyDeployed: isSafeDeployed,
      moduleAddress: '0x00000000008bDABA73cD9815d79069c247Eb4bDA',
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
