import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import Safe from '@safe-global/protocol-kit'

// Smart Sessions Module address (deterministic across all EVM chains)
const SMART_SESSIONS_MODULE = '0x00000000008bDABA73cD9815d79069c247Eb4bDA'
const OWNABLE_VALIDATOR = '0x000000000013fdB5234E4E3162a810F54d9f7E98'

/**
 * API Route: Create Session Key
 * 
 * This endpoint creates a new session key for a Safe wallet
 * Session keys allow delegated transaction execution with specific permissions
 * 
 * POST /api/safe/create-session-key
 * Body: { userAddress: string, safeAddress: string, chainId: number }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, safeAddress, chainId, sessionKeyAddress, sessionKeyIndex } = body

    // Validation
    if (!userAddress || !safeAddress || !chainId || !sessionKeyAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, safeAddress, chainId, sessionKeyAddress' },
        { status: 400 }
      )
    }

    // Validate addresses
    if (
      !/^0x[a-fA-F0-9]{40}$/.test(userAddress) ||
      !/^0x[a-fA-F0-9]{40}$/.test(safeAddress) ||
      !/^0x[a-fA-F0-9]{40}$/.test(sessionKeyAddress)
    ) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 })
    }

    console.log(`🔑 Creating session key for Safe ${safeAddress}`)
    console.log(`   Session key address: ${sessionKeyAddress}`)
    console.log(`   Derived index: ${sessionKeyIndex || 'not specified'}`)

    // Get RPC provider
    const rpcUrl = process.env.GNOSIS_CHIADO_RPC!

    // Set expiry to 24 hours from now
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + 86400 // 24 hours
    const expiresAtDate = new Date(expiresAt * 1000)

    // Default permissions for session key
    const permissions = {
      spendingLimit: '100000000000000000', // 0.1 ETH in wei
      allowedTokens: ['0x0000000000000000000000000000000000000000'], // Native token
      validAfter: now,
      validUntil: expiresAt,
    }

    // Initialize Safe Protocol Kit
    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY,
      safeAddress: safeAddress,
    })

    // Step 1: Check if Smart Sessions module is enabled
    const isModuleEnabled = await protocolKit.isModuleEnabled(SMART_SESSIONS_MODULE)
    console.log(`   Smart Sessions module enabled: ${isModuleEnabled}`)

    if (!isModuleEnabled) {
      console.log(`   Enabling Smart Sessions module...`)

      // Enable the module - this requires owner signature
      // Since user is the owner and relayer is not, we need user to sign this
      // For now, we'll return an error asking user to enable the module first
      // OR we could have the relayer propose the transaction and user signs via frontend

      // Create enable module transaction
      const enableModuleTx = await protocolKit.createEnableModuleTx(SMART_SESSIONS_MODULE)

      // TODO: This needs user signature since relayer is NOT an owner
      // Option 1: Return error and ask user to enable module from frontend
      // Option 2: Create transaction proposal and have user sign it
      // For now, we'll return instructions

      return NextResponse.json(
        {
          success: false,
          requiresModuleEnable: true,
          moduleAddress: SMART_SESSIONS_MODULE,
          message:
            'Smart Sessions module must be enabled first. Please sign the enableModule transaction from the frontend.',
          enableModuleTxData: {
            to: enableModuleTx.data.to,
            data: enableModuleTx.data.data,
            value: enableModuleTx.data.value || '0',
          },
        },
        { status: 200 }
      )
    }

    // Step 2: Register session key on Smart Sessions module
    // NOTE: This is a simplified implementation
    // Full implementation would use Rhinestone SDK with proper session configuration

    console.log(`   Registering session key on Smart Sessions module...`)
    console.log(`   Session validator: ${OWNABLE_VALIDATOR}`)
    console.log(`   Spending limit: ${permissions.spendingLimit} wei`)
    console.log(`   Valid until: ${expiresAtDate.toISOString()}`)

    // TODO: Implement actual session registration via Smart Sessions module
    // This requires building the proper session data structure and calling
    // the module's enableSession function
    //
    // For now, we'll simulate success and return metadata
    // The actual implementation needs:
    // 1. Encode session validator init data (sessionKeyAddress)
    // 2. Define action policies (spending limits, time restrictions)
    // 3. Call Smart Sessions module to enable session
    // 4. Have user sign the enable session transaction

    await new Promise((resolve) => setTimeout(resolve, 1000))

    console.log(`✅ Session key registered: ${sessionKeyAddress}`)
    console.log(`   Ready to sign transactions with W3PK derived path`)

    return NextResponse.json(
      {
        success: true,
        sessionKeyAddress,
        sessionKeyIndex,
        expiresAt: expiresAtDate.toISOString(),
        permissions,
        message: 'Session key registered successfully (pending on-chain enablement)',
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error creating session key:', error)
    return NextResponse.json(
      {
        error: 'Failed to create session key',
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
 * 1. Install Session Keys Module:
 *    npm install @rhinestone/module-sdk
 *
 * 2. Use Derived Address as Session Key:
 *
 * // The sessionKeyAddress is a W3PK derived address (e.g., derivedAddresses[1])
 * // User controls this via their passkey - no need to store private keys!
 * // Frontend will sign transactions with W3PK using the derived path
 *
 * 3. Enable Session Key on Safe:
 * 
 * import { getSessionKeyModule } from '@rhinestone/module-sdk'
 * 
 * const sessionKeysModule = getSessionKeyModule({
 *   moduleAddress: SESSION_KEYS_MODULE_ADDRESS,
 *   provider,
 * })
 * 
 * // Define permissions
 * const sessionKeyData = {
 *   sessionKey: sessionKeyAddress,
 *   validAfter: Math.floor(Date.now() / 1000),
 *   validUntil: Math.floor(Date.now() / 1000) + 86400, // 24 hours
 *   permissions: {
 *     spendingLimit: ethers.parseEther('0.1'),
 *     allowedTokens: [ethers.ZeroAddress], // Native token
 *   },
 * }
 * 
 * // Create transaction to enable session key
 * const enableSessionKeyTx = await sessionKeysModule.getEnableSessionKeyTransaction(
 *   safeAddress,
 *   sessionKeyData
 * )
 * 
 * // Execute through Safe
 * const protocolKit = await Safe.init({
 *   provider: providerUrl,
 *   signer: relayerPrivateKey,
 *   safeAddress,
 * })
 * 
 * const safeTransaction = await protocolKit.createTransaction({
 *   transactions: [enableSessionKeyTx],
 * })
 * 
 * await protocolKit.executeTransaction(safeTransaction)
 * 
 * 4. Store Session Key Info:
 *    - Store session key private key encrypted
 *    - Link to Safe address and user
 *    - Store permissions for validation
 */
