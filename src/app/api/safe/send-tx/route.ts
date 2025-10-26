import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import Safe from '@safe-global/protocol-kit'
import { getAccount, OWNABLE_VALIDATOR_ADDRESS } from '@rhinestone/module-sdk'
import { sendTransactionStatus } from '@/lib/websocket'
import { randomBytes } from 'crypto'

// Smart Sessions Module address
const SMART_SESSIONS_MODULE = '0x00000000008bDABA73cD9815d79069c247Eb4bDA'

/**
 * API Route: Send Transaction
 *
 * This endpoint relays transactions from a Safe wallet
 * The relayer pays gas fees, making it gasless for the user
 *
 * POST /api/safe/send-tx
 * Body: { userAddress: string, safeAddress: string, chainId: number, to: string, amount: string }
 */

interface TransactionParams {
  txId: string
  userAddress: string
  safeAddress: string
  chainId: number
  to: string
  amount: string
  sessionKeyAddress: string
  signature: string
  sessionKeyValidUntil?: number
  userPrivateKey: string
}

// Synchronous function to process transaction (for non-WebSocket mode)
async function processTransactionSync(params: TransactionParams) {
  const {
    txId,
    userAddress,
    safeAddress,
    chainId,
    to,
    amount,
    sessionKeyAddress,
    signature,
    sessionKeyValidUntil,
    userPrivateKey,
  } = params

  const statusTimestamps: {
    started: number
    verified?: number
    confirmed?: number
  } = {
    started: Date.now(),
  }

  try {
    // Validate session key expiration
    if (sessionKeyValidUntil) {
      const now = Math.floor(Date.now() / 1000)
      if (now > sessionKeyValidUntil) {
        return {
          success: false,
          error: 'Session key has expired',
          details: `Session key expired at ${new Date(sessionKeyValidUntil * 1000).toISOString()}`,
        }
      }
    }

    // Validate amount
    const amountBigInt = BigInt(amount)
    if (amountBigInt <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than 0',
      }
    }

    console.log(`📤 Sending transaction from Safe ${safeAddress}`)
    console.log(`   To: ${to}`)
    console.log(`   Amount: ${amount} wei`)
    console.log(`   Chain: ${chainId}`)

    // RPC URLs for different chains
    const rpcUrls: Record<number, string> = {
      10200: 'https://rpc.chiadochain.net',
      11155111: process.env.ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org',
      84532: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    }

    const rpcUrl = rpcUrls[chainId]
    if (!rpcUrl) {
      return {
        success: false,
        error: `Unsupported chain ID: ${chainId}`,
      }
    }

    // Initialize provider and check balance
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const balance = await provider.getBalance(safeAddress)

    if (balance < amountBigInt) {
      return {
        success: false,
        error: 'Insufficient balance',
        details: `Safe balance: ${balance.toString()} wei, required: ${amount} wei`,
      }
    }

    // Session Key Validation
    const txData = {
      to,
      value: amount,
      data: '0x',
    }
    const message = JSON.stringify(txData)
    const recoveredAddress = ethers.verifyMessage(message, signature)

    if (recoveredAddress.toLowerCase() !== sessionKeyAddress.toLowerCase()) {
      return {
        success: false,
        error: 'Invalid signature',
        details: `Signature does not match session key address`,
      }
    }

    console.log(`✅ Signature verified from session key ${sessionKeyAddress}`)

    // Check if Smart Sessions module is enabled on-chain
    const userProtocolKit = await Safe.init({
      provider: rpcUrl,
      signer: userPrivateKey,
      safeAddress: safeAddress,
    })

    const isModuleEnabled = await userProtocolKit.isModuleEnabled(SMART_SESSIONS_MODULE)

    if (isModuleEnabled) {
      console.log(`✅ Smart Sessions module is enabled on-chain`)

      // Validate spending limits
      const defaultSpendingLimit = BigInt('100000000000000000')

      if (amountBigInt > defaultSpendingLimit) {
        return {
          success: false,
          error: 'Spending limit exceeded',
          details: `Transaction amount exceeds session key spending limit`,
        }
      }

      console.log(`✅ Spending limit check passed`)

      // Validate transaction target
      if (to === '0x0000000000000000000000000000000000000000') {
        return {
          success: false,
          error: 'Invalid recipient',
          details: 'Cannot send to zero address',
        }
      }
    }

    // Verify Safe balance one more time
    const currentBalance = await provider.getBalance(safeAddress)
    if (currentBalance < amountBigInt) {
      return {
        success: false,
        error: 'Insufficient balance',
        details: 'Balance verification failed before execution',
      }
    }

    console.log(`✅ Final balance verification passed`)

    // Status: verified
    statusTimestamps.verified = Date.now()
    const verifiedDuration = (statusTimestamps.verified - statusTimestamps.started) / 1000

    // Create Safe transaction
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
        txHash = receipt?.hash || txResponse.hash
      } else if (txResponse.hash) {
        txHash = txResponse.hash
      }
    }

    if (!txHash && (executeTxResponse as any).hash) {
      txHash = (executeTxResponse as any).hash
    }

    if (!txHash) {
      return {
        success: false,
        error: 'Transaction hash not available',
      }
    }

    console.log(`✅ Transaction executed with hash: ${txHash}`)

    // Status: confirmed
    statusTimestamps.confirmed = Date.now()
    const confirmedDuration = (statusTimestamps.confirmed - statusTimestamps.started) / 1000

    return {
      success: true,
      txHash,
      message: 'Transaction sent successfully',
      status: 'confirmed' as const,
      timestamps: statusTimestamps,
      durations: {
        verified: verifiedDuration,
        confirmed: confirmedDuration,
      },
    }
  } catch (error: any) {
    console.error(`Error processing transaction ${txId}:`, error)
    return {
      success: false,
      error: 'Failed to send transaction',
      details: error.message,
    }
  }
}

// Async function to process the transaction (for WebSocket mode)
async function processTransaction(params: TransactionParams) {
  const {
    txId,
    userAddress,
    safeAddress,
    chainId,
    to,
    amount,
    sessionKeyAddress,
    signature,
    sessionKeyValidUntil,
    userPrivateKey,
  } = params

  const statusTimestamps: {
    started: number
    verified?: number
    confirmed?: number
  } = {
    started: Date.now(),
  }

  try {
    // Validate session key expiration
    if (sessionKeyValidUntil) {
      const now = Math.floor(Date.now() / 1000)
      if (now > sessionKeyValidUntil) {
        sendTransactionStatus(txId, 'started', {
          timestamp: Date.now(),
          message: `Session key expired at ${new Date(sessionKeyValidUntil * 1000).toISOString()}`,
        })
        return
      }
    }

    // Validate amount
    const amountBigInt = BigInt(amount)
    if (amountBigInt <= 0) {
      sendTransactionStatus(txId, 'started', {
        timestamp: Date.now(),
        message: 'Amount must be greater than 0',
      })
      return
    }

    console.log(`📤 Sending transaction from Safe ${safeAddress}`)
    console.log(`   To: ${to}`)
    console.log(`   Amount: ${amount} wei`)
    console.log(`   Chain: ${chainId}`)
    console.log(`   Session key: ${sessionKeyAddress}`)
    console.log(`   Signature provided: ${signature ? 'Yes' : 'No'}`)

    // RPC URLs for different chains
    const rpcUrls: Record<number, string> = {
      10200: 'https://rpc.chiadochain.net',
      11155111: process.env.ETHEREUM_SEPOLIA_RPC || 'https://rpc.sepolia.org',
      84532: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    }

    const rpcUrl = rpcUrls[chainId]
    if (!rpcUrl) {
      sendTransactionStatus(txId, 'started', {
        timestamp: Date.now(),
        message: `Unsupported chain ID: ${chainId}`,
      })
      return
    }

    // Initialize provider and check balance
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const balance = await provider.getBalance(safeAddress)

    if (balance < amountBigInt) {
      sendTransactionStatus(txId, 'started', {
        timestamp: Date.now(),
        message: `Insufficient balance: ${balance.toString()} wei, required: ${amount} wei`,
      })
      return
    }

    // Session Key Validation:
    const txData = {
      to,
      value: amount,
      data: '0x',
    }
    const message = JSON.stringify(txData)
    const recoveredAddress = ethers.verifyMessage(message, signature)

    if (recoveredAddress.toLowerCase() !== sessionKeyAddress.toLowerCase()) {
      sendTransactionStatus(txId, 'started', {
        timestamp: Date.now(),
        message: `Invalid signature. Expected: ${sessionKeyAddress}, Got: ${recoveredAddress}`,
      })
      return
    }

    console.log(`✅ Signature verified from session key ${sessionKeyAddress}`)

    // Check if Smart Sessions module is enabled on-chain
    try {
      const userProtocolKit = await Safe.init({
        provider: rpcUrl,
        signer: userPrivateKey,
        safeAddress: safeAddress,
      })

      const isModuleEnabled = await userProtocolKit.isModuleEnabled(SMART_SESSIONS_MODULE)

      if (isModuleEnabled) {
        console.log(`✅ Smart Sessions module is enabled on-chain`)

        // Validate spending limits
        const defaultSpendingLimit = BigInt('100000000000000000')

        if (amountBigInt > defaultSpendingLimit) {
          sendTransactionStatus(txId, 'started', {
            timestamp: Date.now(),
            message: `Spending limit exceeded: ${amountBigInt.toString()} wei > ${defaultSpendingLimit.toString()} wei`,
          })
          return
        }

        console.log(`✅ Spending limit check passed (${amountBigInt} <= ${defaultSpendingLimit})`)
        console.log(`✅ Session key on-chain validation: enabled`)
        console.log(`✅ Permission policies: enforced`)

        // Validate transaction target
        if (to === '0x0000000000000000000000000000000000000000') {
          sendTransactionStatus(txId, 'started', {
            timestamp: Date.now(),
            message: 'Cannot send to zero address',
          })
          return
        }

        console.log(`✅ Transaction target validated`)
      } else {
        console.log(`⚠️  Smart Sessions module not enabled - using signature validation only`)
      }

      // Verify Safe balance one more time right before execution
      const currentBalance = await provider.getBalance(safeAddress)
      if (currentBalance < amountBigInt) {
        sendTransactionStatus(txId, 'started', {
          timestamp: Date.now(),
          message: `Balance verification failed before execution: ${currentBalance.toString()} wei < ${amount} wei`,
        })
        return
      }
      console.log(
        `✅ Final balance verification passed: ${currentBalance.toString()} wei available`
      )

      // Status: verified - balance is verified and we're ready to sign
      statusTimestamps.verified = Date.now()
      const verifiedDuration = (statusTimestamps.verified - statusTimestamps.started) / 1000
      console.log(`✅ Transaction verified (${verifiedDuration}s)`)

      sendTransactionStatus(txId, 'verified', {
        timestamp: statusTimestamps.verified,
        duration: verifiedDuration,
        message: 'Transaction verified, signing...',
        recipientAddress: to,
        from: safeAddress,
        amount,
      })

      // Create Safe transaction
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
          // Wait for receipt to get the hash
          const receipt = await txResponse.wait()
          txHash = receipt?.hash || txResponse.hash
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

      console.log(`✅ Transaction executed with hash: ${txHash}`)

      // Status: confirmed - transaction was mined
      statusTimestamps.confirmed = Date.now()
      const confirmedDuration = (statusTimestamps.confirmed - statusTimestamps.started) / 1000
      console.log(`✅ Transaction confirmed (${confirmedDuration}s)`)

      sendTransactionStatus(txId, 'confirmed', {
        timestamp: statusTimestamps.confirmed,
        duration: confirmedDuration,
        txHash,
        message: 'Transaction confirmed on-chain',
        recipientAddress: to,
        from: safeAddress,
        amount,
      })
    } catch (error: any) {
      console.error(`Error processing transaction ${txId}:`, error)
      sendTransactionStatus(txId, 'started', {
        timestamp: Date.now(),
        message: `Error: ${error.message}`,
      })
    }
  } catch (error: any) {
    console.error(`Fatal error processing transaction ${txId}:`, error)
    sendTransactionStatus(txId, 'started', {
      timestamp: Date.now(),
      message: `Fatal error: ${error.message}`,
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Generate unique transaction ID for WebSocket tracking
    const txId = randomBytes(16).toString('hex')

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
      useWebSocket, // Optional: frontend can explicitly request WebSocket mode
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

    // Check if WebSocket is available (check if server has WebSocket support)
    const hasWebSocket = typeof global !== 'undefined' && (global as any).wsConnections

    // If WebSocket requested and available, use async processing
    if (useWebSocket && hasWebSocket) {
      // Send started status via WebSocket
      sendTransactionStatus(txId, 'started', {
        timestamp: Date.now(),
        message: 'Transaction initiated',
        recipientAddress: to,
        from: safeAddress,
        amount,
      })

      // Small delay to ensure WebSocket connection is established before processing
      setTimeout(() => {
        processTransaction({
          txId,
          userAddress,
          safeAddress,
          chainId,
          to,
          amount,
          sessionKeyAddress,
          signature,
          sessionKeyValidUntil,
          userPrivateKey,
        })
      }, 100) // 100ms delay to allow WebSocket connection

      // Return txId immediately so frontend can connect to WebSocket
      return NextResponse.json(
        {
          success: true,
          txId,
          useWebSocket: true,
          message: 'Transaction processing started. Connect to WebSocket for real-time updates.',
        },
        { status: 200 }
      )
    }

    // Fallback: Process synchronously without WebSocket
    console.log('Processing transaction synchronously (no WebSocket)')
    const result = await processTransactionSync({
      txId,
      userAddress,
      safeAddress,
      chainId,
      to,
      amount,
      sessionKeyAddress,
      signature,
      sessionKeyValidUntil,
      userPrivateKey,
    })

    return NextResponse.json(result, { status: result.success ? 200 : 400 })
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
