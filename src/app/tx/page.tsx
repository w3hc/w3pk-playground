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
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { FiSend, FiCopy, FiRefreshCw } from 'react-icons/fi'
import { QRCodeSVG } from 'qrcode.react'

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
  const { isAuthenticated, user, deriveWallet, signMessage } = useW3PK()
  const toast = useToast()

  // State
  const [safeAddress, setSafeAddress] = useState<string | null>(null)
  const [safeBalance, setSafeBalance] = useState<string>('0')
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [isSending, setIsSending] = useState(false)

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
    }
  }, [isAuthenticated, user])

  // Load Safe balance
  useEffect(() => {
    if (safeAddress) {
      loadBalance()
    }
  }, [safeAddress])

  const loadBalance = async () => {
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
  }

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

      // Get derived addresses for userAddress
      const wallet0 = await deriveWallet(0)

      // Send to backend
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
          signature,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Transaction Sent!',
          description: `Tx: ${data.txHash.slice(0, 20)}...`,
          status: 'success',
          duration: 10000,
        })

        // Clear form
        setRecipient('0x502fb0dFf6A2adbF43468C9888D1A26943eAC6D1')
        setAmount('0.001')

        // Reload balance
        setTimeout(() => loadBalance(), 3000)
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
    } finally {
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
                  onChange={(e) => setRecipient(e.target.value)}
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
                  onChange={(e) => setAmount(e.target.value)}
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
