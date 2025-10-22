'use client'

import {
  Container,
  VStack,
  Heading,
  Text,
  Button,
  Box,
  useToast,
  Divider,
  HStack,
  Badge,
  Input,
  FormControl,
  FormLabel,
  Card,
  CardHeader,
  CardBody,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  SimpleGrid,
  Icon,
} from '@chakra-ui/react'
import { useW3PK } from '@/context/W3PK'
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { FiShield, FiKey, FiSend, FiCheckCircle, FiClock, FiDollarSign } from 'react-icons/fi'

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

export default function SafePage() {
  const { isAuthenticated, user, deriveWallet, signMessage } = useW3PK()
  const toast = useToast()

  // State
  const [safeAddress, setSafeAddress] = useState<string | null>(null)
  const [safeBalance, setSafeBalance] = useState<string>('0')
  const [derivedAddresses, setDerivedAddresses] = useState<string[]>([])
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [isEnablingModule, setIsEnablingModule] = useState(false)
  const [moduleEnableTxData, setModuleEnableTxData] = useState<any>(null)

  // Send transaction form
  const [recipient, setRecipient] = useState('0x502fb0dFf6A2adbF43468C9888D1A26943eAC6D1')
  const [amount, setAmount] = useState('0.001')

  // Check if session key is expired
  const isSessionKeyExpired = sessionKey
    ? Date.now() > sessionKey.permissions.validUntil * 1000
    : false

  // Load saved Safe address from localStorage
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

  // Get derived addresses
  useEffect(() => {
    if (isAuthenticated) {
      loadDerivedAddresses()
    }
  }, [isAuthenticated])

  // Load Safe balance
  useEffect(() => {
    if (safeAddress) {
      loadBalance()
    }
  }, [safeAddress])

  const loadDerivedAddresses = async () => {
    try {
      // Derive multiple addresses (index 0 and 1)
      const wallet0 = await deriveWallet(0)
      const wallet1 = await deriveWallet(1)

      const addresses = [wallet0.address, wallet1.address]
      setDerivedAddresses(addresses)
      console.log('Derived addresses:', addresses)
    } catch (error) {
      console.error('Error loading derived addresses:', error)
      toast({
        title: 'Derivation Error',
        description: 'Failed to derive addresses. Please try logging in again.',
        status: 'error',
        duration: 5000,
      })
    }
  }

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

  const deploySafe = async () => {
    if (!derivedAddresses[0]) {
      toast({
        title: 'Error',
        description: 'Please wait for derived addresses to load',
        status: 'error',
        duration: 5000,
      })
      return
    }

    setIsDeploying(true)

    try {
      const response = await fetch('/api/safe/deploy-safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: derivedAddresses[0],
          chainId: 10200, // Gnosis Chiado
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSafeAddress(data.safeAddress)

        // Save to localStorage
        localStorage.setItem(
          `safe_${user?.id}`,
          JSON.stringify({
            safeAddress: data.safeAddress,
          })
        )

        toast({
          title: 'Safe Deployed!',
          description: `Your Safe is ready at ${data.safeAddress.slice(0, 10)}...`,
          status: 'success',
          duration: 8000,
        })

        // Load balance
        loadBalance()
      } else {
        throw new Error(data.error || 'Failed to deploy Safe')
      }
    } catch (error: any) {
      toast({
        title: 'Deployment Failed',
        description: error.message,
        status: 'error',
        duration: 8000,
      })
    } finally {
      setIsDeploying(false)
    }
  }

  const createSessionKey = async () => {
    if (!safeAddress || !derivedAddresses[1]) {
      toast({
        title: 'Error',
        description: 'Please deploy Safe first and ensure derived addresses are loaded',
        status: 'error',
        duration: 5000,
      })
      return
    }

    setIsCreatingSession(true)

    try {
      const response = await fetch('/api/safe/create-session-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: derivedAddresses[0],
          safeAddress,
          chainId: 10200,
          sessionKeyAddress: derivedAddresses[1], // Use derived address[1] as session key
          sessionKeyIndex: 1,
        }),
      })

      const data = await response.json()

      if (data.requiresModuleEnable) {
        // Module needs to be enabled first
        setModuleEnableTxData(data.enableModuleTxData)

        toast({
          title: 'Module Enable Required',
          description: 'Click "Enable Module" button to sign and enable Smart Sessions module.',
          status: 'warning',
          duration: 10000,
        })

        console.log('Enable module tx:', data.enableModuleTxData)
        return
      }

      if (data.success) {
        setSessionKey(data)

        // Save to localStorage
        localStorage.setItem(
          `safe_${user?.id}`,
          JSON.stringify({
            safeAddress,
            sessionKey: data,
          })
        )

        toast({
          title: 'Session Key Created!',
          description: 'You can now send gasless transactions',
          status: 'success',
          duration: 8000,
        })
      } else {
        throw new Error(data.error || 'Failed to create session key')
      }
    } catch (error: any) {
      toast({
        title: 'Session Key Creation Failed',
        description: error.message,
        status: 'error',
        duration: 8000,
      })
    } finally {
      setIsCreatingSession(false)
    }
  }

  const enableModule = async () => {
    if (!moduleEnableTxData || !safeAddress) {
      toast({
        title: 'Error',
        description: 'No module enable transaction data available',
        status: 'error',
        duration: 5000,
      })
      return
    }

    setIsEnablingModule(true)

    try {
      // Derive wallet at index 0 to get the owner's private key
      const ownerWallet = await deriveWallet(0)

      // User signs the transaction data with W3PK for verification
      const message = JSON.stringify({
        to: moduleEnableTxData.to,
        data: moduleEnableTxData.data,
        value: moduleEnableTxData.value,
      })

      const signature = await signMessage(message)

      if (!signature) {
        throw new Error('Failed to sign transaction')
      }

      // Execute the enableModule transaction through Safe
      // Send to API endpoint that executes Safe transactions
      const response = await fetch('/api/safe/execute-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          safeAddress,
          to: moduleEnableTxData.to,
          data: moduleEnableTxData.data,
          value: moduleEnableTxData.value,
          signature,
          userPrivateKey: ownerWallet.privateKey,
          chainId: 10200,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Module Enabled!',
          description: 'Smart Sessions module is now enabled on your Safe',
          status: 'success',
          duration: 8000,
        })

        // Clear the module enable tx data
        setModuleEnableTxData(null)

        // Wait a bit for the transaction to be mined
        await new Promise((resolve) => setTimeout(resolve, 3000))

        // Try creating session key again
        await createSessionKey()
      } else {
        throw new Error(result.error || 'Failed to enable module')
      }
    } catch (error: any) {
      toast({
        title: 'Module Enable Failed',
        description: error.message,
        status: 'error',
        duration: 8000,
      })
    } finally {
      setIsEnablingModule(false)
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

    setIsSending(true)

    try {
      // Prepare transaction data
      const txData = {
        to: recipient,
        value: ethers.parseEther(amount).toString(),
        data: '0x',
      }

      // Derive the session key wallet to sign the transaction
      // This requires user authentication with W3PK
      const sessionKeyWallet = await deriveWallet(sessionKey.sessionKeyIndex)

      // Sign with the session key's private key
      const message = JSON.stringify(txData)
      const sessionKeySigner = new ethers.Wallet(sessionKeyWallet.privateKey)
      const signature = await sessionKeySigner.signMessage(message)

      // Derive the owner wallet (index 0) to sign the Safe transaction
      const ownerWallet = await deriveWallet(0)

      // Send to backend
      const response = await fetch('/api/safe/send-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: derivedAddresses[0],
          safeAddress,
          chainId: 10200,
          to: recipient,
          amount: txData.value,
          sessionKeyAddress: sessionKey.sessionKeyAddress,
          sessionKeyValidUntil: sessionKey.permissions.validUntil,
          userPrivateKey: ownerWallet.privateKey,
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
        setRecipient('')
        setAmount('')

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

  if (!isAuthenticated) {
    return (
      <Container maxW="container.md" py={20}>
        <Box textAlign="center">
          <Heading mb={4}>Please Login</Heading>
          <Text color="gray.400">You need to be authenticated to use Safe features</Text>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxW="container.lg" py={10}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Box>
          <Heading as="h1" size="xl" mb={2}>
            Safe Smart Wallet
          </Heading>
          <Text color="gray.400">Deploy and manage your Safe with gasless session keys</Text>
        </Box>

        {/* Safe Status */}
        <Card bg="gray.800" borderColor="gray.700">
          <CardHeader>
            <HStack>
              <Icon as={FiShield} boxSize={6} color="#8c1c84" />
              <Heading size="md">Safe Status</Heading>
            </HStack>
          </CardHeader>
          <CardBody>
            {!safeAddress ? (
              <VStack spacing={4} align="stretch">
                <Alert status="info" bg="blue.900" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>No Safe Deployed</AlertTitle>
                    <AlertDescription fontSize="sm">
                      Deploy a Safe smart wallet to get started with gasless transactions
                    </AlertDescription>
                  </Box>
                </Alert>

                <Button
                  colorScheme="purple"
                  size="lg"
                  onClick={deploySafe}
                  isLoading={isDeploying}
                  loadingText="Deploying Safe..."
                  leftIcon={<FiShield />}
                >
                  Deploy Safe
                </Button>

                {derivedAddresses[0] && (
                  <Text fontSize="sm" color="gray.500">
                    Owner: {derivedAddresses[0]}
                  </Text>
                )}
              </VStack>
            ) : (
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontWeight="bold" mb={2}>Safe Address:</Text>
                  <HStack>
                    <Text fontFamily="mono" fontSize="sm">
                      {safeAddress}
                    </Text>
                    <Badge colorScheme="green">Active</Badge>
                  </HStack>
                </Box>

                <HStack justify="space-between">
                  <Text fontWeight="bold">Balance:</Text>
                  <HStack>
                    {isLoadingBalance ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <Text fontFamily="mono">{parseFloat(ethers.formatEther(safeBalance)).toFixed(6)} xDAI</Text>
                        <Button size="xs" onClick={loadBalance} variant="ghost">
                          Refresh
                        </Button>
                      </>
                    )}
                  </HStack>
                </HStack>

                <Box>
                  <Text fontWeight="bold" mb={2}>Owner:</Text>
                  <Text fontFamily="mono" fontSize="sm">
                    {derivedAddresses[0]}
                  </Text>
                </Box>
              </VStack>
            )}
          </CardBody>
        </Card>

        {/* Session Key Section */}
        {safeAddress && (
          <Card bg="gray.800" borderColor="gray.700">
            <CardHeader>
              <HStack>
                <Icon as={FiKey} boxSize={6} color="#8c1c84" />
                <Heading size="md">Session Keys</Heading>
              </HStack>
            </CardHeader>
            <CardBody>
              {!sessionKey ? (
                <VStack spacing={4} align="stretch">
                  {moduleEnableTxData ? (
                    <>
                      <Alert status="warning" bg="orange.900" borderRadius="md">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>Module Enable Required</AlertTitle>
                          <AlertDescription fontSize="sm">
                            Smart Sessions module needs to be enabled on your Safe before creating session keys
                          </AlertDescription>
                        </Box>
                      </Alert>

                      <Button
                        colorScheme="orange"
                        size="lg"
                        onClick={enableModule}
                        isLoading={isEnablingModule}
                        loadingText="Enabling Module..."
                        leftIcon={<FiShield />}
                      >
                        Enable Smart Sessions Module
                      </Button>

                      <Text fontSize="sm" color="gray.500">
                        This is a one-time setup. You&apos;ll sign with your passkey.
                      </Text>
                    </>
                  ) : (
                    <>
                      <Alert status="info" bg="blue.900" borderRadius="md">
                        <AlertIcon />
                        <Box>
                          <AlertTitle>No Session Key</AlertTitle>
                          <AlertDescription fontSize="sm">
                            Create a session key to enable gasless transactions with spending limits
                          </AlertDescription>
                        </Box>
                      </Alert>

                      <Button
                        colorScheme="purple"
                        size="lg"
                        onClick={createSessionKey}
                        isLoading={isCreatingSession}
                        loadingText="Creating Session Key..."
                        leftIcon={<FiKey />}
                      >
                        Create Session Key
                      </Button>

                      {derivedAddresses[1] && (
                        <Text fontSize="sm" color="gray.500">
                          Session Key: {derivedAddresses[1]}
                        </Text>
                      )}
                    </>
                  )}
                </VStack>
              ) : (
                <VStack spacing={4} align="stretch">
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    <Box
                      p={4}
                      bg="gray.900"
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor="gray.700"
                    >
                      <HStack mb={2}>
                        <Icon as={FiDollarSign} color="green.400" />
                        <Text fontSize="sm" fontWeight="bold">
                          Spending Limit
                        </Text>
                      </HStack>
                      <Text fontSize="lg" fontFamily="mono">
                        {ethers.formatEther(sessionKey.permissions.spendingLimit)} xDAI
                      </Text>
                    </Box>

                    <Box
                      p={4}
                      bg="gray.900"
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor="gray.700"
                    >
                      <HStack mb={2}>
                        <Icon as={FiClock} color="blue.400" />
                        <Text fontSize="sm" fontWeight="bold">
                          Expires
                        </Text>
                      </HStack>
                      <Text fontSize="sm">{new Date(sessionKey.expiresAt).toLocaleString()}</Text>
                    </Box>

                    <Box
                      p={4}
                      bg="gray.900"
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor="gray.700"
                    >
                      <HStack mb={2}>
                        <Icon as={FiCheckCircle} color={isSessionKeyExpired ? "red.400" : "purple.400"} />
                        <Text fontSize="sm" fontWeight="bold">
                          Status
                        </Text>
                      </HStack>
                      <Badge colorScheme={isSessionKeyExpired ? "red" : "green"} fontSize="md">
                        {isSessionKeyExpired ? "Expired" : "Active"}
                      </Badge>
                    </Box>
                  </SimpleGrid>

                  <Divider />

                  {isSessionKeyExpired && (
                    <Alert status="error" bg="red.900" borderRadius="md">
                      <AlertIcon />
                      <Box flex="1">
                        <AlertTitle>Session Key Expired</AlertTitle>
                        <AlertDescription fontSize="sm">
                          This session key has expired. Create a new one to continue making transactions.
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

                  <Box>
                    <Text fontSize="sm" color="gray.500" mb={1}>
                      Session Key Address:
                    </Text>
                    <Text fontFamily="mono" fontSize="sm">
                      {sessionKey.sessionKeyAddress}
                    </Text>
                  </Box>

                  {isSessionKeyExpired && (
                    <Button
                      colorScheme="purple"
                      size="lg"
                      onClick={createSessionKey}
                      isLoading={isCreatingSession}
                      loadingText="Creating New Session Key..."
                      leftIcon={<FiKey />}
                    >
                      Create New Session Key
                    </Button>
                  )}
                </VStack>
              )}
            </CardBody>
          </Card>
        )}

        {/* Send Transaction */}
        {safeAddress && sessionKey && (
          <Card bg="gray.800" borderColor="gray.700">
            <CardHeader>
              <HStack>
                <Icon as={FiSend} boxSize={6} color="#8c1c84" />
                <Heading size="md">Send Transaction</Heading>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Recipient Address</FormLabel>
                  <Input
                    placeholder="0x..."
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    fontFamily="mono"
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
                  />
                </FormControl>

                <Button
                  colorScheme="purple"
                  size="lg"
                  onClick={sendTransaction}
                  isLoading={isSending}
                  loadingText="Sending Transaction..."
                  leftIcon={<FiSend />}
                  isDisabled={!recipient || !amount || isSessionKeyExpired}
                >
                  Send Transaction (Gasless)
                </Button>

                {isSessionKeyExpired && (
                  <Alert status="warning" bg="orange.900" borderRadius="md">
                    <AlertIcon />
                    <Text fontSize="sm">
                      Your session key has expired. Please create a new one above to send transactions.
                    </Text>
                  </Alert>
                )}

                <Alert status="info" bg="blue.900" borderRadius="md">
                  <AlertIcon />
                  <Text fontSize="sm">
                    This transaction is gasless! You sign with your passkey, relayer pays the gas.
                  </Text>
                </Alert>
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Info Box */}
        <Box bg="gray.800" p={6} borderRadius="md" borderWidth="1px" borderColor="gray.700">
          <Heading size="sm" mb={3}>
            How It Works
          </Heading>
          <VStack align="start" spacing={2} fontSize="sm" color="gray.400">
            <Text>• Your Safe is controlled by your W3PK passkey (non-custodial)</Text>
            <Text>• Session keys use derived addresses from your passkey</Text>
            <Text>• You sign transactions with Face ID / Touch ID</Text>
            <Text>• Relayer pays gas fees (gasless for you!)</Text>
            <Text>• Session keys have spending limits and expiry times</Text>
          </VStack>
        </Box>
      </VStack>
    </Container>
  )
}
