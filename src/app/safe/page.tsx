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
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { FiShield, FiKey, FiCheckCircle, FiClock, FiDollarSign } from 'react-icons/fi'

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

type SetupStep = 'idle' | 'deploying' | 'enablingModule' | 'creatingSessionKey' | 'error'

export default function SafePage() {
  const { isAuthenticated, user, deriveWallet, signMessage } = useW3PK()
  const toast = useToast()

  // State
  const [safeAddress, setSafeAddress] = useState<string | null>(null)
  const [safeOwner, setSafeOwner] = useState<string | null>(null)
  const [safeBalance, setSafeBalance] = useState<string>('0')
  const [derivedAddresses, setDerivedAddresses] = useState<string[]>([])
  const [sessionKey, setSessionKey] = useState<SessionKey | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false) // Can potentially be removed
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [isEnablingModule, setIsEnablingModule] = useState(false) // Can potentially be removed
  const [moduleEnableTxData, setModuleEnableTxData] = useState<any>(null)
  const [isMintingEUR, setIsMintingEUR] = useState(false)

  // New state for the combined setup flow - Explicitly typed
  const [currentSetupStep, setCurrentSetupStep] = useState<SetupStep>('idle')

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
        setSafeOwner(data.safeOwner || null)
        if (data.sessionKey) {
          setSessionKey(data.sessionKey)
        }
      }
    }
  }, [isAuthenticated, user])

  // Verify ownership when Safe is loaded
  useEffect(() => {
    const verifyOwnership = async () => {
      if (safeAddress && isAuthenticated && !safeOwner) {
        // If we have a Safe but no owner info, try to derive and verify
        try {
          const wallet0 = await deriveWallet(0)

          // Check on-chain if this wallet is an owner
          const response = await fetch('/api/safe/get-owners', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              safeAddress,
              chainId: 10200,
            }),
          })

          const data = await response.json()
          if (
            data.success &&
            data.owners?.some(
              (owner: string) => owner.toLowerCase() === wallet0.address.toLowerCase()
            )
          ) {
            // Update localStorage with owner info
            setSafeOwner(wallet0.address)
            const existingData = localStorage.getItem(`safe_${user?.id}`)
            const existing = existingData ? JSON.parse(existingData) : {}
            localStorage.setItem(
              `safe_${user?.id}`,
              JSON.stringify({
                ...existing,
                safeOwner: wallet0.address,
              })
            )
          } else {
            // This Safe doesn't belong to current user - clear it
            console.warn('Safe does not belong to current user, clearing...')
            localStorage.removeItem(`safe_${user?.id}`)
            setSafeAddress(null)
            setSafeOwner(null)
            setSessionKey(null)

            toast({
              title: 'Safe Cleared',
              description:
                'The saved Safe did not belong to your account. Please deploy a new one.',
              status: 'warning',
              duration: 8000,
            })
          }
        } catch (error) {
          console.error('Error verifying ownership:', error)
        }
      }
    }

    verifyOwnership()
  }, [safeAddress, safeOwner, isAuthenticated, deriveWallet, user, toast])

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
          chainId: 10200,
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

  const setupSafeAndSession = async () => {
    setCurrentSetupStep('deploying')
    setIsDeploying(true) // Maintain existing state for UI elements like loadingText

    try {
      // Step 1: Deploy Safe
      console.log('Step 1: Deploying Safe...')
      const wallet0 = await deriveWallet(0)
      const wallet1 = await deriveWallet(1)
      setDerivedAddresses([wallet0.address, wallet1.address])

      const deployResponse = await fetch('/api/safe/deploy-safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: wallet0.address,
          chainId: 10200,
        }),
      })

      const deployData = await deployResponse.json()

      if (!deployData.success) {
        throw new Error(deployData.error || 'Failed to deploy Safe')
      }

      const newSafeAddress = deployData.safeAddress
      setSafeAddress(newSafeAddress)
      setSafeOwner(wallet0.address)

      // Save to localStorage
      localStorage.setItem(
        `safe_${user?.id}`,
        JSON.stringify({
          safeAddress: newSafeAddress,
          safeOwner: wallet0.address,
        })
      )

      toast({
        title: 'Safe Deployed!',
        description: `Your Safe is ready at ${newSafeAddress.slice(0, 10)}...`,
        status: 'success',
        duration: 5000,
      })

      await loadBalance()

      // Step 2: Create Session Key (this might require enabling the module)
      console.log('Step 2: Creating Session Key...')
      setCurrentSetupStep('creatingSessionKey')
      setIsCreatingSession(true) // Maintain existing state for UI elements like loadingText

      const sessionResponse = await fetch('/api/safe/create-session-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: wallet0.address,
          safeAddress: newSafeAddress,
          chainId: 10200,
          sessionKeyAddress: wallet1.address, // Use derived address[1] as session key
          sessionKeyIndex: 1,
        }),
      })

      const sessionData = await sessionResponse.json()

      if (sessionData.requiresModuleEnable) {
        // If module needs enabling, do it now
        console.log('Module needs enabling...')
        setModuleEnableTxData(sessionData.enableModuleTxData)
        setCurrentSetupStep('enablingModule')
        setIsEnablingModule(true) // Maintain existing state for UI elements like loadingText

        // Sign and execute the enableModule transaction
        const message = JSON.stringify({
          to: sessionData.enableModuleTxData.to,
          data: sessionData.enableModuleTxData.data,
          value: sessionData.enableModuleTxData.value,
        })

        const signature = await signMessage(message)

        if (!signature) {
          throw new Error('Failed to sign module enable transaction')
        }

        const executeResponse = await fetch('/api/safe/execute-tx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            safeAddress: newSafeAddress,
            to: sessionData.enableModuleTxData.to,
            data: sessionData.enableModuleTxData.data,
            value: sessionData.enableModuleTxData.value,
            signature,
            userPrivateKey: wallet0.privateKey,
            chainId: 10200,
          }),
        })

        const executeResult = await executeResponse.json()

        if (!executeResult.success) {
          throw new Error(executeResult.error || 'Failed to enable module')
        }

        toast({
          title: 'Module Enabled!',
          description: 'Smart Sessions module is now enabled on your Safe',
          status: 'success',
          duration: 5000,
        })
        setModuleEnableTxData(null)

        await new Promise(resolve => setTimeout(resolve, 3000))

        // Now try creating the session key again after enabling the module
        const finalSessionResponse = await fetch('/api/safe/create-session-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: wallet0.address,
            safeAddress: newSafeAddress,
            chainId: 10200,
            sessionKeyAddress: wallet1.address,
            sessionKeyIndex: 1,
          }),
        })

        const finalSessionData = await finalSessionResponse.json()

        if (!finalSessionData.success) {
          throw new Error(
            finalSessionData.error || 'Failed to create session key after enabling module'
          )
        }

        setSessionKey(finalSessionData)

        // Save session key to localStorage
        const existingData = localStorage.getItem(`safe_${user?.id}`)
        const existing = existingData ? JSON.parse(existingData) : {}
        localStorage.setItem(
          `safe_${user?.id}`,
          JSON.stringify({
            ...existing,
            safeAddress: newSafeAddress,
            sessionKey: finalSessionData,
          })
        )

        toast({
          title: 'Session Key Created!',
          description: 'You can now send gasless transactions',
          status: 'success',
          duration: 5000,
        })
      } else if (sessionData.success) {
        // If module didn't need enabling, session key was created directly
        setSessionKey(sessionData)

        // Save session key to localStorage
        const existingData = localStorage.getItem(`safe_${user?.id}`)
        const existing = existingData ? JSON.parse(existingData) : {}
        localStorage.setItem(
          `safe_${user?.id}`,
          JSON.stringify({
            ...existing,
            safeAddress: newSafeAddress,
            sessionKey: sessionData,
          })
        )

        toast({
          title: 'Session Key Created!',
          description: 'You can now send gasless transactions',
          status: 'success',
          duration: 5000,
        })
      } else {
        throw new Error(sessionData.error || 'Failed to create session key')
      }

      toast({
        title: 'Setup Complete!',
        description: 'Your Safe and session key are ready.',
        status: 'success',
        duration: 5000,
      })
    } catch (error: any) {
      console.error('Combined setup failed:', error)
      setCurrentSetupStep('error')
      toast({
        title: 'Setup Failed',
        description: error.message || 'An error occurred during setup',
        status: 'error',
        duration: 8000,
      })
    } finally {
      setIsDeploying(false)
      setIsCreatingSession(false)
      setIsEnablingModule(false)
      if (currentSetupStep !== 'error') {
        setCurrentSetupStep('idle')
      }
    }
  }

  const mintEUR = async () => {
    if (!safeAddress) return
    setIsMintingEUR(true)

    try {
      const response = await fetch('/api/safe/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          safeAddress,
          chainId: 10200,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success!',
          description: `You received 10,000 EUR! Merry Christmas, my friend!`,
          status: 'success',
          duration: 5000,
        })
        await loadBalance()
      } else {
        throw new Error(data.error || 'Failed to mint EUR')
      }
    } catch (error: any) {
      console.error('Error minting EUR:', error)
      toast({
        title: 'Minting Failed',
        description: error.message || 'Failed to mint EUR tokens',
        status: 'error',
        duration: 5000,
      })
    } finally {
      setIsMintingEUR(false)
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
                  onClick={setupSafeAndSession}
                  isLoading={currentSetupStep !== 'idle' && currentSetupStep !== 'error'}
                  loadingText={
                    currentSetupStep === 'deploying'
                      ? 'Deploying your Safe onchain wallet...'
                      : currentSetupStep === 'enablingModule'
                        ? 'Enabling session module...'
                        : currentSetupStep === 'creatingSessionKey'
                          ? 'Creating session key...'
                          : 'Processing...' // Fallback
                  }
                  leftIcon={<FiShield />}
                  isDisabled={currentSetupStep !== 'idle'} // Disable button during setup
                >
                  {currentSetupStep === 'idle'
                    ? 'Deploy Safe & Setup Session Key'
                    : 'Setting Up...'}
                </Button>

                {/* Optional: Show current step status */}
                {currentSetupStep !== 'idle' && currentSetupStep !== 'error' && (
                  <Text fontSize="sm" color="gray.500" textAlign="center">
                    Step:{' '}
                    {currentSetupStep === 'deploying'
                      ? 'Deploying Safe'
                      : currentSetupStep === 'enablingModule'
                        ? 'Enabling Module'
                        : 'Creating Session Key'}
                  </Text>
                )}

                {derivedAddresses[0] && (
                  <Text fontSize="sm" color="gray.500">
                    Owner: {derivedAddresses[0]}
                  </Text>
                )}
              </VStack>
            ) : (
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontWeight="bold" mb={2}>
                    Safe Address:
                  </Text>
                  <VStack align="stretch" spacing={2}>
                    <Text fontFamily="mono" fontSize="sm" wordBreak="break-all">
                      {safeAddress}
                    </Text>
                    <Badge colorScheme="green" alignSelf="flex-start">
                      Active
                    </Badge>
                  </VStack>
                </Box>

                <HStack justify="space-between">
                  <Text fontWeight="bold">Balance:</Text>
                  <HStack>
                    {isLoadingBalance ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <Text fontFamily="mono">
                          {parseFloat(ethers.formatEther(safeBalance)).toFixed(2)} EUR
                        </Text>
                        <Button size="xs" onClick={loadBalance} variant="ghost">
                          Refresh
                        </Button>
                      </>
                    )}
                  </HStack>
                </HStack>

                <Box>
                  <Text fontWeight="bold" mb={2}>
                    Owner:
                  </Text>
                  <Text fontFamily="mono" fontSize="sm">
                    {safeOwner || 'Not available'}
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
              {/* Show status if setup is ongoing */}
              {currentSetupStep !== 'idle' && currentSetupStep !== 'error' && (
                <VStack spacing={4} align="stretch">
                  <Alert status="info" bg="blue.900" borderRadius="md">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>Setting Up Session Key</AlertTitle>
                      <AlertDescription fontSize="sm">
                        {currentSetupStep === 'enablingModule'
                          ? 'Enabling module...'
                          : currentSetupStep === 'creatingSessionKey'
                            ? 'Creating session key...'
                            : 'Please wait...'}
                      </AlertDescription>
                    </Box>
                  </Alert>
                </VStack>
              )}
              {currentSetupStep === 'error' && (
                <VStack spacing={4} align="stretch">
                  <Alert status="error" bg="red.900" borderRadius="md">
                    <AlertIcon />
                    <Box>
                      <AlertTitle>Setup Failed</AlertTitle>
                      <AlertDescription fontSize="sm">
                        The setup process encountered an error. Please try again.
                      </AlertDescription>
                    </Box>
                  </Alert>
                  <Button
                    colorScheme="purple"
                    size="lg"
                    onClick={setupSafeAndSession}
                    isLoading={
                      (currentSetupStep as SetupStep) === 'deploying' ||
                      (currentSetupStep as SetupStep) === 'enablingModule' ||
                      (currentSetupStep as SetupStep) === 'creatingSessionKey'
                    }
                    loadingText={
                      (currentSetupStep as SetupStep) === 'deploying'
                        ? 'Deploying your Safe onchain wallet...'
                        : (currentSetupStep as SetupStep) === 'enablingModule'
                          ? 'Enabling session module...'
                          : 'Creating session key...'
                    }
                    leftIcon={<FiShield />}
                    isDisabled={
                      (currentSetupStep as SetupStep) !== 'idle' &&
                      (currentSetupStep as SetupStep) !== 'error'
                    }
                  >
                    Retry Setup
                  </Button>
                </VStack>
              )}
              {/* Show session key info if available and setup is finished or expired but idle */}
              {sessionKey &&
                currentSetupStep !== 'error' &&
                currentSetupStep !== 'enablingModule' &&
                currentSetupStep !== 'creatingSessionKey' &&
                (!isSessionKeyExpired || currentSetupStep === 'idle') && (
                  <VStack spacing={4} align="stretch">
                    {/* session key display UI */}
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
                          {parseFloat(
                            ethers.formatEther(sessionKey.permissions.spendingLimit)
                          ).toFixed(2)}{' '}
                          EUR
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
                          <Icon
                            as={FiCheckCircle}
                            color={isSessionKeyExpired ? 'red.400' : 'purple.400'}
                          />
                          <Text fontSize="sm" fontWeight="bold">
                            Status
                          </Text>
                        </HStack>
                        <Badge colorScheme={isSessionKeyExpired ? 'red' : 'green'} fontSize="md">
                          {isSessionKeyExpired ? 'Expired' : 'Active'}
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
                            This session key has expired. Create a new one to continue making
                            transactions.
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
                        onClick={setupSafeAndSession}
                        isLoading={
                          (currentSetupStep as SetupStep) === 'deploying' ||
                          (currentSetupStep as SetupStep) === 'enablingModule' ||
                          (currentSetupStep as SetupStep) === 'creatingSessionKey'
                        }
                        loadingText={
                          (currentSetupStep as SetupStep) === 'deploying'
                            ? 'Deploying your Safe onchain wallet...'
                            : (currentSetupStep as SetupStep) === 'enablingModule'
                              ? 'Enabling session module...'
                              : 'Creating new session key...'
                        }
                        leftIcon={<FiKey />}
                        isDisabled={
                          (currentSetupStep as SetupStep) !== 'idle' &&
                          (currentSetupStep as SetupStep) !== 'error'
                        }
                      >
                        Create New Session Key
                      </Button>
                    )}
                  </VStack>
                )}
            </CardBody>
          </Card>
        )}

        {/* Go to Transaction Page Button - Shown if Safe exists, session key exists, and is not expired, and setup is idle */}
        {safeAddress && sessionKey && !isSessionKeyExpired && currentSetupStep === 'idle' && (
          <Box textAlign="center" pt={4}>
            <Button as="a" href="/tx" colorScheme="purple" size="lg">
              Go to Transaction Page
            </Button>
          </Box>
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

        {/* Faucet Button - Moved into its own box */}
        {safeAddress && currentSetupStep === 'idle' && (
          <Box textAlign="center" pt={4}>
            <Button
              size="sm"
              colorScheme="red"
              onClick={mintEUR}
              isLoading={isMintingEUR}
              loadingText="Minting..."
            >
              Get 10,000 EUR
            </Button>
          </Box>
        )}
      </VStack>
    </Container>
  )
}
