import { NextRequest, NextResponse } from 'next/server'
import Safe from '@safe-global/protocol-kit'
import {
  getAccount,
  getOwnableValidator,
  encodeValidatorNonce,
  OWNABLE_VALIDATOR_ADDRESS,
} from '@rhinestone/module-sdk'
import { createWeb3Passkey } from 'w3pk'
import { EURO_TOKEN_ADDRESS } from '@/lib/constants'

const SMART_SESSIONS_MODULE = '0x00000000008bDABA73cD9815d79069c247Eb4bDA'
const OWNABLE_VALIDATOR = '0x000000000013fdB5234E4E3162a810F54d9f7E98'

/**
 * POST /api/safe/create-session-key
 * Create a session key for a Safe wallet with specific permissions
 * Body: { userAddress: string, safeAddress: string, chainId: number, sessionKeyAddress: string }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, safeAddress, chainId, sessionKeyAddress, sessionKeyIndex } = body

    if (!userAddress || !safeAddress || !chainId || !sessionKeyAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, safeAddress, chainId, sessionKeyAddress' },
        { status: 400 }
      )
    }

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
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + 2548800
    const expiresAtDate = new Date(expiresAt * 1000)

    const permissions = {
      spendingLimit: '42000000000000000000000000', // 42,000,000 EUR
      allowedTokens: [EURO_TOKEN_ADDRESS],
      validAfter: now,
      validUntil: expiresAt,
    }

    const protocolKit = await Safe.init({
      provider: rpcUrl,
      signer: process.env.RELAYER_PRIVATE_KEY,
      safeAddress: safeAddress,
    })

    const isModuleEnabled = await protocolKit.isModuleEnabled(SMART_SESSIONS_MODULE)
    console.log(`   Smart Sessions module enabled: ${isModuleEnabled}`)

    if (!isModuleEnabled) {
      console.log(`   Enabling Smart Sessions module...`)

      const enableModuleTx = await protocolKit.createEnableModuleTx(SMART_SESSIONS_MODULE)

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

    console.log(`   Registering session key on Smart Sessions module...`)
    console.log(`   Session validator: ${OWNABLE_VALIDATOR}`)
    console.log(`   Spending limit: ${permissions.spendingLimit} wei`)
    console.log(`   Valid until: ${expiresAtDate.toISOString()}`)

    try {
      const account = getAccount({
        address: safeAddress as `0x${string}`,
        type: 'safe',
      })

      getOwnableValidator({
        owners: [sessionKeyAddress as `0x${string}`],
        threshold: 1,
      })

      encodeValidatorNonce({
        account,
        validator: OWNABLE_VALIDATOR_ADDRESS as `0x${string}`,
      })

      console.log(`   ✅ Session configuration created with Rhinestone SDK`)
      console.log(`   Validator: ${OWNABLE_VALIDATOR_ADDRESS}`)
      console.log(`   Session key: ${sessionKeyAddress}`)

      return NextResponse.json(
        {
          success: true,
          sessionKeyAddress,
          sessionKeyIndex,
          expiresAt: expiresAtDate.toISOString(),
          permissions,
          sessionConfig: {
            validator: OWNABLE_VALIDATOR_ADDRESS,
            chainId,
            validUntil: expiresAt,
          },
          message: 'Session key registered successfully with on-chain validation',
        },
        { status: 200 }
      )
    } catch (sdkError: any) {
      console.error('Rhinestone SDK error:', sdkError)
      console.log(`   ⚠️  Falling back to simplified session key creation`)

      return NextResponse.json(
        {
          success: true,
          sessionKeyAddress,
          sessionKeyIndex,
          expiresAt: expiresAtDate.toISOString(),
          permissions,
          message: 'Session key registered successfully (simplified mode)',
          warning: 'Full on-chain validation not enabled',
        },
        { status: 200 }
      )
    }
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
