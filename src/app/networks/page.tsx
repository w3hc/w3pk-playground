'use client'

import {
  Container,
  Heading,
  Text,
  Box,
  VStack,
  HStack,
  Button,
  Grid,
  Code,
  useToast,
  IconButton,
  Tooltip,
  Badge,
  Select,
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import { FiCopy, FiRefreshCw, FiCheck, FiX } from 'react-icons/fi'
import { createWeb3Passkey } from 'w3pk'

interface Network {
  name: string
  chainId: number
  isTestnet: boolean
}

const NETWORKS: Network[] = [
  { name: 'Ethereum', chainId: 1, isTestnet: false },
  { name: 'Ethereum Sepolia', chainId: 11155111, isTestnet: true },
  { name: 'Optimism', chainId: 10, isTestnet: false },
  { name: 'Optimism Sepolia', chainId: 11155420, isTestnet: true },
  { name: 'Base', chainId: 8453, isTestnet: false },
  { name: 'Base Sepolia', chainId: 84532, isTestnet: true },
  { name: 'Arbitrum', chainId: 42161, isTestnet: false },
  { name: 'Arbitrum Sepolia', chainId: 421614, isTestnet: true },
  { name: 'zkSync', chainId: 324, isTestnet: false },
  { name: 'zkSync Sepolia', chainId: 300, isTestnet: true },
  { name: 'INK', chainId: 57073, isTestnet: false },
  { name: 'INK Sepolia', chainId: 763373, isTestnet: true },
  { name: 'Gnosis', chainId: 100, isTestnet: false },
  { name: 'Gnosis Chiado', chainId: 10200, isTestnet: true },
  { name: 'Celo', chainId: 42220, isTestnet: false },
  { name: 'Celo Alfajores', chainId: 44787, isTestnet: true },
  { name: 'Polygon', chainId: 137, isTestnet: false },
  { name: 'Polygon Amoy', chainId: 80002, isTestnet: true },
  { name: 'Lukso', chainId: 42, isTestnet: false },
  { name: 'Lukso Testnet', chainId: 4201, isTestnet: true },
  { name: 'Avalanche', chainId: 43114, isTestnet: false },
  { name: 'Avalanche Fuji', chainId: 43113, isTestnet: true },
]

export default function NetworksPage() {
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null)
  const [endpoints, setEndpoints] = useState<string[]>([])
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null)
  const [availableEndpoints, setAvailableEndpoints] = useState<Set<string>>(new Set())
  const [failedEndpoints, setFailedEndpoints] = useState<Set<string>>(new Set())
  const [otherNetworks, setOtherNetworks] = useState<Network[]>([])
  const [loadingOtherNetworks, setLoadingOtherNetworks] = useState(false)
  const [supportsEIP7702, setSupportsEIP7702] = useState<boolean | null>(null)
  const [checkingEIP7702, setCheckingEIP7702] = useState(false)
  const toast = useToast()

  // Fetch all EVM networks from Chainlist
  useEffect(() => {
    const fetchOtherNetworks = async () => {
      setLoadingOtherNetworks(true)
      try {
        const response = await fetch('https://chainid.network/chains.json')
        const chains = await response.json()

        // Filter out networks that are already in our main list
        const mainNetworkChainIds = new Set(NETWORKS.map(n => n.chainId))
        const otherChains = chains
          .filter((chain: any) => !mainNetworkChainIds.has(chain.chainId))
          .map((chain: any) => ({
            name: chain.name,
            chainId: chain.chainId,
            isTestnet:
              chain.name.toLowerCase().includes('test') ||
              chain.name.toLowerCase().includes('sepolia') ||
              chain.name.toLowerCase().includes('goerli') ||
              chain.name.toLowerCase().includes('holesky') ||
              chain.name.toLowerCase().includes('devnet'),
          }))
          .sort((a: Network, b: Network) => a.name.localeCompare(b.name))

        setOtherNetworks(otherChains)
      } catch (error) {
        console.error('Failed to fetch chainlist:', error)
      } finally {
        setLoadingOtherNetworks(false)
      }
    }

    fetchOtherNetworks()
  }, [])

  const handleNetworkSelect = async (network: Network) => {
    setSelectedNetwork(network)
    setEndpoints([])
    setAvailableEndpoints(new Set())
    setFailedEndpoints(new Set())
    setSupportsEIP7702(null)

    try {
      // Create a w3pk instance to access getEndpoints
      const w3pk = createWeb3Passkey({
        debug: process.env.NODE_ENV === 'development',
      })

      // Get endpoints for the selected network
      const networkEndpoints = await w3pk.getEndpoints(network.chainId)

      if (networkEndpoints && networkEndpoints.length > 0) {
        setEndpoints(networkEndpoints)

        // Check EIP-7702 support
        setCheckingEIP7702(true)
        try {
          const eip7702Support = await w3pk.supportsEIP7702(network.chainId)
          setSupportsEIP7702(eip7702Support)
        } catch (eipError) {
          console.error('Failed to check EIP-7702 support:', eipError)
          setSupportsEIP7702(null)
        } finally {
          setCheckingEIP7702(false)
        }
      } else {
        toast({
          title: 'No Endpoints Found',
          description: `No RPC endpoints found for ${network.name}`,
          status: 'info',
          duration: 3000,
          isClosable: true,
        })
      }
    } catch (error: any) {
      console.error('Failed to get endpoints:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to get endpoints',
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
    }
  }

  const copyEndpoint = (endpoint: string) => {
    navigator.clipboard.writeText(endpoint)
    toast({
      title: 'Copied',
      description: 'Endpoint copied to clipboard',
      status: 'success',
      duration: 2000,
      isClosable: true,
    })
  }

  const testEndpoint = async (endpoint: string) => {
    setTestingEndpoint(endpoint)

    try {
      // Send a minimal eth_blockNumber request
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.result) {
          // Mark endpoint as available
          setAvailableEndpoints(prev => new Set(prev).add(endpoint))

          toast({
            title: 'Endpoint Available',
            description: `Successfully connected to ${endpoint}`,
            status: 'success',
            duration: 2000,
            isClosable: true,
          })
        } else {
          throw new Error('Invalid response')
        }
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error: any) {
      console.error('Endpoint test failed:', error)

      // Mark endpoint as failed
      setFailedEndpoints(prev => new Set(prev).add(endpoint))

      toast({
        title: 'Endpoint Unavailable',
        description: `Failed to connect: ${error.message}`,
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setTestingEndpoint(null)
    }
  }

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="lg" mb={4}>
            RPC Endpoints
          </Heading>
          <Text color="gray.400" mb={6}>
            Select a network to view available RPC endpoints
          </Text>
        </Box>

        <Grid templateColumns={{ base: '1fr', md: '300px 1fr' }} gap={6}>
          {/* Network Selection Sidebar */}
          <VStack spacing={3} align="stretch">
            <Text fontSize="sm" fontWeight="bold" color="gray.300" mb={2}>
              Mainnets
            </Text>
            {NETWORKS.filter(n => !n.isTestnet).map(network => (
              <Button
                key={network.chainId}
                onClick={() => handleNetworkSelect(network)}
                variant={selectedNetwork?.chainId === network.chainId ? 'solid' : 'outline'}
                bg={selectedNetwork?.chainId === network.chainId ? '#8c1c84' : 'transparent'}
                color={selectedNetwork?.chainId === network.chainId ? 'white' : 'gray.300'}
                borderColor="#8c1c84"
                _hover={{
                  bg: selectedNetwork?.chainId === network.chainId ? '#6d1566' : '#8c1c8420',
                }}
                justifyContent="flex-start"
                size="sm"
              >
                {network.name}
              </Button>
            ))}

            <Text fontSize="sm" fontWeight="bold" color="gray.300" mb={2} mt={4}>
              Testnets
            </Text>
            {NETWORKS.filter(n => n.isTestnet).map(network => (
              <Button
                key={network.chainId}
                onClick={() => handleNetworkSelect(network)}
                variant={selectedNetwork?.chainId === network.chainId ? 'solid' : 'outline'}
                bg={selectedNetwork?.chainId === network.chainId ? '#8c1c84' : 'transparent'}
                color={selectedNetwork?.chainId === network.chainId ? 'white' : 'gray.300'}
                borderColor="#8c1c84"
                _hover={{
                  bg: selectedNetwork?.chainId === network.chainId ? '#6d1566' : '#8c1c8420',
                }}
                justifyContent="flex-start"
                size="sm"
              >
                {network.name}
              </Button>
            ))}

            <Text fontSize="sm" fontWeight="bold" color="gray.300" mb={2} mt={4}>
              Others
            </Text>
            <Select
              placeholder={loadingOtherNetworks ? 'Loading networks...' : 'Select a network...'}
              size="sm"
              bg="gray.800"
              borderColor="#8c1c84"
              color="gray.300"
              _hover={{ borderColor: '#6d1566' }}
              _focus={{ borderColor: '#8c1c84', boxShadow: '0 0 0 1px #8c1c84' }}
              isDisabled={loadingOtherNetworks}
              value={
                selectedNetwork && !NETWORKS.find(n => n.chainId === selectedNetwork.chainId)
                  ? selectedNetwork.chainId
                  : ''
              }
              onChange={e => {
                const chainId = parseInt(e.target.value)
                const network = otherNetworks.find(n => n.chainId === chainId)
                if (network) {
                  handleNetworkSelect(network)
                }
              }}
            >
              <optgroup label="Mainnets">
                {otherNetworks
                  .filter(n => !n.isTestnet)
                  .map(network => (
                    <option key={network.chainId} value={network.chainId}>
                      {network.name} (Chain ID: {network.chainId})
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Testnets">
                {otherNetworks
                  .filter(n => n.isTestnet)
                  .map(network => (
                    <option key={network.chainId} value={network.chainId}>
                      {network.name} (Chain ID: {network.chainId})
                    </option>
                  ))}
              </optgroup>
            </Select>
          </VStack>

          {/* Endpoints Display */}
          <Box>
            {!selectedNetwork ? (
              <Box
                bg="gray.800"
                p={8}
                borderRadius="md"
                textAlign="center"
                border="1px dashed"
                borderColor="gray.700"
              >
                <Text color="gray.400">Select a network to view endpoints</Text>
              </Box>
            ) : endpoints.length === 0 ? (
              <Box
                bg="gray.800"
                p={8}
                borderRadius="md"
                textAlign="center"
                border="1px solid"
                borderColor="gray.700"
              >
                <Text color="gray.400">Loading endpoints...</Text>
              </Box>
            ) : (
              <VStack spacing={4} align="stretch">
                <HStack justify="space-between" mb={2}>
                  <Box>
                    <Heading size="md" mb={1}>
                      {selectedNetwork.name}
                    </Heading>
                    <VStack spacing={1} align="flex-start">
                      <HStack spacing={2}>
                        <Badge
                          colorScheme={selectedNetwork.isTestnet ? 'orange' : 'green'}
                          fontSize="xs"
                        >
                          {selectedNetwork.isTestnet ? 'Testnet' : 'Mainnet'}
                        </Badge>
                        <Text fontSize="xs" color="gray.500">
                          Chain ID: {selectedNetwork.chainId}
                        </Text>
                      </HStack>
                      {checkingEIP7702 ? (
                        <Text fontSize="xs" color="gray.400">
                          Checking EIP-7702 support...
                        </Text>
                      ) : supportsEIP7702 !== null ? (
                        <Text
                          fontSize="xs"
                          color={supportsEIP7702 ? 'green.400' : 'red.400'}
                          fontWeight="medium"
                        >
                          {supportsEIP7702 ? '✓ Supports EIP-7702' : '✗ Does NOT support EIP-7702'}
                        </Text>
                      ) : null}
                    </VStack>
                  </Box>
                  <Text fontSize="sm" color="gray.400">
                    {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''} available
                  </Text>
                </HStack>

                {endpoints.map((endpoint, idx) => (
                  <Box
                    key={idx}
                    bg="gray.800"
                    p={4}
                    borderRadius="md"
                    border="1px solid"
                    borderColor="gray.700"
                    _hover={{ borderColor: 'gray.600' }}
                  >
                    <HStack justify="space-between" align="center">
                      <Code
                        flex="1"
                        fontSize="sm"
                        cursor="pointer"
                        onClick={() => copyEndpoint(endpoint)}
                        _hover={{ bg: 'gray.600' }}
                        title="Click to copy"
                        p={2}
                        borderRadius="md"
                        wordBreak="break-all"
                        whiteSpace="normal"
                      >
                        {endpoint}
                      </Code>

                      <HStack spacing={2} ml={3}>
                        <Tooltip label="Copy endpoint" placement="top">
                          <IconButton
                            aria-label="Copy endpoint"
                            icon={<FiCopy />}
                            size="sm"
                            variant="ghost"
                            onClick={() => copyEndpoint(endpoint)}
                          />
                        </Tooltip>

                        {availableEndpoints.has(endpoint) ? (
                          <Tooltip label="Endpoint is available" placement="top">
                            <IconButton
                              aria-label="Available"
                              icon={<FiCheck />}
                              size="sm"
                              variant="ghost"
                              colorScheme="green"
                              color="green.400"
                              cursor="default"
                              isDisabled
                            />
                          </Tooltip>
                        ) : failedEndpoints.has(endpoint) ? (
                          <Tooltip label="Endpoint test failed" placement="top">
                            <IconButton
                              aria-label="Failed"
                              icon={<FiX />}
                              size="sm"
                              variant="ghost"
                              colorScheme="red"
                              color="red.400"
                              cursor="pointer"
                              onClick={() => {
                                // Remove from failed set to allow retesting
                                setFailedEndpoints(prev => {
                                  const newSet = new Set(prev)
                                  newSet.delete(endpoint)
                                  return newSet
                                })
                                testEndpoint(endpoint)
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Tooltip label="Test availability" placement="top">
                            <IconButton
                              aria-label="Test availability"
                              icon={<FiRefreshCw />}
                              size="sm"
                              variant="ghost"
                              onClick={() => testEndpoint(endpoint)}
                              isLoading={testingEndpoint === endpoint}
                            />
                          </Tooltip>
                        )}
                      </HStack>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </Grid>

        <Box bg="gray.800" p={4} borderRadius="md" mt={6}>
          <Text fontSize="sm" color="gray.400" mb={2}>
            <strong>About RPC Endpoints:</strong>
          </Text>
          <Text fontSize="xs" color="gray.500" mb={3}>
            RPC (Remote Procedure Call) endpoints allow you to interact with blockchain networks.
            These endpoints are provided by w3pk and are sourced from various reliable providers.
          </Text>
          <Text fontSize="xs" color="gray.500" mb={3}>
            Click on any endpoint to copy it to your clipboard. Use the refresh button to test if an
            endpoint is currently available and responding. The availability test sends a simple
            eth_blockNumber request to verify connectivity.
          </Text>

          <Text fontSize="sm" color="gray.400" mb={2} mt={4}>
            <strong>Why Running Your Own Node Matters:</strong>
          </Text>
          <Text fontSize="xs" color="gray.500" mb={3}>
            While public RPC endpoints are convenient for development and testing, running your own
            node is crucial for Ethereum&apos;s decentralization and network health. Running your
            own node gives you full control over your infrastructure, eliminates reliance on third
            parties, and contributes to the security and resilience of the network.{' '}
            <Text
              as="span"
              color="blue.300"
              textDecoration="underline"
              cursor="pointer"
              onClick={() =>
                window.open(
                  'https://docs.ethstaker.org/getting-started/ethereum-node/',
                  '_blank',
                  'noopener,noreferrer'
                )
              }
            >
              You don&apos;t need any ETH to run a node
            </Text>
            —only if you want to become a validator and earn staking rewards (which requires 32
            ETH).
          </Text>
          <Text fontSize="xs" color="gray.500" mb={3}>
            <strong>Getting Started:</strong> Tools like{' '}
            <Text as="span" color="blue.300">
              Sedge
            </Text>{' '}
            (one-click setup),{' '}
            <Text as="span" color="blue.300">
              eth-docker
            </Text>{' '}
            (Docker automation), and{' '}
            <Text as="span" color="blue.300">
              EthPillar
            </Text>{' '}
            make it easier than ever to run your own Ethereum node. The{' '}
            <Text as="span" color="blue.300">
              EthStaker community
            </Text>{' '}
            provides comprehensive guides and support.
          </Text>
          <Text fontSize="xs" color="yellow.300" mb={3}>
            <strong>Minimum specs:</strong> 16GB+ RAM (32GB recommended), 2TB+ NVMe SSD, stable
            internet with UPS backup. Linux is strongly recommended for better community support.
          </Text>
          <Text fontSize="xs" color="purple.300">
            Learn more:{' '}
            <Text
              as="span"
              textDecoration="underline"
              cursor="pointer"
              onClick={() =>
                window.open(
                  'https://ethereum.org/en/staking/solo/',
                  '_blank',
                  'noopener,noreferrer'
                )
              }
            >
              ethereum.org/staking/solo
            </Text>
            {' • '}
            <Text
              as="span"
              textDecoration="underline"
              cursor="pointer"
              onClick={() =>
                window.open('https://docs.ethstaker.org/', '_blank', 'noopener,noreferrer')
              }
            >
              docs.ethstaker.org
            </Text>
            {' • '}
            <Text
              as="span"
              textDecoration="underline"
              cursor="pointer"
              onClick={() =>
                window.open('https://docs.sedge.nethermind.io/', '_blank', 'noopener,noreferrer')
              }
            >
              docs.sedge.nethermind.io
            </Text>
          </Text>
        </Box>
      </VStack>
    </Container>
  )
}
