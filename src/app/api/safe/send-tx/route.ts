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
    const {
      userAddress,
      safeAddress,
      chainId,
      to,
      amount,
      sessionKeyAddress,
      signature,
      sessionKeyValidUntil,
      userPrivateKey,
    } = body

    // Validation
    if (!userAddress || !safeAddress || !chainId || !to || !amount || !sessionKeyAddress) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: userAddress, safeAddress, chainId, to, amount, sessionKeyAddress',
        },
        { status: 400 }
      )
    }

    // Validate session key expiration
    if (sessionKeyValidUntil) {
      const now = Math.floor(Date.now() / 1000)
      if (now > sessionKeyValidUntil) {
        return NextResponse.json(
          {
            error: 'Session key has expired',
            details: `Session key expired at ${new Date(sessionKeyValidUntil * 1000).toISOString()}. Please create a new session key.`,
          },
          { status: 403 }
        )
      }
    }

    // Session key signature is required for all transactions
    if (!signature) {
      return NextResponse.json(
        {
          error:
            'Session key signature required. User must create a session key before sending transactions.',
        },
        { status: 400 }
      )
    }

    // Validate addresses
    if (
      !/^0x[a-fA-F0-9]{40}$/.test(safeAddress) ||
      !/^0x[a-fA-F0-9]{40}$/.test(to) ||
      !/^0x[a-fA-F0-9]{40}$/.test(sessionKeyAddress)
    ) {
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
    console.log(`   Session key: ${sessionKeyAddress}`)
    console.log(`   Signature provided: ${signature ? 'Yes' : 'No'}`)

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

    // Session Key Validation:
    // ✅ 1. Verify the signature is from the sessionKeyAddress
    // ✅ 2. Validate session key expiry
    // ✅ 3. User signs Safe transaction (owner signature)
    // ✅ 4. Relayer executes and pays gas
    //
    // FUTURE ENHANCEMENTS for production:
    // - Check session key is enabled on-chain via Smart Sessions module
    // - Validate spending limits on-chain
    // - Execute through Session Keys Module instead of direct Safe execution
    // - On-chain permission enforcement vs. signature verification

    // Verify signature is from session key address
    const txData = {
      to,
      value: amount,
      data: '0x',
    }
    const message = JSON.stringify(txData)
    const recoveredAddress = ethers.verifyMessage(message, signature)

    if (recoveredAddress.toLowerCase() !== sessionKeyAddress.toLowerCase()) {
      return NextResponse.json(
        {
          error: 'Invalid signature',
          details: `Signature does not match session key address. Expected: ${sessionKeyAddress}, Got: ${recoveredAddress}`,
        },
        { status: 403 }
      )
    }

    console.log(`✅ Signature verified from session key ${sessionKeyAddress}`)

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

    // Create Safe transaction signed by the user (the owner)
    // NOTE: In full implementation, this would be executed via Session Keys Module
    // For now, we verify the session key signature above and user signs the Safe transaction
    const userProtocolKit = await Safe.init({
      provider: rpcUrl,
      signer: userPrivateKey,
      safeAddress: safeAddress,
    })

    // Create transaction
    const safeTransaction = await userProtocolKit.createTransaction({
      transactions: [
        {
          to: to,
          value: amount,
          data: '0x',
        },
      ],
    })

    // Sign with user (the owner)
    const signedSafeTx = await userProtocolKit.signTransaction(safeTransaction)
    console.log(`   Transaction signed by user (owner)`)

    // Execute transaction (relayer pays gas, user signed)
    const relayerProtocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY!,
      safeAddress: safeAddress,
    })

    const executeTxResponse = await relayerProtocolKit.executeTransaction(signedSafeTx)

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
 * Current Implementation (Session Key Signature Verification):
 * 1. User signs transaction data with their W3PK (using session key derived path)
 * 2. Backend verifies signature matches sessionKeyAddress
 * 3. Relayer submits transaction to Safe (pays gas)
 * 4. User never pays gas, but must have valid session key signature
 *
 * Full Production Implementation (with Session Keys Module):
 *
 * 1. Verify Session Key Permissions:
 *
 * // Check session key is enabled on Safe
 * // Verify not expired
 * // Check spending limit not exceeded
 * const sessionKeysModule = getSessionKeyModule({
 *   moduleAddress: SESSION_KEYS_MODULE_ADDRESS,
 *   provider,
 * })
 *
 * const isValid = await sessionKeysModule.isSessionKeyEnabled(
 *   safeAddress,
 *   sessionKeyAddress
 * )
 *
 * 2. Execute with Session Keys Module:
 *
 * // Module validates permissions and executes
 * const txResponse = await sessionKeysModule.executeTransactionWithSessionKey({
 *   safe: safeAddress,
 *   sessionKey: sessionKeyAddress,
 *   signature: signature, // Signed by W3PK with derived path
 *   transaction: {
 *     to,
 *     value: amount,
 *     data: '0x',
 *   },
 * })
 *
 * 3. Error Handling:
 *    - Insufficient balance
 *    - Session key expired
 *    - Spending limit exceeded
 *    - Invalid signature
 *    - Session key not enabled
 *    - Network errors
 */
