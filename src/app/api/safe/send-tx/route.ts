import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import Safe from '@safe-global/protocol-kit'

/**
 * API Route: Send Transaction
 *
 * This endpoint relays transactions from a Safe wallet
 * The relayer pays gas fees, making it gasless for the user
 *
 * POST /api/safe/send-tx
 * Body: { userAddress: string, safeAddress: string, chainId: number, to: string, amount: string }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, safeAddress, chainId, to, amount } = body

    // Validation
    if (!userAddress || !safeAddress || !chainId || !to || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate addresses
    if (!/^0x[a-fA-F0-9]{40}$/.test(safeAddress) || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    // Validate amount
    const amountBigInt = BigInt(amount)
    if (amountBigInt <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
    }

    console.log(`📤 Sending transaction from Safe ${safeAddress}`)
    console.log(`   To: ${to}`)
    console.log(`   Amount: ${amount} wei`)
    console.log(`   Chain: ${chainId}`)

    // RPC URLs for different chains
    const rpcUrls: Record<number, string> = {
      10200: process.env.GNOSIS_CHIADO_RPC || 'https://rpc.chiadochain.net',
      11155111: process.env.ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org',
      84532: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    }

    const rpcUrl = rpcUrls[chainId]
    if (!rpcUrl) {
      return NextResponse.json({ error: `Unsupported chain ID: ${chainId}` }, { status: 400 })
    }

    // Initialize provider and check balance
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const balance = await provider.getBalance(safeAddress)

    if (balance < amountBigInt) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          details: `Safe balance: ${balance.toString()} wei, required: ${amount} wei`,
        },
        { status: 400 }
      )
    }

    // Initialize Safe Protocol Kit
    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY!,
      safeAddress: safeAddress,
    })

    // Create transaction
    const safeTransaction = await protocolKit.createTransaction({
      transactions: [
        {
          to: to,
          value: amount,
          data: '0x',
        },
      ],
    })

    // Execute transaction (relayer is owner, so can execute directly)
    const executeTxResponse = await protocolKit.executeTransaction(safeTransaction)

    // Get transaction hash from the response
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

    console.log(`✅ Transaction sent: ${txHash}`)

    return NextResponse.json(
      {
        success: true,
        txHash: txHash,
        message: 'Transaction sent successfully',
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error sending transaction:', error)
    return NextResponse.json(
      {
        error: 'Failed to send transaction',
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
 * 1. Verify Session Key:
 * 
 * // Check if user has active session key
 * // Verify permissions (spending limit, expiry, allowed tokens)
 * 
 * 2. Create Safe Transaction:
 * 
 * import Safe from '@safe-global/protocol-kit'
 * 
 * const protocolKit = await Safe.init({
 *   provider: providerUrl,
 *   signer: sessionKeyPrivateKey, // or relayer key
 *   safeAddress: safeAddress,
 * })
 * 
 * const safeTransaction = await protocolKit.createTransaction({
 *   transactions: [
 *     {
 *       to: to,
 *       value: amount,
 *       data: '0x',
 *     },
 *   ],
 * })
 * 
 * 3. Execute with Session Key Module:
 * 
 * // If using session keys module
 * const sessionKeysModule = // ... initialize module
 * const txResponse = await sessionKeysModule.executeTransactionWithSessionKey(
 *   safeTransaction,
 *   sessionKeyAddress
 * )
 * 
 * // Or execute directly if relayer is owner
 * const executeTxResponse = await protocolKit.executeTransaction(safeTransaction)
 * await executeTxResponse.transactionResponse?.wait()
 * 
 * 4. Error Handling:
 *    - Insufficient balance
 *    - Session key expired
 *    - Spending limit exceeded
 *    - Network errors
 */
