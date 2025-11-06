// TODO: remove logging

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { date, browser, status } = await request.json()

    if (!date || !browser || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: date, browser, status' },
        { status: 400 }
      )
    }

    // Create log entry
    const logEntry = `- Date: ${date}\n- Browser: ${browser}\n- Status: ${status}\n\n`

    // Path to logs.md at the root of the project
    const logsPath = path.join(process.cwd(), 'logs.md')

    // Check if logs.md exists, if not create it with header
    try {
      await fs.access(logsPath)
    } catch {
      // File doesn't exist, create it with header
      await fs.writeFile(logsPath, '# w3pk Activity Logs\n\n')
    }

    // Append the log entry
    await fs.appendFile(logsPath, logEntry)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to log activity:', error)
    return NextResponse.json(
      { error: 'Failed to log activity' },
      { status: 500 }
    )
  }
}
