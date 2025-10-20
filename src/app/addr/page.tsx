'use client'

import {
  Container,
  Heading,
  Text,
  useToast,
  Button,
  Box,
  VStack,
  Alert,
  AlertIcon,
  AlertDescription,
  Flex,
  IconButton,
  Code,
  Tooltip,
} from '@chakra-ui/react'
import { useW3PK } from '@/context/W3PK'
import Spinner from '@/components/Spinner'
import { useState } from 'react'
import { FiEdit3, FiCheck } from 'react-icons/fi'

interface DerivedAddress {
  address: string
  index: number
  signed?: boolean
}

export default function Addresses() {
  const { isAuthenticated, user, signMessage, deriveWallet } = useW3PK()
  const toast = useToast()

  const [addresses, setAddresses] = useState<DerivedAddress[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [signingIndex, setSigningIndex] = useState<number | null>(null)

  const deriveAddresses = async (count: number = 10) => {
    if (!deriveWallet) {
      toast({
        title: 'Not Available',
        description: 'Wallet derivation is not available',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    setIsLoading(true)
    try {
      // Note: deriveWallet internally requires fresh WebAuthn authentication
      // The SDK will prompt for biometric/passkey authentication automatically

      const startIndex = addresses.length
      const newAddresses: DerivedAddress[] = []

      // Derive addresses one by one (each requires authentication)
      for (let i = 0; i < count; i++) {
        const index = startIndex + i
        try {
          const derivedWallet = await deriveWallet(index)
          newAddresses.push({
            address: derivedWallet.address,
            index: index,
          })
        } catch (error: any) {
          console.error(`Failed to derive address #${index}:`, error)

          // If authentication failed, stop trying
          if (error.message?.includes('Not authenticated') || error.message?.includes('login')) {
            toast({
              title: 'Authentication Required',
              description: 'Please authenticate to derive addresses',
              status: 'warning',
              duration: 4000,
              isClosable: true,
            })
            break
          }
          // For other errors, continue with next address
        }
      }

      if (newAddresses.length > 0) {
        setAddresses([...addresses, ...newAddresses])

        toast({
          title: 'Addresses Derived',
          description: `Successfully derived ${newAddresses.length} new address${newAddresses.length !== 1 ? 'es' : ''}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      } else {
        throw new Error('No addresses could be derived. Authentication may be required.')
      }
    } catch (error: any) {
      console.error('Address derivation failed:', error)
      toast({
        title: 'Derivation Failed',
        description: error.message || 'Failed to derive addresses. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignMessage = async (address: string, index: number) => {
    setSigningIndex(index)
    try {
      const message = 'Hello sig!'
      const signature = await signMessage(message)

      if (signature) {
        console.log(`Marking address #${index} as signed`)

        // Update the address to mark it as signed
        setAddresses(prevAddresses => {
          const updated = prevAddresses.map(addr =>
            addr.index === index ? { ...addr, signed: true } : addr
          )
          console.log('Updated addresses:', updated)
          return updated
        })

        toast({
          title: 'Message Signed',
          description: `Successfully signed "Hello sig!" with address #${index}`,
          status: 'success',
          duration: 4000,
          isClosable: true,
        })
      }
    } catch (error: any) {
      console.error('Signing failed:', error)
    } finally {
      setSigningIndex(null)
    }
  }

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    toast({
      title: 'Copied',
      description: 'Address copied to clipboard',
      status: 'info',
      duration: 2000,
      isClosable: true,
    })
  }

  if (!isAuthenticated) {
    return (
      <Container maxW="container.sm" py={20}>
        <VStack spacing={8} align="stretch">
          <Box bg="whiteAlpha.50" p={6} borderRadius="md" textAlign="center">
            <Alert status="warning" bg="transparent" color="orange.200">
              <AlertIcon />
              <AlertDescription>
                Please log in to access address management functionality.
              </AlertDescription>
            </Alert>
          </Box>
        </VStack>
      </Container>
    )
  }

  return (
    <Container maxW="container.lg" py={10}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="lg" mb={4}>
            My Addresses
          </Heading>
          <Text color="gray.400" mb={6}>
            Derive multiple addresses from your HD wallet
          </Text>
        </Box>

        <VStack spacing={6} align="stretch">
          <Box bg="gray.800" p={4} borderRadius="md">
            <Text fontSize="sm" color="gray.400" mb={2}>
              Logged in as: <strong>{user?.displayName || user?.username}</strong>
            </Text>
            <Text fontSize="xs" color="gray.500" mb={2}>
              Primary Address:
              <Code
                fontSize="xs"
                ml={2}
                cursor="pointer"
                onClick={() => user?.ethereumAddress && copyAddress(user.ethereumAddress)}
                _hover={{ bg: 'gray.600' }}
                title="Click to copy"
              >
                {user?.ethereumAddress}
              </Code>
            </Text>
            <Text fontSize="xs" color="blue.300">
              🔐 All addresses are derived from your encrypted seed phrase
            </Text>
          </Box>

          {addresses.length === 0 && (
            <Flex gap={3}>
              <Button
                bg="#8c1c84"
                color="white"
                _hover={{ bg: '#6d1566' }}
                onClick={() => deriveAddresses(10)}
                isLoading={isLoading}
                spinner={<Spinner size="16px" />}
                loadingText="Deriving..."
                size="lg"
                flex="1"
              >
                Derive 10 Addresses
              </Button>
            </Flex>
          )}

          {addresses.length > 0 && (
            <Box>
              <Text fontSize="sm" color="gray.400" mb={4}>
                Showing {addresses.length} derived address{addresses.length !== 1 ? 'es' : ''}
              </Text>

              <VStack spacing={3} align="stretch">
                {addresses.map((addr, idx) => (
                  <Flex
                    key={idx}
                    bg="gray.800"
                    p={4}
                    borderRadius="md"
                    border="1px solid"
                    borderColor="gray.700"
                    align="center"
                    justify="space-between"
                    _hover={{ borderColor: 'gray.600' }}
                  >
                    <Box flex="1">
                      <Text fontSize="xs" color="gray.500" mb={1}>
                        Address #{addr.index}
                      </Text>
                      <Code
                        fontSize="sm"
                        cursor="pointer"
                        onClick={() => copyAddress(addr.address)}
                        _hover={{ bg: 'gray.600' }}
                        title="Click to copy"
                      >
                        {addr.address}
                      </Code>
                    </Box>

                    <Tooltip
                      label={addr.signed ? 'Signed ✓' : 'Sign "Hello sig!"'}
                      placement="left"
                    >
                      <IconButton
                        aria-label={addr.signed ? 'Signed' : 'Sign message'}
                        icon={addr.signed ? <FiCheck /> : <FiEdit3 />}
                        variant="ghost"
                        size="sm"
                        colorScheme={addr.signed ? 'green' : 'purple'}
                        onClick={() => !addr.signed && handleSignMessage(addr.address, addr.index)}
                        isLoading={signingIndex === addr.index}
                        spinner={<Spinner size="14px" />}
                        isDisabled={addr.signed}
                        ml={3}
                        color={addr.signed ? 'green.400' : undefined}
                        cursor={addr.signed ? 'default' : 'pointer'}
                      />
                    </Tooltip>
                  </Flex>
                ))}
              </VStack>

              <Flex justify="center" mt={6}>
                <Button
                  bg="whiteAlpha.100"
                  color="#8c1c84"
                  size="sm"
                  onClick={() => deriveAddresses(10)}
                  isLoading={isLoading}
                  spinner={<Spinner size="14px" />}
                  loadingText="Deriving..."
                  _hover={{ bg: '#8c1c84', color: 'white' }}
                  border="1px solid"
                  borderColor="#8c1c84"
                >
                  Display 10 More Addresses
                </Button>
              </Flex>
            </Box>
          )}
        </VStack>

        <Box bg="gray.800" p={4} borderRadius="md">
          <Text fontSize="sm" color="gray.400" mb={2}>
            <strong>About HD Wallets:</strong>
          </Text>
          <Text fontSize="xs" color="gray.500" mb={3}>
            Your wallet uses BIP39/BIP44 standards to derive multiple addresses from a single seed
            phrase. Each derived address is deterministic and can be regenerated from your seed.
          </Text>
          <Text fontSize="xs" color="gray.500" mb={3}>
            The signing feature uses your passkey authentication to unlock the encrypted seed and
            sign messages with the specific derived address's private key.
          </Text>
          <Text fontSize="xs" color="yellow.300">
            🔒 Security Note: All private keys remain encrypted and never leave your device. Each
            signing operation requires fresh biometric authentication (optional).
          </Text>
        </Box>
      </VStack>
    </Container>
  )
}
