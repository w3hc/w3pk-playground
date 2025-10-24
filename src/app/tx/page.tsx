'use client'

import {
  Container,
  VStack,
  Box,
  Heading,
  Text,
  Button,
  FormControl,
  FormLabel,
  Input,
  HStack,
  Badge,
  useToast,
  Spinner,
  Card,
  CardHeader,
  CardBody,
  IconButton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from '@chakra-ui/react'
import { useW3PK } from '@/context/W3PK'
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { FiSend, FiCopy, FiRefreshCw } from 'react-icons/fi'
import { QRCodeSVG } from 'qrcode.react'
import { TransactionHistory } from '@/components/TransactionHistory'
import { SafeStorage } from '@/lib/safeStorage'
import { useSafeTransactionHistory } from '@/hooks/useSafeTransactionHistory'

interface SessionKey {
  sessionKeyAddress: string
  sessionKeyIndex: number
  expiresAt: string
  permissions: {
    spendingLimit: string
    allowedTokens: string[]
    validAfter: number
    validUntil: number
  }
}

export default function PaymentPage() {
  const { isAuthenticated, user, deriveWallet } = useW3PK()
  const toast = useToast()

  // State
  const [safeAddress, setSafeAddress] = useState<string | null>(null)
  const [safeBalance, setSafeBalance] = useState<string>('0')
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [userAddress, setUserAddress] = useState<string | null>(null)
  const [deploymentBlock, setDeploymentBlock] = useState<number | undefined>(undefined)
  const [isRefetchingAfterConfirmation, setIsRefetchingAfterConfirmation] = useState(false)

  // Send form
  const [recipient, setRecipient] = useState('0x502fb0dFf6A2adbF43468C9888D1A26943eAC6D1')
  const [amount, setAmount] = useState('0.001')

  // Check if session key is expired
  const isSessionKeyExpired = sessionKey
    ? Date.now() > sessionKey.permissions.validUntil * 1000
    : false

  // Load saved Safe data from localStorage
  useEffect(() => {
    if (isAuthenticated && user) {
      const saved = localStorage.getItem(`safe_${user.id}`)
      if (saved) {
        const data = JSON.parse(saved)
        setSafeAddress(data.safeAddress)
        if (data.sessionKey) {
          setSessionKey(data.sessionKey)
        }
      }

      // Get user address and deployment block for transaction history
      ;(async () => {
        const wallet0 = await deriveWallet(0)
        setUserAddress(wallet0.address)

        const safeData = SafeStorage.getSafeData(wallet0.address, 10200)
        if (safeData?.deploymentBlockNumber) {
          setDeploymentBlock(safeData.deploymentBlockNumber)
        }
      })()
    }
  }, [isAuthenticated, user, deriveWallet])

  // Load transaction history from blockchain
  const {
    transactions,
    isLoading: isLoadingTransactions,
    isError: isTransactionError,
    error: transactionError,
    refetch: refetchTransactions,
    lastUpdated: transactionsLastUpdated,
  } = useSafeTransactionHistory({
    safeAddress,
    userAddress,
    chainId: 10200,
    deploymentBlockNumber: deploymentBlock,
    enabled: !!safeAddress && !!userAddress,
  })

  // Load Safe balance
  const loadBalance = useCallback(async () => {
    if (!safeAddress) return
    setIsLoadingBalance(true)

    try {
      const response = await fetch('/api/safe/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          safeAddress,
          chainId: 10200, // Gnosis Chiado
        }),
      })

      const data = await response.json()
      if (data.success) {
        setSafeBalance(data.balance)
      }
    } catch (error) {
      console.error('Error loading balance:', error)
    } finally {
      setIsLoadingBalance(false)
    }
  }, [safeAddress])

  useEffect(() => {
    if (safeAddress) {
      loadBalance()
    }
  }, [safeAddress, loadBalance])

  // Listen for incoming transactions to this Safe address
  useEffect(() => {
    if (!safeAddress || !user) return

    // Connect WebSocket to listen for incoming transactions
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const ws = new WebSocket(`${protocol}//${host}/api/ws/tx-status?recipient=${safeAddress}`)

    ws.onmessage = async event => {
      const update = JSON.parse(event.data)
      console.log('Incoming transaction update:', update)

      if (update.isIncoming) {
        const amountEth = ethers.formatEther(update.amount || '0')

        if (update.status === 'verified') {
          toast({
            title: '✅ Paid!',
            description: `You received ${amountEth} xDAI from ${update.from?.slice(0, 10)}...`,
            status: 'success',
            duration: 5000,
            // containerStyle: {
            //   bg: 'blue.500',
            // },
          })

          // Start showing refetch loader
          setIsRefetchingAfterConfirmation(true)
        } else if (update.status === 'confirmed') {
          toast({
            title: '✅ Settled!',
            description: `${amountEth} xDAI payment settled onchain in ${update.duration?.toFixed(2)}s`,
            status: 'info',
            duration: 8000,
            // containerStyle: {
            //   bg: 'green.500',
            // },
          })

          // Reload transactions after receiving payment (wait for Blockscout indexing)
          setTimeout(() => {
            refetchTransactions().then(() => {
              // Stop showing refetch loader after refetch completes
              setIsRefetchingAfterConfirmation(false)
            })
            loadBalance()
          }, 5000) // Wait 5 seconds for Blockscout to index
        }
      }
    }

    ws.onerror = error => {
      console.error('WebSocket error for incoming transactions:', error)
    }

    ws.onopen = () => {
      console.log('Listening for incoming transactions to:', safeAddress)
    }

    // Cleanup on unmount
    return () => {
      ws.close()
    }
  }, [safeAddress, user, toast, loadBalance, refetchTransactions])

  const sendTransaction = async () => {
    if (!safeAddress || !sessionKey || !recipient || !amount) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields and create a session key first',
        status: 'error',
        duration: 5000,
      })
      return
    }

    if (isSessionKeyExpired) {
      toast({
        title: 'Session Key Expired',
        description: 'Please create a new session key on the /safe page',
        status: 'error',
        duration: 5000,
      })
      return
    }

    setIsSending(true)

    try {
      // Prepare transaction data
      const txData = {
        to: recipient,
        value: ethers.parseEther(amount).toString(),
        data: '0x',
      }

      // Derive the session key wallet to sign the transaction
      const sessionKeyWallet = await deriveWallet(sessionKey.sessionKeyIndex)

      // Sign with the session key's private key
      const message = JSON.stringify(txData)
      const sessionKeySigner = new ethers.Wallet(sessionKeyWallet.privateKey)
      const signature = await sessionKeySigner.signMessage(message)

      // Get derived wallet for userAddress and signing
      const wallet0 = await deriveWallet(0)

      // Try WebSocket mode first, fall back to sync mode
      const response = await fetch('/api/safe/send-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: wallet0.address,
          safeAddress,
          chainId: 10200,
          to: recipient,
          amount: txData.value,
          sessionKeyAddress: sessionKey.sessionKeyAddress,
          sessionKeyValidUntil: sessionKey.permissions.validUntil,
          userPrivateKey: wallet0.privateKey,
          signature,
          useWebSocket: true, // Request WebSocket mode
        }),
      })

      const data = await response.json()

      if (data.success && data.useWebSocket && data.txId) {
        // WebSocket mode - connect for real-time updates
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        const ws = new WebSocket(`${protocol}//${host}/api/ws/tx-status?txId=${data.txId}`)

        ws.onmessage = async event => {
          const update = JSON.parse(event.data)
          console.log('WebSocket update:', update)

          if (update.status === 'verified') {
            toast({
              title: '✅ Sent!',
              description: `Verified in ${update.duration?.toFixed(2)}s`,
              status: 'success',
              duration: 4000,
              // containerStyle: {
              //   bg: 'green.500',
              // },
            })

            // Stop the loading state after verification
            setIsSending(false)

            // Start showing refetch loader
            setIsRefetchingAfterConfirmation(true)
          } else if (update.status === 'confirmed') {
            toast({
              title: '✅ Settled!',
              description: `Settled onchain in ${update.duration?.toFixed(2)}s.\nTx hash: ${update.txHash?.slice(0, 10) || 'N/A'}...`,
              status: 'info',
              duration: 5000,
              // containerStyle: {
              //   bg: 'green.500',
              // },
            })

            // Clear form and reload balance and transactions (wait for Blockscout indexing)
            setRecipient('0x502fb0dFf6A2adbF43468C9888D1A26943eAC6D1')
            setAmount('0.001')
            setTimeout(() => {
              loadBalance()
              refetchTransactions().then(() => {
                // Stop showing refetch loader after refetch completes
                setIsRefetchingAfterConfirmation(false)
              })
            }, 5000) // Wait 5 seconds for Blockscout to index

            // Close WebSocket
            ws.close()
          }
        }

        ws.onerror = error => {
          console.error('WebSocket error:', error)
          toast({
            title: 'Connection Error',
            description: 'Lost connection to transaction status',
            status: 'warning',
            duration: 5000,
          })
          setIsSending(false)
        }

        ws.onclose = () => {
          console.log('WebSocket closed')
        }
      } else if (data.success && data.txHash) {
        // Synchronous mode - transaction already completed
        console.log('Transaction completed synchronously (no WebSocket)')

        // Show completion toasts
        if (data.durations?.verified) {
          toast({
            title: '✅ Sent!',
            description: `Verified in ${data.durations.verified.toFixed(2)}s`,
            status: 'success',
            duration: 4000,
            containerStyle: {
              bg: 'green.500',
            },
          })
        }

        setIsSending(false)

        if (data.durations?.confirmed && data.txHash) {
          toast({
            title: '✅ Settled!',
            description: `Settled onchain in ${data.durations.confirmed.toFixed(2)}s. \nTx hash: ${data.txHash?.slice(0, 10) || 'N/A'}...`,
            status: 'info',
            duration: 5000,
            // containerStyle: {
            //   bg: 'green.500',
            // },
          })
        }

        // Clear form and reload balance and transactions
        setRecipient('0x502fb0dFf6A2adbF43468C9888D1A26943eAC6D1')
        setAmount('0.001')
        setTimeout(() => {
          loadBalance()
          refetchTransactions()
        }, 5000) // Wait 5 seconds for Blockscout to index
      } else {
        throw new Error(data.error || 'Transaction failed')
      }
    } catch (error: any) {
      toast({
        title: 'Transaction Failed',
        description: error.message,
        status: 'error',
        duration: 8000,
      })
      setIsSending(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied!',
      description: 'Address copied to clipboard',
      status: 'success',
      duration: 2000,
    })
  }

  if (!isAuthenticated) {
    return (
      <Container maxW="container.md" py={20}>
        <Box textAlign="center">
          <Heading mb={4}>Please Login</Heading>
          <Text color="gray.400">You need to be authenticated to use payment features</Text>
        </Box>
      </Container>
    )
  }

  if (!safeAddress) {
    return (
      <Container maxW="container.md" py={20}>
        <Box textAlign="center">
          <Heading mb={4}>No Safe Wallet</Heading>
          <Text color="gray.400" mb={6}>
            Please deploy a Safe wallet first on the /safe page
          </Text>
          <Button as="a" href="/safe" colorScheme="purple">
            Go to Safe Dashboard
          </Button>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxW="container.md" py={10}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Box textAlign="center">
          <Heading as="h1" size="xl" mb={2}>
            Payment
          </Heading>
          <Text color="gray.400">Send and receive xDAI</Text>
        </Box>

        {/* Send Block */}
        <Card bg="gray.800" borderColor="gray.700">
          <CardHeader>
            <HStack justify="space-between">
              <Heading size="md">Send xDAI</Heading>
              <HStack>
                <Text fontSize="sm" color="gray.400">
                  Balance:
                </Text>
                {isLoadingBalance ? (
                  <Spinner size="sm" />
                ) : (
                  <HStack spacing={1}>
                    <Text fontFamily="mono" fontWeight="bold">
                      {parseFloat(ethers.formatEther(safeBalance)).toFixed(6)}
                    </Text>
                    <IconButton
                      aria-label="Refresh balance"
                      icon={<FiRefreshCw />}
                      size="xs"
                      variant="ghost"
                      onClick={loadBalance}
                    />
                  </HStack>
                )}
              </HStack>
            </HStack>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              {/* Session Key Status */}
              {sessionKey ? (
                <Box>
                  <HStack justify="space-between" mb={2}>
                    <Text fontSize="sm" color="gray.400">
                      Session Key:
                    </Text>
                    <Badge colorScheme={isSessionKeyExpired ? 'red' : 'green'}>
                      {isSessionKeyExpired ? 'Expired' : 'Active'}
                    </Badge>
                  </HStack>
                  <Text fontSize="sm" color="gray.400">
                    Expires: {new Date(sessionKey.expiresAt).toLocaleString()}
                  </Text>
                  {isSessionKeyExpired && (
                    <Alert status="error" mt={3} borderRadius="md">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Session Key Expired</AlertTitle>
                        <AlertDescription fontSize="sm">
                          Go to /safe to create a new session key
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}
                </Box>
              ) : (
                <Alert status="warning" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>No Session Key</AlertTitle>
                    <AlertDescription fontSize="sm">
                      Create a session key on /safe to send transactions
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              {/* Send Form */}
              <FormControl>
                <FormLabel>Recipient Address</FormLabel>
                <Input
                  placeholder="0x..."
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  fontFamily="mono"
                  isDisabled={!sessionKey || isSessionKeyExpired}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Amount (xDAI)</FormLabel>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  isDisabled={!sessionKey || isSessionKeyExpired}
                />
              </FormControl>

              <Button
                colorScheme="purple"
                size="lg"
                onClick={sendTransaction}
                isLoading={isSending}
                loadingText="Sending..."
                leftIcon={<FiSend />}
                isDisabled={!recipient || !amount || !sessionKey || isSessionKeyExpired}
              >
                Send Transaction (Gasless)
              </Button>

              <Text fontSize="sm" color="gray.500" textAlign="center">
                No gas fees • Powered by session keys
              </Text>
            </VStack>
          </CardBody>
        </Card>

        {/* Receive Block */}
        <Card bg="gray.800" borderColor="gray.700">
          <CardHeader>
            <Heading size="md">Receive xDAI</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Text color="gray.400" fontSize="sm">
                Send xDAI to your Safe wallet address:
              </Text>

              {/* QR Code */}
              <Box bg="white" p={4} borderRadius="md" alignSelf="center">
                <QRCodeSVG value={safeAddress} size={200} level="H" />
              </Box>

              {/* Address */}
              <Box>
                <Text fontSize="sm" color="gray.400" mb={2}>
                  Safe Address:
                </Text>
                <HStack>
                  <Input
                    value={safeAddress}
                    isReadOnly
                    fontFamily="mono"
                    fontSize="sm"
                    bg="gray.900"
                  />
                  <IconButton
                    aria-label="Copy address"
                    icon={<FiCopy />}
                    onClick={() => copyToClipboard(safeAddress)}
                    colorScheme="purple"
                    variant="outline"
                  />
                </HStack>
              </Box>

              <Text fontSize="sm" color="gray.500" textAlign="center">
                Scan QR code or copy address to receive funds
              </Text>
            </VStack>
          </CardBody>
        </Card>

        {/* Transaction History */}
        <TransactionHistory
          transactions={transactions}
          isLoading={isLoadingTransactions}
          isError={isTransactionError}
          error={transactionError}
          onRefresh={refetchTransactions}
          safeAddress={safeAddress}
          lastUpdated={transactionsLastUpdated}
          isRefetchingAfterConfirmation={isRefetchingAfterConfirmation}
        />

        {/* Quick Link */}
        <Box textAlign="center">
          <Button as="a" href="/safe" variant="link" size="sm" color="gray.500">
            Go to Safe Dashboard →
          </Button>
        </Box>
      </VStack>
    </Container>
  )
}
