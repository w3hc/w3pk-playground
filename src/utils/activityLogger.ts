/**
 * Activity logger for w3pk authentication events
 * Logs registration, login, and error events to logs.md
 */

// TODO: remove logging

import { detectBrowser } from './browserDetection'

export type ActivityType = 'register' | 'login' | 'error'

export interface ActivityLog {
  date: string
  browser: string
  type: ActivityType
  message: string
}

/**
 * Logs an activity to the logs.md file
 */
export async function logActivity(
  type: ActivityType,
  errorMessage?: string
): Promise<void> {
  try {
    const browserInfo = detectBrowser()
    const now = new Date()

    // Format date as "Nov 6, 2025 at 02:15:01 UTC"
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    })

    const dateTimeString = `${formattedDate} at ${formattedTime} UTC`

    // Format browser string
    const browserString = `${browserInfo.name} v${browserInfo.version}`

    // Determine the message based on type
    let message: string
    switch (type) {
      case 'register':
        message = 'Successful Register'
        break
      case 'login':
        message = 'Successful Login'
        break
      case 'error':
        message = `Error: "${errorMessage || 'Unknown error'}"`
        break
      default:
        message = 'Unknown activity'
    }

    // Send to server-side API to append to logs.md
    try {
      await fetch('/api/log-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: dateTimeString,
          browser: browserString,
          status: message,
        }),
      })
    } catch (apiError) {
      console.error('Failed to send log to server:', apiError)
    }

    // Also log to console for debugging
    console.log('[Activity Log]', {
      date: dateTimeString,
      browser: browserString,
      type,
      message,
    })
  } catch (error) {
    console.error('Failed to log activity:', error)
  }
}

