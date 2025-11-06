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

    // Create log entry
    const logEntry = `- Date: ${dateTimeString}\n- Browser: ${browserString}\n- Status: ${message}\n\n`

    // Store in localStorage to persist across sessions
    const existingLogs = localStorage.getItem('w3pk_activity_logs') || ''
    const updatedLogs = existingLogs + logEntry
    localStorage.setItem('w3pk_activity_logs', updatedLogs)

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
      // Continue anyway - we still have localStorage
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

/**
 * Gets all logged activities from localStorage
 */
export function getActivityLogs(): string {
  return localStorage.getItem('w3pk_activity_logs') || ''
}

/**
 * Clears all logged activities
 */
export function clearActivityLogs(): void {
  localStorage.removeItem('w3pk_activity_logs')
}

/**
 * Downloads the logs as a markdown file
 */
export function downloadLogsAsMarkdown(): void {
  const logs = getActivityLogs()

  if (!logs) {
    console.warn('No logs to download')
    return
  }

  const content = `# w3pk Activity Logs\n\n${logs}`
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = 'logs.md'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
