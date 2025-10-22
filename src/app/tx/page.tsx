'use client'

import {
  Container,
  Heading,
  Text,
  VStack,
  Box,
  Button,
  Select,
  Alert,
  AlertIcon,
  AlertDescription,
  useToast,
  Spinner as ChakraSpinner,
  Badge,
  HStack,
  Divider,
  Code,
  Flex,
  Icon,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Tooltip,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
} from '@chakra-ui/react'
import { useW3PK } from '@/context/W3PK'
import Spinner from '@/components/Spinner'
import { CHAINS, Chain, getEnabledChains } from '@/lib/chains'
import { SafeStorage, SafeData, SessionKey } from '@/lib/safeStorage'
import { useState, useEffect } from 'react'
import {
  FiCheck,
  FiClock,
  FiExternalLink,
  FiKey,
  FiRefreshCw,
  FiDownload,
  FiCopy,
} from 'react-icons/fi'
import { MdAccountBalanceWallet } from 'react-icons/md'

export default function SafePage() {
  const { isAuthenticated, user, deriveWallet } = useW3PK()
  const toast = useToast()

  // State
  const [selectedChain, setSelectedChain] = useState<Chain>(CHAINS.gnosis)
  const [safeData, setSafeData] = useState<SafeData | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isSendingTx, setIsSendingTx] = useState(false)
  const [isCreatingSessionKey, setIsCreatingSessionKey] = useState(false)
  const [isAddingOwner, setIsAddingOwner] = useState(false)
  const [balance, setBalance] = useState<string>('0')
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  // Modal for sending transaction
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')

  // Load Safe data when user or chain changes
  useEffect(() => {
    if (user?.ethereumAddress) {
      loadSafeData()
    }
  }, [user?.ethereumAddress, selectedChain])

  const loadSafeData = () => {
    if (!user?.ethereumAddress) return

    const data = SafeStorage.getSafeData(user.ethereumAddress, selectedChain.id)

    // Validate Safe address format (must be 42 chars: 0x + 40 hex)
    if (data && !/^0x[a-fA-F0-9]{40}$/.test(data.safeAddress)) {
      console.warn('⚠️  Invalid Safe address detected, clearing data:', data.safeAddress)
      // Clear invalid data for this chain
      const allData = SafeStorage.getData(user.ethereumAddress)
      if (allData?.safes) {
        delete allData.safes[selectedChain.id]
        localStorage.setItem(
          `w3pk_safe_${user.ethereumAddress.toLowerCase()}`,
          JSON.stringify(allData)
        )
      }
      setSafeData(null)
      return
    }

    setSafeData(data)

    if (data) {
      // Load balance
      setBalance(data.lastBalance)
      fetchBalance(data.safeAddress)
    }
  }

  const fetchBalance = async (safeAddress: string) => {
    setIsLoadingBalance(true)
    try {
      const response = await fetch('/api/safe/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          safeAddress,
          chainId: selectedChain.id,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setBalance(data.balance)

        // Update storage
        if (user?.ethereumAddress) {
          SafeStorage.updateBalance(user.ethereumAddress, selectedChain.id, data.balance)
        }
      }
    } catch (error) {
      console.error('Error fetching balance:', error)
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const handleDeploySafe = async () => {
    if (!user?.ethereumAddress) return

    setIsDeploying(true)
    try {
      const response = await fetch('/api/safe/deploy-safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: user.ethereumAddress,
          chainId: selectedChain.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to deploy Safe')
      }

      // Save to storage
      const newSafeData: SafeData = {
        safeAddress: data.safeAddress,
        deployedAt: new Date().toISOString(),
        deploymentTxHash: data.txHash,
        sessionKeys: [],
        lastBalance: '0',
        lastChecked: new Date().toISOString(),
      }

      SafeStorage.saveSafe(user.ethereumAddress, selectedChain.id, newSafeData)
      setSafeData(newSafeData)

      toast({
        title: 'Safe Deployed!',
        description: `Your Safe wallet has been deployed at ${data.safeAddress}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      // Wait a bit then check balance
      setTimeout(() => fetchBalance(data.safeAddress), 3000)
    } catch (error: any) {
      console.error('Error deploying Safe:', error)
      toast({
        title: 'Deployment Failed',
        description: error.message || 'Failed to deploy Safe wallet',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsDeploying(false)
    }
  }

  const handleCreateSessionKey = async () => {
    if (!user?.ethereumAddress || !safeData) return

    setIsCreatingSessionKey(true)
    try {
      const response = await fetch('/api/safe/create-session-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: user.ethereumAddress,
          safeAddress: safeData.safeAddress,
          chainId: selectedChain.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session key')
      }

      // Add to storage
      const newSessionKey: SessionKey = {
        keyAddress: data.sessionKeyAddress,
        createdAt: new Date().toISOString(),
        expiresAt: data.expiresAt,
        permissions: data.permissions,
        isActive: true,
      }

      SafeStorage.addSessionKey(user.ethereumAddress, selectedChain.id, newSessionKey)

      // Reload data
      loadSafeData()

      toast({
        title: 'Session Key Created!',
        description: 'You can now send transactions without signing each time',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
    } catch (error: any) {
      console.error('Error creating session key:', error)
      toast({
        title: 'Failed to Create Session Key',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsCreatingSessionKey(false)
    }
  }

  const handleSendTransaction = async () => {
    if (!user?.ethereumAddress || !safeData || !recipient || !amount) return

    setIsSendingTx(true)
    try {
      const response = await fetch('/api/safe/send-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: user.ethereumAddress,
          safeAddress: safeData.safeAddress,
          chainId: selectedChain.id,
          to: recipient,
          amount: amount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send transaction')
      }

      toast({
        title: 'Transaction Sent!',
        description: `Successfully sent ${amount} tokens`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      // Reset form and close modal
      setRecipient('')
      setAmount('')
      onClose()

      // Refresh balance
      setTimeout(() => fetchBalance(safeData.safeAddress), 3000)
    } catch (error: any) {
      console.error('Error sending transaction:', error)
      toast({
        title: 'Transaction Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsSendingTx(false)
    }
  }

  const handleAddRelayerAsOwner = async () => {
    if (!user?.ethereumAddress || !safeData) return

    setIsAddingOwner(true)
    try {
      // Derive wallet at index 0 to get private key
      const wallet = await deriveWallet(0)

      const response = await fetch('/api/safe/add-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          safeAddress: safeData.safeAddress,
          chainId: selectedChain.id,
          userPrivateKey: wallet.privateKey,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add relayer as owner')
      }

      toast({
        title: 'Relayer Added as Owner!',
        description: 'The relayer can now execute transactions on your behalf',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })
    } catch (error: any) {
      console.error('Error adding relayer as owner:', error)
      toast({
        title: 'Failed to Add Owner',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsAddingOwner(false)
    }
  }

  const handleExportData = () => {
    if (!user?.ethereumAddress) return

    const exportData = SafeStorage.exportData(user.ethereumAddress)
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `safe-backup-${user.ethereumAddress}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: 'Backup Downloaded',
      description: 'Your Safe data has been exported',
      status: 'success',
      duration: 3000,
      isClosable: true,
    })
  }

  // Show spinner while checking authentication
  if (!isAuthenticated) {
    return (
      <Container maxW="container.md" py={8}>
        <VStack spacing={8}>
          <Spinner size="100px" />
          <Text>Please log in to access Safe wallet features</Text>
        </VStack>
      </Container>
    )
  }

  const hasSafe = !!safeData
  const activeSessionKeys = safeData?.sessionKeys.filter(key => key.isActive) || []

  return (
    <Container maxW="container.lg" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="xl" mb={2}>
            Safe Smart Wallet
          </Heading>
          <Text color="gray.400">
            Deploy a Safe wallet and enable gasless transactions with session keys
          </Text>
        </Box>

        {/* Network Selector */}
        <Box>
          <FormControl>
            <FormLabel>Select Network</FormLabel>
            <Select
              value={selectedChain.name}
              onChange={e => {
                const chain = Object.values(CHAINS).find(c => c.name === e.target.value)
                if (chain) setSelectedChain(chain)
              }}
            >
              {Object.values(CHAINS).map(chain => (
                <option key={chain.id} value={chain.name} disabled={!chain.enabled}>
                  {chain.name} {!chain.enabled && ''}
                </option>
              ))}
            </Select>
          </FormControl>

          {selectedChain && (
            <HStack mt={2} spacing={2}>
              <Badge colorScheme="green">Testnet</Badge>
              <Text fontSize="sm" color="gray.400">
                Chain ID: {selectedChain.id}
              </Text>
            </HStack>
          )}
        </Box>

        {/* Info Box */}
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <AlertDescription>
            💾 Safe data is stored locally in your browser. Use the export button to backup your
            data.
          </AlertDescription>
        </Alert>

        {/* Main Content */}
        {!hasSafe ? (
          /* Deployment Flow */
          <Box borderWidth="1px" borderRadius="lg" p={6}>
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading size="md" mb={2}>
                  Deploy Your Safe Wallet
                </Heading>
                <Text color="gray.400">
                  Create a smart contract wallet controlled by your W3PK key. This enables:
                </Text>
              </Box>

              <VStack align="stretch" spacing={3} pl={4}>
                <HStack>
                  <Icon as={FiCheck} color="green.400" />
                  <Text>Account abstraction features</Text>
                </HStack>
                <HStack>
                  <Icon as={FiCheck} color="green.400" />
                  <Text>Session keys for gasless transactions</Text>
                </HStack>
                <HStack>
                  <Icon as={FiCheck} color="green.400" />
                  <Text>Multi-signature support (future)</Text>
                </HStack>
              </VStack>

              <Button
                colorScheme="blue"
                size="lg"
                onClick={handleDeploySafe}
                isLoading={isDeploying}
                loadingText="Deploying Safe..."
                leftIcon={<MdAccountBalanceWallet />}
              >
                Deploy Safe on {selectedChain.name}
              </Button>

              <Text fontSize="sm" color="gray.500">
                Deployment is gasless - our relayer will handle the transaction
              </Text>
            </VStack>
          </Box>
        ) : (
          /* Safe Dashboard */
          <VStack spacing={6} align="stretch">
            {/* Safe Info Card */}
            <Box borderWidth="1px" borderRadius="lg" p={6}>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Heading size="md">Your Safe Wallet</Heading>
                  <Badge colorScheme="green" fontSize="md">
                    Active
                  </Badge>
                </HStack>

                <Divider />

                <VStack align="stretch" spacing={3}>
                  <VStack align="stretch" spacing={2}>
                    <Text fontWeight="bold">Safe Address:</Text>
                    <HStack>
                      <Code fontSize="sm" flex={1} p={2}>
                        {safeData.safeAddress}
                      </Code>
                      <IconButton
                        aria-label="Copy address"
                        icon={<FiCopy />}
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(safeData.safeAddress)
                          toast({
                            title: 'Copied!',
                            description: 'Safe address copied to clipboard',
                            status: 'success',
                            duration: 2000,
                            isClosable: true,
                          })
                        }}
                      />
                      <IconButton
                        aria-label="View on explorer"
                        icon={<FiExternalLink />}
                        size="sm"
                        variant="ghost"
                        as="a"
                        href={`${selectedChain.blockExplorer}/address/${safeData.safeAddress}`}
                        target="_blank"
                      />
                    </HStack>
                  </VStack>

                  <HStack justify="space-between">
                    <Text fontWeight="bold">Balance:</Text>
                    <HStack>
                      <Text>
                        {(parseInt(balance) / 1e18).toFixed(4)}{' '}
                        {selectedChain.nativeCurrency.symbol}
                      </Text>
                      <IconButton
                        aria-label="Refresh balance"
                        icon={<FiRefreshCw />}
                        size="sm"
                        variant="ghost"
                        onClick={() => fetchBalance(safeData.safeAddress)}
                        isLoading={isLoadingBalance}
                      />
                    </HStack>
                  </HStack>

                  <HStack justify="space-between">
                    <Text fontWeight="bold">Deployed:</Text>
                    <Text fontSize="sm" color="gray.400">
                      {new Date(safeData.deployedAt).toLocaleDateString()}
                    </Text>
                  </HStack>

                  <HStack justify="space-between">
                    <Text fontWeight="bold">Session Keys:</Text>
                    <Badge colorScheme={activeSessionKeys.length > 0 ? 'green' : 'gray'}>
                      {activeSessionKeys.length} Active
                    </Badge>
                  </HStack>
                </VStack>

                <Divider />

                {/* Warning if relayer is not an owner */}
                <Alert status="warning" borderRadius="md">
                  <AlertIcon />
                  <VStack align="stretch" spacing={2} flex={1}>
                    <AlertDescription>
                      ⚠️ Your Safe needs the relayer as an owner to send transactions. Click below
                      to enable gasless transactions.
                    </AlertDescription>
                    <Button
                      size="sm"
                      colorScheme="orange"
                      onClick={handleAddRelayerAsOwner}
                      isLoading={isAddingOwner}
                      loadingText="Adding Relayer..."
                    >
                      Add Relayer as Owner
                    </Button>
                  </VStack>
                </Alert>

                <HStack spacing={3}>
                  <Button
                    colorScheme="blue"
                    onClick={onOpen}
                    isDisabled={parseInt(balance) === 0}
                    flex={1}
                  >
                    Send Transaction
                  </Button>
                  <Button variant="outline" onClick={handleExportData} leftIcon={<FiDownload />}>
                    Export
                  </Button>
                </HStack>
              </VStack>
            </Box>

            {/* Session Keys Section */}
            <Box borderWidth="1px" borderRadius="lg" p={6}>
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between">
                  <Box>
                    <Heading size="md" mb={1}>
                      Session Keys
                    </Heading>
                    <Text fontSize="sm" color="gray.400">
                      Enable gasless transactions without signing each time
                    </Text>
                  </Box>
                  <Button
                    colorScheme="purple"
                    onClick={handleCreateSessionKey}
                    isLoading={isCreatingSessionKey}
                    leftIcon={<FiKey />}
                    size="sm"
                  >
                    Create Session Key
                  </Button>
                </HStack>

                {safeData.sessionKeys.length > 0 ? (
                  <Box overflowX="auto">
                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Address</Th>
                          <Th>Status</Th>
                          <Th>Expires</Th>
                          <Th>Spending Limit</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {safeData.sessionKeys.map((key, idx) => (
                          <Tr key={idx}>
                            <Td>
                              <Code fontSize="xs">
                                {key.keyAddress.slice(0, 6)}...{key.keyAddress.slice(-4)}
                              </Code>
                            </Td>
                            <Td>
                              <Badge colorScheme={key.isActive ? 'green' : 'gray'}>
                                {key.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </Td>
                            <Td fontSize="xs">{new Date(key.expiresAt).toLocaleDateString()}</Td>
                            <Td fontSize="xs">
                              {(parseInt(key.permissions.spendingLimit) / 1e18).toFixed(2)}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                ) : (
                  <Alert status="info">
                    <AlertIcon />
                    <AlertDescription>
                      No session keys yet. Create one to enable gasless transactions!
                    </AlertDescription>
                  </Alert>
                )}
              </VStack>
            </Box>

            {/* Comparison Panel */}
            <Box borderWidth="1px" borderRadius="lg" p={6} bg="gray.900">
              <Heading size="sm" mb={4}>
                💡 Traditional Wallet vs W3PK + Safe
              </Heading>
              <HStack spacing={8} align="start">
                <VStack align="stretch" flex={1} spacing={2}>
                  <Text fontWeight="bold" fontSize="sm">
                    Traditional Wallet
                  </Text>
                  <Text fontSize="xs" color="gray.400">
                    ❌ Signature needed for every transaction
                  </Text>
                  <Text fontSize="xs" color="gray.400">
                    ❌ Must pay gas fees
                  </Text>
                  <Text fontSize="xs" color="gray.400">
                    ❌ Limited to EOA features
                  </Text>
                </VStack>
                <VStack align="stretch" flex={1} spacing={2}>
                  <Text fontWeight="bold" fontSize="sm" color="blue.300">
                    W3PK + Safe
                  </Text>
                  <Text fontSize="xs" color="green.300">
                    ✅ One signature to deploy
                  </Text>
                  <Text fontSize="xs" color="green.300">
                    ✅ Gasless transactions via relayer
                  </Text>
                  <Text fontSize="xs" color="green.300">
                    ✅ Smart wallet capabilities
                  </Text>
                </VStack>
              </HStack>
            </Box>
          </VStack>
        )}
      </VStack>

      {/* Send Transaction Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Send Transaction</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              {activeSessionKeys.length > 0 && (
                <Alert status="success" fontSize="sm">
                  <AlertIcon />
                  <AlertDescription>Using session key - no signature required!</AlertDescription>
                </Alert>
              )}

              <FormControl isRequired>
                <FormLabel>Recipient Address</FormLabel>
                <Input
                  placeholder="0x..."
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Amount (in wei)</FormLabel>
                <Input
                  type="number"
                  placeholder="1000000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </FormControl>

              <Button
                colorScheme="blue"
                width="100%"
                onClick={handleSendTransaction}
                isLoading={isSendingTx}
                isDisabled={!recipient || !amount}
              >
                Send Transaction
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Container>
  )
}
