// app/api/debug/route.ts

// TODO: remove logging

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Ensure the request is a POST
    if (req.method !== 'POST') {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
    }

    // Parse the JSON body containing the debug data
    const debugData = await req.json()

    // --- Server-side logging ---
    console.log('\n--- DEBUG INFO RECEIVED FROM CLIENT ---')
    console.log('Timestamp:', new Date().toISOString())
    console.log('Username:', debugData.username)
    console.log('Username length:', debugData.username?.length)
    console.log('w3pk Version (Client Context):', debugData.w3pkVersion || 'Unknown')
    console.log('Browser Info (User Agent):', req.headers.get('user-agent') || 'Unknown')
    console.log('Raw Challenge Sent (first 50 chars):', debugData.challenge?.substring(0, 50))
    console.log('Raw Challenge Length:', debugData.challenge?.length)
    console.log('Raw Credential ID (first 50 chars):', debugData.credentialId?.substring(0, 50))
    console.log('Raw Credential ID Length:', debugData.credentialId?.length)
    console.log(
      'Raw Attestation Object (first 100 chars):',
      debugData.attestationObject?.substring(0, 100)
    )
    console.log('Raw Attestation Object Length:', debugData.attestationObject?.length)
    console.log(
      'Raw Attestation Object (last 100 chars):',
      debugData.attestationObject ? debugData.attestationObject.slice(-100) : 'N/A'
    )
    console.log(
      'Raw Client Data JSON (first 100 chars):',
      debugData.clientDataJSON?.substring(0, 100)
    )
    console.log('Raw Client Data JSON Length:', debugData.clientDataJSON?.length)
    console.log('Error Message (if any):', debugData.error?.message || 'None')
    console.log('Error Name (if any):', debugData.error?.name || 'None')
    console.log('Error Stack (if any):', debugData.error?.stack || 'None')
    console.log('----------------------------------------\n')

    // Optional: Validate the received data structure if needed
    // if (!debugData.username || typeof debugData.username !== 'string') {
    //   return NextResponse.json({ error: 'Invalid debug data: username missing or invalid' }, { status: 400 });
    // }

    // Respond successfully to the client
    return NextResponse.json({ message: 'Debug info received and logged on server' })
  } catch (error) {
    console.error('[API:debug] Error processing debug info:', error)
    return NextResponse.json({ error: 'Failed to process debug info' }, { status: 500 })
  }
}
