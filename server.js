const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { WebSocketServer } = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Store active WebSocket connections by transaction ID
const connections = new Map()

// Store active WebSocket connections by recipient address (for receiving notifications)
const recipientConnections = new Map()

// Make connections available globally for API routes
global.wsConnections = connections
global.wsRecipientConnections = recipientConnections

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Create WebSocket server for transaction status
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (ws, request) => {
    const url = parse(request.url, true)
    const txId = url.query.txId
    const recipientAddress = url.query.recipient

    if (txId) {
      // Sender connection - tracking specific transaction
      console.log(`WebSocket connected for transaction: ${txId}`)
      connections.set(txId, ws)

      ws.on('close', () => {
        console.log(`WebSocket closed for transaction: ${txId}`)
        connections.delete(txId)
      })

      ws.on('error', error => {
        console.error(`WebSocket error for transaction ${txId}:`, error)
        connections.delete(txId)
      })
    } else if (recipientAddress) {
      // Receiver connection - listening for incoming transactions
      const normalizedAddress = recipientAddress.toLowerCase()
      console.log(`WebSocket connected for recipient: ${normalizedAddress}`)

      // Store in a Set to allow multiple connections per address
      if (!recipientConnections.has(normalizedAddress)) {
        recipientConnections.set(normalizedAddress, new Set())
      }
      recipientConnections.get(normalizedAddress).add(ws)

      ws.on('close', () => {
        console.log(`WebSocket closed for recipient: ${normalizedAddress}`)
        const wsSet = recipientConnections.get(normalizedAddress)
        if (wsSet) {
          wsSet.delete(ws)
          if (wsSet.size === 0) {
            recipientConnections.delete(normalizedAddress)
          }
        }
      })

      ws.on('error', error => {
        console.error(`WebSocket error for recipient ${normalizedAddress}:`, error)
        const wsSet = recipientConnections.get(normalizedAddress)
        if (wsSet) {
          wsSet.delete(ws)
          if (wsSet.size === 0) {
            recipientConnections.delete(normalizedAddress)
          }
        }
      })
    }
  })

  // Handle WebSocket upgrade requests
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url)

    // Only handle our custom transaction status WebSocket
    if (pathname === '/api/ws/tx-status') {
      wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request)
      })
    }
    // For all other WebSocket requests (including HMR), we need to pass them through
    // In dev mode, Next.js doesn't expose its WebSocket server, so HMR won't work with custom server
    // This is a known limitation - we'll document it
  })

  server.listen(port, err => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> WebSocket server ready on ws://${hostname}:${port}/api/ws/tx-status`)
    if (dev) {
      console.log(`> Note: Hot Module Replacement (HMR) is not available with custom server`)
      console.log(`> You'll need to refresh the page manually to see changes`)
    }
  })
})
