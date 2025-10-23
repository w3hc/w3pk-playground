// Send status update to a specific transaction's WebSocket connection
export function sendTransactionStatus(
  txId: string,
  status: 'started' | 'verified' | 'confirmed',
  data: {
    timestamp: number
    duration?: number
    txHash?: string
    message?: string
    recipientAddress?: string
    from?: string
    amount?: string
  }
) {
  // Access global connections map set by server.js
  const connectionsMap = (global as any).wsConnections

  if (!connectionsMap) {
    console.warn('WebSocket connections map not initialized')
    return
  }

  const payload = {
    status,
    ...data,
  }

  // Send to sender (transaction initiator)
  const ws = connectionsMap.get(txId)
  if (ws && ws.readyState === 1) {
    // 1 = WebSocket.OPEN
    ws.send(JSON.stringify(payload))
    console.log(`Sent status '${status}' to transaction ${txId}`)
  } else {
    console.log(`No active WebSocket for transaction ${txId}`)
  }

  // Send to recipient if address is provided
  if (data.recipientAddress) {
    const recipientConnectionsMap = (global as any).wsRecipientConnections
    if (recipientConnectionsMap) {
      const normalizedAddress = data.recipientAddress.toLowerCase()
      const recipientWsSet = recipientConnectionsMap.get(normalizedAddress)

      if (recipientWsSet && recipientWsSet.size > 0) {
        let sentCount = 0
        recipientWsSet.forEach((recipientWs: any) => {
          if (recipientWs.readyState === 1) {
            recipientWs.send(
              JSON.stringify({
                ...payload,
                isIncoming: true, // Flag to indicate this is an incoming transaction
              })
            )
            sentCount++
          }
        })
        if (sentCount > 0) {
          console.log(
            `Sent status '${status}' to ${sentCount} recipient(s) at ${normalizedAddress}`
          )
        }
      }
    }
  }
}
