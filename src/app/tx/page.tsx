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
  Tooltip,
  Card,
  CardHeader,
  CardBody,
  IconButton,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
} from '@chakra-ui/react'
import { useW3PK } from '@/context/W3PK'
import { useState, useEffect, useCallback, useRef } from 'react'
import { ethers } from 'ethers'
import { FiSend, FiCopy, FiRefreshCw } from 'react-icons/fi'
import { QRCodeSVG } from 'qrcode.react'
import { TransactionHistory } from '@/components/TransactionHistory'
import { SafeStorage, Transaction } from '@/lib/safeStorage'
import { useSafeTransactionHistory } from '@/hooks/useSafeTransactionHistory'
import { EURO_TOKEN_ADDRESS, ERC20_ABI } from '@/lib/constants'
import { FaSatellite, FaQrcode } from 'react-icons/fa'

import {
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from '@chakra-ui/react'

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
  const [isCooldown, setIsCooldown] = useState(false)
  const cooldownTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [userAddress, setUserAddress] = useState<string | null>(null)
  const [deploymentBlock, setDeploymentBlock] = useState<number | undefined>(undefined)
  const [isRefetchingAfterConfirmation, setIsRefetchingAfterConfirmation] = useState(false)
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([])
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const insufficientBalanceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [recipient, setRecipient] = useState('0x502fb0dFf6A2adbF43468C9888D1A26943eAC6D1')
  const [amount, setAmount] = useState('1')
  const [paymentRequestDetected, setPaymentRequestDetected] = useState(false)

  const {
    isOpen: isRequestModalOpen,
    onOpen: onRequestModalOpen,
    onClose: onRequestModalClose,
  } = useDisclosure()
  const [requestAmount, setRequestAmount] = useState<string>('')
  const [isQRGenerated, setIsQRGenerated] = useState<boolean>(false)
  const [qrData, setQrData] = useState<string>('')

  const isWebNFCSupported = typeof window !== 'undefined' && 'nfc' in navigator

  const writeNFC = async (url: string) => {
    if (!isWebNFCSupported) {
      toast({
        title: 'NFC Not Available',
        description: 'NFC writing is only supported on Android with Chrome.',
        status: 'warning',
        duration: 4000,
      })
      return
    }

    try {
      // Cast to any because NDEFWriter isn't in TypeScript DOM lib yet
      const NDEFWriter = (window as any).NDEFWriter
      if (!NDEFWriter) {
        throw new Error('NDEFWriter not available')
      }

      const writer = new NDEFWriter()
      await writer.write({
        records: [{ recordType: 'url', url }],
      })

      toast({
        title: '✅ NFC Written!',
        description: 'Hold the tag near your phone to pay.',
        status: 'success',
        duration: 3000,
      })
    } catch (error: any) {
      console.error('NFC write failed:', error)
      let message = error.message || 'Failed to write to NFC tag.'

      if (message.includes('aborted')) {
        message = 'Operation canceled.'
      } else if (message.includes('no tag')) {
        message = 'No NFC tag detected. Try again.'
      }

      toast({
        title: 'NFC Write Failed',
        description: message,
        status: 'error',
        duration: 5000,
      })
    }
  }

  // Check if session key is expired
  const isSessionKeyExpired = sessionKey
    ? Date.now() > sessionKey.permissions.validUntil * 1000
    : false

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current)
      }
    }
  }, [])

  // Load saved Safe data from localStorage
  useEffect(() => {
    if (isAuthenticated && user && user.ethereumAddress) {
      const saved = localStorage.getItem(`safe_${user.id}`)
      if (saved) {
        const data = JSON.parse(saved)
        setSafeAddress(data.safeAddress)
        if (data.sessionKey) {
          setSessionKey(data.sessionKey)
        }
      }

      // Using user.ethereumAddress directly
      const userAddr = user.ethereumAddress
      setUserAddress(userAddr)

      const safeData = SafeStorage.getSafeData(userAddr, 10200)
      if (safeData?.deploymentBlockNumber) {
        setDeploymentBlock(safeData.deploymentBlockNumber)
      }
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    return () => {
      if (insufficientBalanceTimeoutRef.current) {
        clearTimeout(insufficientBalanceTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const urlParams = new URLSearchParams(window.location.search)
    const recipientParam = urlParams.get('recipient')
    const valueParam = urlParams.get('value')
    const tokenParam = urlParams.get('token')

    if (
      recipientParam &&
      valueParam &&
      tokenParam &&
      ethers.isAddress(recipientParam) &&
      !isNaN(Number(valueParam)) &&
      ethers.isAddress(tokenParam) &&
      tokenParam.toLowerCase() === EURO_TOKEN_ADDRESS.toLowerCase()
    ) {
      try {
        const amountInEth = ethers.formatEther(valueParam)
        setRecipient(recipientParam)
        setAmount(amountInEth)
        setPaymentRequestDetected(true)

        if (window.history && window.history.replaceState) {
          const cleanUrl = window.location.pathname
          window.history.replaceState({}, '', cleanUrl)
        }
      } catch (e) {
        console.warn('Invalid value parameter:', valueParam)
      }
    }
  }, [])

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

  const updateBalanceOptimistically = useCallback((deltaWei: string) => {
    setSafeBalance(prev => {
      const prevBN = ethers.getBigInt(prev || '0')
      const deltaBN = ethers.getBigInt(deltaWei)
      const newBalance = prevBN + deltaBN
      return newBalance.toString()
    })
  }, [])

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

        // Check if this is a self-send (sender is also the Safe address)
        const isSelfSend = update.from?.toLowerCase() === safeAddress.toLowerCase()

        if (update.status === 'verified') {
          // Skip adding to pending if it's a self-send (already added by outgoing WebSocket)
          if (!isSelfSend) {
            toast({
              title: '✅ Paid!',
              description: `You received ${amountEth} EUR from ${update.from?.slice(0, 10)}...`,
              status: 'success',
              duration: 5000,
              // containerStyle: {
              //   bg: 'blue.500',
              // },
            })

            // Optimistically increase balance
            const incomingAmount = update.amount || '0'
            updateBalanceOptimistically(incomingAmount)
            // Create a transaction history item with 'verified' status for the receiver
            const newIncomingTransaction: Transaction = {
              txId: `incoming-${Date.now()}`, // Temporary ID until we get the real tx hash
              txHash: update.txHash || undefined,
              from: update.from || '',
              to: safeAddress,
              amount: update.amount || '0',
              timestamp: Date.now(),
              status: 'verified',
              direction: 'incoming',
              duration: update.duration,
            }

            setPendingTransactions(prev => [newIncomingTransaction, ...prev])
          }

          // Start showing refetch loader (only for non-self-sends, as self-sends are handled by outgoing)
          if (!isSelfSend) {
            setIsRefetchingAfterConfirmation(true)
          }
        } else if (update.status === 'confirmed') {
          // Skip processing if it's a self-send (already handled by outgoing WebSocket)
          if (!isSelfSend) {
            // toast({
            //   title: '✅ Settled!',
            //   description: `${amountEth} EUR payment settled onchain in ${update.duration?.toFixed(2)}s`,
            //   status: 'info',
            //   duration: 8000,
            //   // containerStyle: {
            //   //   bg: 'green.500',
            //   // },
            // })

            // Update the pending transaction to 'confirmed' status
            setPendingTransactions(prev =>
              prev.map(tx =>
                tx.direction === 'incoming' && tx.status === 'verified'
                  ? {
                      ...tx,
                      status: 'confirmed',
                      txHash: update.txHash || tx.txHash,
                      duration: update.duration,
                    }
                  : tx
              )
            )

            // Reload transactions after receiving payment (wait for Blockscout indexing)
            setTimeout(() => {
              refetchTransactions().then(() => {
                // Stop showing refetch loader after refetch completes
                setIsRefetchingAfterConfirmation(false)
                // Remove the pending incoming transaction once it's fetched from blockchain
                setPendingTransactions(prev =>
                  prev.filter(tx => !(tx.direction === 'incoming' && tx.status === 'confirmed'))
                )
              })
              loadBalance()
            }, 5000) // Wait 5 seconds for Blockscout to index
          }
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

  const getTxBaseUrl = () => {
    if (typeof window === 'undefined') return 'https://w3pk.w3hc.org/tx/'

    // Check if we're in development (localhost)
    if (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.port === '3000'
    ) {
      return 'http://localhost:3000/tx/'
    }

    // Otherwise, assume production
    return 'https://w3pk.w3hc.org/tx/'
  }

  const generatePaymentRequestUrl = (
    recipient: string,
    amountInWei: string,
    tokenAddress: string
  ) => {
    const baseUrl = getTxBaseUrl()
    const params = new URLSearchParams({
      recipient,
      value: amountInWei,
      token: tokenAddress,
    })
    return `${baseUrl}?${params.toString()}`
  }

  const sendTransaction = async () => {
    if (isCooldown) {
      toast({
        title: 'Please wait',
        description:
          'A transaction is already being processed or recently sent. Please wait before sending another.',
        status: 'info',
        duration: 3000,
        isClosable: true,
      })
      return
    }

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

    const transferAmount = ethers.parseEther(amount)
    const balanceBN = ethers.getBigInt(safeBalance || '0')
    if (transferAmount > balanceBN) {
      setInsufficientBalance(true)

      if (insufficientBalanceTimeoutRef.current) {
        clearTimeout(insufficientBalanceTimeoutRef.current)
      }

      insufficientBalanceTimeoutRef.current = setTimeout(() => {
        setInsufficientBalance(false)
        insufficientBalanceTimeoutRef.current = null
      }, 5000)

      return
    }

    setIsSending(true)
    setIsCooldown(true)

    if (cooldownTimeoutRef.current) {
      clearTimeout(cooldownTimeoutRef.current)
    }

    cooldownTimeoutRef.current = setTimeout(() => {
      setIsCooldown(false)
      cooldownTimeoutRef.current = null
    }, 3000)

    try {
      // Encode ERC-20 transfer function call
      const erc20Interface = new ethers.Interface(ERC20_ABI)
      const transferAmount = ethers.parseEther(amount).toString()
      const transferData = erc20Interface.encodeFunctionData('transfer', [
        recipient,
        transferAmount,
      ])

      // Prepare transaction data (must match backend format for signature verification)
      const txData = {
        to: EURO_TOKEN_ADDRESS, // Transaction goes to token contract
        value: '0', // No native currency transfer
        data: transferData, // ERC-20 transfer call
      }

      // Derive the session key wallet to sign the transaction
      const sessionKeyWallet = await deriveWallet(sessionKey.sessionKeyIndex)

      if (!sessionKeyWallet.privateKey) {
        throw new Error('Session key private key not available')
      }

      // Sign with the session key's private key
      const message = JSON.stringify(txData)
      const sessionKeySigner = new ethers.Wallet(sessionKeyWallet.privateKey)
      const signature = await sessionKeySigner.signMessage(message)

      // Get derived wallet for userAddress and signing
      const wallet0 = await deriveWallet(0)

      if (!wallet0.privateKey) {
        throw new Error('Owner wallet private key not available')
      }

      // Try WebSocket mode first, fall back to sync mode
      const response = await fetch('/api/safe/send-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: wallet0.address,
          safeAddress,
          chainId: 10200,
          to: recipient,
          amount: transferAmount, // Send the EUR token amount
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

            // Optimistically reduce balance
            const transferAmount = ethers.parseEther(amount).toString()
            updateBalanceOptimistically(`-${transferAmount}`)
            setPaymentRequestDetected(false)
            setRecipient('0x502fb0dFf6A2adbF43468C9888D1A26943eAC6D1')
            setAmount('1')

            // Create a transaction history item with 'verified' status
            const newTransaction: Transaction = {
              txId: data.txId,
              txHash: update.txHash || undefined,
              from: ethers.getAddress(safeAddress),
              to: ethers.getAddress(recipient),
              amount: transferAmount,
              timestamp: Date.now(),
              status: 'verified',
              direction: 'outgoing',
              duration: update.duration,
              sessionKeyAddress: sessionKey.sessionKeyAddress,
            }

            setPendingTransactions(prev => [newTransaction, ...prev])

            // Stop the loading state after verification
            setIsSending(false)

            // Start showing refetch loader
            setIsRefetchingAfterConfirmation(true)
          } else if (update.status === 'confirmed') {
            // toast({
            //   title: '✅ Settled!',
            //   description: `Settled onchain in ${update.duration?.toFixed(2)}s.\nTx hash: ${update.txHash?.slice(0, 10) || 'N/A'}...`,
            //   status: 'info',
            //   duration: 5000,
            //   // containerStyle: {
            //   //   bg: 'green.500',
            //   // },
            // })

            // Update the pending transaction to 'confirmed' status
            setPendingTransactions(prev =>
              prev.map(tx =>
                tx.txId === data.txId
                  ? {
                      ...tx,
                      status: 'confirmed',
                      txHash: update.txHash || tx.txHash,
                      duration: update.duration,
                    }
                  : tx
              )
            )

            // Clear form and reload balance and transactions (wait for Blockscout indexing)
            setRecipient('0x502fb0dFf6A2adbF43468C9888D1A26943eAC6D1')
            setAmount('1')
            setPaymentRequestDetected(false)
            setTimeout(() => {
              loadBalance()
              refetchTransactions().then(() => {
                // Stop showing refetch loader after refetch completes
                setIsRefetchingAfterConfirmation(false)
                // Remove the transaction from pending once it's on blockchain
                setPendingTransactions(prev => prev.filter(tx => tx.txId !== data.txId))
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
          // toast({
          //   title: '✅ Settled!',
          //   description: `Settled onchain in ${data.durations.confirmed.toFixed(2)}s. \nTx hash: ${data.txHash?.slice(0, 10) || 'N/A'}...`,
          //   status: 'info',
          //   duration: 5000,
          //   // containerStyle: {
          //   //   bg: 'green.500',
          //   // },
          // })
        }

        // Clear form and reload balance and transactions
        setRecipient('0x502fb0dFf6A2adbF43468C9888D1A26943eAC6D1')
        setAmount('1')
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
      setPaymentRequestDetected(false)
      setRecipient('0x502fb0dFf6A2adbF43468C9888D1A26943eAC6D1')
      setAmount('1')
    }
  }

  const handleRequestPayment = () => {
    if (!safeAddress || !requestAmount) return

    try {
      const amountInWei = ethers.parseEther(requestAmount).toString()
      const paymentUrl = generatePaymentRequestUrl(safeAddress, amountInWei, EURO_TOKEN_ADDRESS)

      setQrData(paymentUrl)
      setIsQRGenerated(true)
    } catch (error) {
      console.error('Error generating QR data:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate QR code data.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    }
  }

  const handleRequestModalClose = () => {
    setRequestAmount('')
    setIsQRGenerated(false)
    setQrData('')
    onRequestModalClose()
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
          <Text color="gray.400">Send and receive EUR</Text>
        </Box>

        {/* Send Block */}
        <Card bg="gray.800" borderColor="gray.700">
          <CardHeader>
            <HStack justify="space-between">
              <Heading size="md">Send EUR</Heading>
              <HStack>
                <Text fontSize="sm" color="gray.400">
                  Balance:
                </Text>
                {isLoadingBalance ? (
                  <HStack spacing={1}>
                    <Text fontFamily="mono" fontWeight="bold">
                      {parseFloat(ethers.formatEther(safeBalance)).toFixed(2)}
                    </Text>
                    <IconButton
                      aria-label="Refresh balance"
                      icon={<FiRefreshCw />}
                      size="xs"
                      variant="ghost"
                    />
                  </HStack>
                ) : (
                  <HStack spacing={1}>
                    <Text fontFamily="mono" fontWeight="bold">
                      {parseFloat(ethers.formatEther(safeBalance)).toFixed(2)}
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
                  isDisabled={!sessionKey || isSessionKeyExpired || isSending || isCooldown}
                />
              </FormControl>

              <FormControl>
                <FormLabel>Amount (EUR)</FormLabel>
                <NumberInput
                  value={amount}
                  onChange={setAmount}
                  min={0}
                  precision={2}
                  step={0.001}
                  isDisabled={!sessionKey || isSessionKeyExpired || isSending || isCooldown}
                >
                  <NumberInputField
                    type="text"
                    placeholder="1"
                    fontFamily="mono"
                    onWheel={e => e.currentTarget.blur()}
                  />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                {paymentRequestDetected && (
                  <Text mt={3} fontSize="md" color="red">
                    Incoming payment request detected. Would you like to proceed?
                  </Text>
                )}
              </FormControl>

              <HStack spacing={4}>
                <Button
                  colorScheme="purple"
                  size="lg"
                  onClick={sendTransaction}
                  isLoading={isSending}
                  loadingText="Sending..."
                  leftIcon={<FiSend />}
                  isDisabled={
                    !recipient || !amount || !sessionKey || isSessionKeyExpired || isCooldown
                  }
                >
                  Send
                </Button>
                {!paymentRequestDetected && (
                  <Button
                    colorScheme="blue"
                    variant="outline"
                    size="sm"
                    onClick={onRequestModalOpen}
                    isDisabled={!sessionKey || isSessionKeyExpired || isSending || isCooldown}
                  >
                    Request Payment
                  </Button>
                )}
              </HStack>

              {insufficientBalance && (
                <Text fontSize="2xs" color="red">
                  Insufficient balance
                </Text>
              )}
            </VStack>
          </CardBody>
        </Card>

        {/* Receive Block */}
        <Card bg="gray.800" borderColor="gray.700">
          <CardHeader>
            <Heading size="md">Receive EUR</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <Text color="gray.400" fontSize="sm">
                Send EUR to your Safe wallet address:
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
          transactions={[...pendingTransactions, ...transactions]}
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

      <Modal isOpen={isRequestModalOpen} onClose={handleRequestModalClose}>
        <ModalOverlay />
        <ModalContent bg="gray.800" borderColor="gray.700" color="white">
          <ModalHeader>Request Payment</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {!isQRGenerated ? (
              <FormControl isRequired>
                <FormLabel>Amount to Request (EUR)</FormLabel>
                <NumberInput
                  value={requestAmount}
                  onChange={setRequestAmount}
                  min={0}
                  precision={2}
                  step={0.001}
                >
                  <NumberInputField
                    type="text"
                    placeholder="0.00"
                    fontFamily="mono"
                    onWheel={e => e.currentTarget.blur()}
                  />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <FormLabel mt={2}>Token: EUR</FormLabel>
              </FormControl>
            ) : (
              <VStack spacing={4} align="center">
                <Text textAlign="center">Scan this QR code to send payment</Text>
                {qrData ? (
                  <Box p={4} bg="white" borderRadius="md">
                    <QRCodeSVG value={qrData} size={200} />
                  </Box>
                ) : (
                  <Text>Loading QR code...</Text>
                )}
                <Text textAlign="center" fontSize="sm" color="gray.400" wordBreak="break-all">
                  {qrData}
                </Text>
              </VStack>
            )}
          </ModalBody>

          <ModalFooter>
            {!isQRGenerated ? (
              <>
                <Button
                  colorScheme="blue"
                  mr={3}
                  onClick={handleRequestPayment}
                  isDisabled={!requestAmount || parseFloat(requestAmount) <= 0}
                  leftIcon={<FaQrcode />}
                >
                  Generate QR
                </Button>

                {isWebNFCSupported ? (
                  <Button
                    colorScheme="green"
                    mr={3}
                    leftIcon={<FaSatellite />}
                    onClick={() => {
                      if (!safeAddress || !requestAmount) return
                      try {
                        const amountInWei = ethers.parseEther(requestAmount).toString()
                        const paymentUrl = generatePaymentRequestUrl(
                          safeAddress,
                          amountInWei,
                          EURO_TOKEN_ADDRESS
                        )
                        writeNFC(paymentUrl)
                      } catch (err) {
                        toast({
                          title: 'Invalid Amount',
                          description: 'Please enter a valid EUR amount.',
                          status: 'error',
                          duration: 3000,
                        })
                      }
                    }}
                    isDisabled={!requestAmount || parseFloat(requestAmount) <= 0}
                  >
                    Write to NFC
                  </Button>
                ) : (
                  <Tooltip
                    label="NFC writing is only available on Android (Chrome)"
                    fontSize="sm"
                    hasArrow
                  >
                    <Button isDisabled colorScheme="gray">
                      NFC Not Available
                    </Button>
                  </Tooltip>
                )}

                <Button variant="ghost" onClick={handleRequestModalClose}>
                  Close
                </Button>
              </>
            ) : (
              <Button colorScheme="purple" onClick={handleRequestModalClose}>
                Close
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  )
}
