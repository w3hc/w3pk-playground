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
  Code,
  Badge,
  HStack,
  Divider,
  IconButton,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  SimpleGrid,
  Icon,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
} from '@chakra-ui/react'
import { useW3PK } from '@/context/W3PK'
import Spinner from '@/components/Spinner'
import { useState } from 'react'
import { FiEye, FiEyeOff, FiCopy, FiCheck, FiShield, FiKey, FiZap } from 'react-icons/fi'

interface StealthAnnouncement {
  stealthAddress: string
  ephemeralPublicKey: string
  viewTag: string
  timestamp: number
}

export default function StealthAddresses() {
  const { isAuthenticated, user, getStealthKeys, generateStealthAddressFor } = useW3PK()
  const toast = useToast()

  const [metaAddress, setMetaAddress] = useState<string>('')
  const [spendingPubKey, setSpendingPubKey] = useState<string>('')
  const [viewingPubKey, setViewingPubKey] = useState<string>('')
  const [isLoadingKeys, setIsLoadingKeys] = useState(false)

  const [announcements, setAnnouncements] = useState<StealthAnnouncement[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [showPrivateKeys, setShowPrivateKeys] = useState(false)
  const [viewingKey, setViewingKey] = useState<string>('')
  const [spendingKey, setSpendingKey] = useState<string>('')

  const [recipientMetaAddress, setRecipientMetaAddress] = useState<string>('')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const loadStealthKeys = async () => {
    setIsLoadingKeys(true)
    try {
      const keys = await getStealthKeys()
      if (keys) {
        // @ts-ignore - Using new ERC-5564 types that may not be in current w3pk version
        const metaAddr = keys.stealthMetaAddress || keys.metaAddress || ''
        console.log('Loaded meta address:', metaAddr)
        console.log('Meta address length:', metaAddr.length)
        setMetaAddress(metaAddr)
        // @ts-ignore - Using new ERC-5564 types
        setSpendingPubKey(keys.spendingPubKey || '')
        // @ts-ignore - Using new ERC-5564 types
        setViewingPubKey(keys.viewingPubKey || '')
        setViewingKey(keys.viewingKey || '')
        setSpendingKey(keys.spendingKey || '')

        toast({
          title: 'Stealth Keys Loaded',
          description: 'Your ERC-5564 stealth keys have been generated',
          status: 'success',
          duration: 3000,
          isClosable: true,
        })
      }
    } catch (error: any) {
      console.error('Failed to load stealth keys:', error)
      toast({
        title: 'Failed to Load Keys',
        description: error.message || 'Could not generate stealth keys',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsLoadingKeys(false)
    }
  }

  const generateStealthAddress = async () => {
    if (!recipientMetaAddress || recipientMetaAddress.length !== 134) {
      toast({
        title: 'Invalid Meta-Address',
        description: 'Please enter a valid 66-byte stealth meta-address (0x + 132 hex chars)',
        status: 'warning',
        duration: 4000,
        isClosable: true,
      })
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateStealthAddressFor(recipientMetaAddress)

      if (result) {
        const announcement: StealthAnnouncement = {
          stealthAddress: result.stealthAddress,
          ephemeralPublicKey: result.ephemeralPublicKey,
          viewTag: result.viewTag,
          timestamp: Date.now(),
        }

        setAnnouncements([announcement, ...announcements])

        toast({
          title: 'Stealth Address Generated! 🎉',
          description: 'Announcement created - send funds to this address',
          status: 'success',
          duration: 4000,
          isClosable: true,
        })
      }
    } catch (error: any) {
      console.error('Failed to generate stealth address:', error)
      toast({
        title: 'Generation Failed',
        description: error.message || 'Could not generate stealth address',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(label)
    setTimeout(() => setCopiedField(null), 2000)

    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
      status: 'info',
      duration: 2000,
      isClosable: true,
    })
  }

  const clearAnnouncements = () => {
    setAnnouncements([])
    toast({
      title: 'Cleared',
      description: 'All announcements have been cleared',
      status: 'info',
      duration: 2000,
      isClosable: true,
    })
  }

  if (!isAuthenticated) {
    return (
      <Container maxW="container.md" py={20}>
        <VStack spacing={8} align="stretch">
          <Box bg="whiteAlpha.50" p={6} borderRadius="md" textAlign="center">
            <Alert status="warning" bg="transparent" color="orange.200">
              <AlertIcon />
              <AlertDescription>
                Please log in to access ERC-5564 stealth address functionality.
              </AlertDescription>
            </Alert>
          </Box>
        </VStack>
      </Container>
    )
  }

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Box textAlign="center">
          <HStack justify="center" mb={2}>
            <Icon as={FiShield} color="#8c1c84" boxSize={8} />
            <Heading as="h1" size="xl">
              ERC-5564 Stealth Addresses
            </Heading>
          </HStack>
          <Text color="gray.400" mb={2}>
            Privacy-preserving transactions with view tag optimization
          </Text>
          <HStack justify="center" spacing={2}>
            <Badge colorScheme="purple" fontSize="xs">
              ERC-5564
            </Badge>
            <Badge colorScheme="green" fontSize="xs">
              SECP256k1
            </Badge>
            <Badge colorScheme="blue" fontSize="xs">
              View Tags
            </Badge>
          </HStack>
        </Box>

        {/* User Info */}
        <Box bg="gray.800" p={4} borderRadius="md">
          <Text fontSize="sm" color="gray.400" mb={2}>
            Logged in as: <strong>{user?.displayName || user?.username}</strong>
          </Text>
          <Text fontSize="xs" color="gray.500" mb={2}>
            Primary Address:{' '}
            <Code fontSize="xs" ml={2}>
              {user?.ethereumAddress}
            </Code>
          </Text>
          <Text fontSize="xs" color="blue.300">
            🔐 All stealth operations use your encrypted seed phrase
          </Text>
        </Box>

        <Tabs colorScheme="purple" variant="enclosed">
          <TabList>
            <Tab>
              <Icon as={FiKey} mr={2} />
              Recipient Setup
            </Tab>
            <Tab>
              <Icon as={FiZap} mr={2} />
              Sender (Generate)
            </Tab>
            <Tab>
              <Icon as={FiEye} mr={2} />
              About ERC-5564
            </Tab>
          </TabList>

          <TabPanels>
            {/* Tab 1: Recipient Setup */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Box>
                  <Heading size="md" mb={4}>
                    Your Stealth Meta-Address
                  </Heading>
                  <Text fontSize="sm" color="gray.400" mb={4}>
                    Share this publicly to receive stealth payments. It&apos;s 66 bytes (spending +
                    viewing public keys).
                  </Text>

                  {!metaAddress ? (
                    <Button
                      bg="#8c1c84"
                      color="white"
                      _hover={{ bg: '#6d1566' }}
                      onClick={loadStealthKeys}
                      isLoading={isLoadingKeys}
                      spinner={<Spinner size="16px" />}
                      loadingText="Generating Keys..."
                      size="lg"
                      width="full"
                    >
                      Generate Stealth Keys
                    </Button>
                  ) : (
                    <VStack spacing={4} align="stretch">
                      {/* Stealth Meta-Address */}
                      <Box
                        bg="gray.900"
                        p={4}
                        borderRadius="md"
                        border="1px solid"
                        borderColor="gray.700"
                      >
                        <Flex justify="space-between" align="center" mb={2}>
                          <Text fontSize="sm" fontWeight="bold" color="#8c1c84">
                            Stealth Meta-Address (66 bytes)
                          </Text>
                          <IconButton
                            aria-label="Copy meta-address"
                            icon={copiedField === 'meta' ? <FiCheck /> : <FiCopy />}
                            size="sm"
                            variant="ghost"
                            colorScheme={copiedField === 'meta' ? 'green' : 'gray'}
                            onClick={() => copyToClipboard(metaAddress, 'meta')}
                          />
                        </Flex>
                        <Code
                          fontSize="xs"
                          display="block"
                          whiteSpace="pre-wrap"
                          wordBreak="break-all"
                          p={2}
                        >
                          {metaAddress}
                        </Code>
                      </Box>

                      {/* Public Keys */}
                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                        <Box
                          bg="gray.900"
                          p={3}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.700"
                        >
                          <Flex justify="space-between" align="center" mb={2}>
                            <Text fontSize="xs" fontWeight="bold" color="gray.400">
                              Spending Public Key (33 bytes)
                            </Text>
                            <IconButton
                              aria-label="Copy spending pubkey"
                              icon={copiedField === 'spending-pub' ? <FiCheck /> : <FiCopy />}
                              size="xs"
                              variant="ghost"
                              onClick={() => copyToClipboard(spendingPubKey, 'spending-pub')}
                            />
                          </Flex>
                          <Code
                            fontSize="xs"
                            display="block"
                            whiteSpace="pre-wrap"
                            wordBreak="break-all"
                          >
                            {spendingPubKey}
                          </Code>
                        </Box>

                        <Box
                          bg="gray.900"
                          p={3}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.700"
                        >
                          <Flex justify="space-between" align="center" mb={2}>
                            <Text fontSize="xs" fontWeight="bold" color="gray.400">
                              Viewing Public Key (33 bytes)
                            </Text>
                            <IconButton
                              aria-label="Copy viewing pubkey"
                              icon={copiedField === 'viewing-pub' ? <FiCheck /> : <FiCopy />}
                              size="xs"
                              variant="ghost"
                              onClick={() => copyToClipboard(viewingPubKey, 'viewing-pub')}
                            />
                          </Flex>
                          <Code
                            fontSize="xs"
                            display="block"
                            whiteSpace="pre-wrap"
                            wordBreak="break-all"
                          >
                            {viewingPubKey}
                          </Code>
                        </Box>
                      </SimpleGrid>

                      {/* Private Keys (Hidden by Default) */}
                      <Box
                        bg="yellow.900"
                        opacity={0.9}
                        p={4}
                        borderRadius="md"
                        border="1px solid"
                        borderColor="yellow.700"
                      >
                        <Flex justify="space-between" align="center" mb={3}>
                          <Text fontSize="sm" fontWeight="bold" color="yellow.300">
                            🔑 Private Keys (Keep Secret!)
                          </Text>
                          <Button
                            size="sm"
                            variant="ghost"
                            colorScheme="yellow"
                            leftIcon={showPrivateKeys ? <FiEyeOff /> : <FiEye />}
                            onClick={() => setShowPrivateKeys(!showPrivateKeys)}
                          >
                            {showPrivateKeys ? 'Hide' : 'Show'}
                          </Button>
                        </Flex>

                        {showPrivateKeys && (
                          <VStack spacing={3} align="stretch">
                            <Box>
                              <Flex justify="space-between" align="center" mb={1}>
                                <Text fontSize="xs" color="gray.400">
                                  Viewing Private Key
                                </Text>
                                <IconButton
                                  aria-label="Copy viewing key"
                                  icon={copiedField === 'viewing-priv' ? <FiCheck /> : <FiCopy />}
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(viewingKey, 'viewing-priv')}
                                />
                              </Flex>
                              <Code
                                fontSize="xs"
                                display="block"
                                whiteSpace="pre-wrap"
                                wordBreak="break-all"
                              >
                                {viewingKey}
                              </Code>
                            </Box>

                            <Box>
                              <Flex justify="space-between" align="center" mb={1}>
                                <Text fontSize="xs" color="gray.400">
                                  Spending Private Key
                                </Text>
                                <IconButton
                                  aria-label="Copy spending key"
                                  icon={copiedField === 'spending-priv' ? <FiCheck /> : <FiCopy />}
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(spendingKey, 'spending-priv')}
                                />
                              </Flex>
                              <Code
                                fontSize="xs"
                                display="block"
                                whiteSpace="pre-wrap"
                                wordBreak="break-all"
                              >
                                {spendingKey}
                              </Code>
                            </Box>
                          </VStack>
                        )}
                      </Box>

                      {/* Info Box */}
                      <Alert status="info" bg="blue.900" opacity={0.9} borderRadius="md">
                        <AlertIcon />
                        <Box fontSize="sm">
                          <Text fontWeight="bold" mb={1}>
                            How to Use:
                          </Text>
                          <Text fontSize="xs" color="gray.300">
                            1. Share your <strong>stealth meta-address</strong> publicly (Twitter,
                            ENS, etc.)
                            <br />
                            2. Senders use it to generate one-time stealth addresses
                            <br />
                            3. You scan announcements with your <strong>viewing key</strong>
                            <br />
                            4. Compute stealth private key with <strong>spending key</strong> to
                            spend funds
                          </Text>
                        </Box>
                      </Alert>
                    </VStack>
                  )}
                </Box>
              </VStack>
            </TabPanel>

            {/* Tab 2: Sender (Generate) */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Box>
                  <Heading size="md" mb={4}>
                    Generate Stealth Address (Sender)
                  </Heading>
                  <Text fontSize="sm" color="gray.400" mb={4}>
                    Enter the recipient&apos;s stealth meta-address to generate a one-time payment
                    address.
                  </Text>

                  <FormControl mb={4}>
                    <FormLabel fontSize="sm">Recipient&apos;s Stealth Meta-Address</FormLabel>
                    <Input
                      placeholder="0x..."
                      value={recipientMetaAddress}
                      onChange={e => setRecipientMetaAddress(e.target.value)}
                      fontFamily="monospace"
                      fontSize="sm"
                      bg="gray.900"
                      borderColor={
                        recipientMetaAddress.length === 0
                          ? 'gray.700'
                          : recipientMetaAddress.length === 134
                            ? 'green.500'
                            : 'red.500'
                      }
                      _hover={{ borderColor: 'gray.600' }}
                    />
                    <FormHelperText fontSize="xs">
                      {recipientMetaAddress.length > 0 && (
                        <Text
                          as="span"
                          color={recipientMetaAddress.length === 134 ? 'green.400' : 'red.400'}
                          mr={2}
                        >
                          {recipientMetaAddress.length}/134 characters
                          {recipientMetaAddress.length === 134 ? ' ✓' : ''}
                        </Text>
                      )}
                      {recipientMetaAddress.length === 0 && (
                        <Text as="span" color="gray.500">
                          66 bytes (134 characters including 0x prefix)
                        </Text>
                      )}
                      {metaAddress && (
                        <Button
                          size="xs"
                          variant="link"
                          colorScheme="purple"
                          ml={2}
                          onClick={() => setRecipientMetaAddress(metaAddress)}
                        >
                          Use my own (for testing)
                        </Button>
                      )}
                    </FormHelperText>
                  </FormControl>

                  <Button
                    bg="#8c1c84"
                    color="white"
                    _hover={{ bg: '#6d1566' }}
                    onClick={generateStealthAddress}
                    isLoading={isGenerating}
                    spinner={<Spinner size="16px" />}
                    loadingText="Generating..."
                    size="lg"
                    width="full"
                    isDisabled={!recipientMetaAddress || recipientMetaAddress.length !== 134}
                  >
                    Generate Stealth Address
                  </Button>
                </Box>

                <Divider />

                {/* Announcements */}
                <Box>
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Announcements ({announcements.length})</Heading>
                    {announcements.length > 0 && (
                      <Button size="sm" variant="ghost" onClick={clearAnnouncements}>
                        Clear All
                      </Button>
                    )}
                  </Flex>

                  {announcements.length === 0 ? (
                    <Box textAlign="center" py={8} bg="gray.900" borderRadius="md">
                      <Text color="gray.500" fontSize="sm">
                        No stealth addresses generated yet
                      </Text>
                    </Box>
                  ) : (
                    <VStack spacing={4} align="stretch">
                      {announcements.map((announcement, idx) => (
                        <Box
                          key={idx}
                          bg="gray.900"
                          p={4}
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.700"
                        >
                          <Flex justify="space-between" align="center" mb={3}>
                            <Badge colorScheme="purple">
                              Announcement #{announcements.length - idx}
                            </Badge>
                            <Text fontSize="xs" color="gray.500">
                              {new Date(announcement.timestamp).toLocaleTimeString()}
                            </Text>
                          </Flex>

                          <VStack spacing={2} align="stretch" fontSize="xs">
                            <Box>
                              <Flex justify="space-between" align="center">
                                <Text color="gray.400" fontWeight="bold">
                                  💰 Stealth Address (send funds here):
                                </Text>
                                <IconButton
                                  aria-label="Copy stealth address"
                                  icon={copiedField === `addr-${idx}` ? <FiCheck /> : <FiCopy />}
                                  size="xs"
                                  variant="ghost"
                                  onClick={() =>
                                    copyToClipboard(announcement.stealthAddress, `addr-${idx}`)
                                  }
                                />
                              </Flex>
                              <Code
                                display="block"
                                whiteSpace="pre-wrap"
                                wordBreak="break-all"
                                mt={1}
                              >
                                {announcement.stealthAddress}
                              </Code>
                            </Box>

                            <Box>
                              <Flex justify="space-between" align="center">
                                <Text color="gray.400">
                                  Ephemeral Public Key (publish on-chain):
                                </Text>
                                <IconButton
                                  aria-label="Copy ephemeral key"
                                  icon={copiedField === `eph-${idx}` ? <FiCheck /> : <FiCopy />}
                                  size="xs"
                                  variant="ghost"
                                  onClick={() =>
                                    copyToClipboard(announcement.ephemeralPublicKey, `eph-${idx}`)
                                  }
                                />
                              </Flex>
                              <Code
                                display="block"
                                whiteSpace="pre-wrap"
                                wordBreak="break-all"
                                mt={1}
                              >
                                {announcement.ephemeralPublicKey}
                              </Code>
                            </Box>

                            <Box>
                              <Flex justify="space-between" align="center">
                                <Text color="gray.400">
                                  View Tag (1 byte for efficient scanning):
                                </Text>
                                <IconButton
                                  aria-label="Copy view tag"
                                  icon={copiedField === `tag-${idx}` ? <FiCheck /> : <FiCopy />}
                                  size="xs"
                                  variant="ghost"
                                  onClick={() =>
                                    copyToClipboard(announcement.viewTag, `tag-${idx}`)
                                  }
                                />
                              </Flex>
                              <Code display="block" mt={1}>
                                {announcement.viewTag}
                              </Code>
                            </Box>
                          </VStack>

                          <Alert status="success" mt={3} bg="green.900" opacity={0.9} fontSize="xs">
                            <AlertIcon boxSize={3} />
                            <Text>
                              Publish this announcement on-chain (event/tx data), then send funds to
                              the stealth address
                            </Text>
                          </Alert>
                        </Box>
                      ))}
                    </VStack>
                  )}
                </Box>
              </VStack>
            </TabPanel>

            {/* Tab 3: About */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Box>
                  <Heading size="md" mb={4}>
                    What are ERC-5564 Stealth Addresses?
                  </Heading>
                  <Text color="gray.400" mb={4}>
                    Stealth addresses enable privacy-preserving transactions on Ethereum. Each
                    payment uses a unique, unlinkable address that only the recipient can identify
                    and spend from.
                  </Text>

                  <VStack spacing={4} align="stretch">
                    <Box bg="gray.900" p={4} borderRadius="md">
                      <HStack mb={2}>
                        <Icon as={FiShield} color="purple.400" />
                        <Text fontWeight="bold">Privacy Benefits</Text>
                      </HStack>
                      <Text fontSize="sm" color="gray.400">
                        • Each payment uses a unique address
                        <br />
                        • Transactions cannot be linked to your identity
                        <br />
                        • External observers cannot track your payment history
                        <br />• Non-interactive (no communication needed)
                      </Text>
                    </Box>

                    <Box bg="gray.900" p={4} borderRadius="md">
                      <HStack mb={2}>
                        <Icon as={FiZap} color="yellow.400" />
                        <Text fontWeight="bold">View Tag Optimization</Text>
                      </HStack>
                      <Text fontSize="sm" color="gray.400">
                        • View tags are the first byte of the shared secret hash
                        <br />
                        • Recipients can skip ~99% of announcements (255/256 probability)
                        <br />
                        • Makes scanning thousands of announcements practical
                        <br />• Only 1 byte revealed (124-bit security, still safe)
                      </Text>
                    </Box>

                    <Box bg="gray.900" p={4} borderRadius="md">
                      <HStack mb={2}>
                        <Icon as={FiKey} color="blue.400" />
                        <Text fontWeight="bold">How It Works</Text>
                      </HStack>
                      <Text fontSize="sm" color="gray.400" fontFamily="monospace">
                        1. Recipient generates spending + viewing key pairs
                        <br />
                        2. Sender generates ephemeral keypair
                        <br />
                        3. Shared secret = ephemeral_privkey × viewing_pubkey (ECDH)
                        <br />
                        4. View tag = first byte of keccak256(shared_secret)
                        <br />
                        5. Stealth address = spending_pubkey + hash(secret) × G<br />
                        6. Recipient scans with view tag filter
                        <br />
                        7. Computes stealth_privkey = spending_privkey + hash(secret)
                      </Text>
                    </Box>

                    <Box bg="gray.900" p={4} borderRadius="md">
                      <Text fontWeight="bold" mb={2}>
                        📚 Resources
                      </Text>
                      <VStack align="stretch" spacing={2} fontSize="sm">
                        <Text>
                          •{' '}
                          <a
                            href="https://eips.ethereum.org/EIPS/eip-5564"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#8c1c84' }}
                          >
                            ERC-5564 Specification
                          </a>
                        </Text>
                        <Text>
                          •{' '}
                          <a
                            href="https://eips.ethereum.org/EIPS/eip-6538"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#8c1c84' }}
                          >
                            ERC-6538 Registry
                          </a>{' '}
                          (future support)
                        </Text>
                        <Text>
                          •{' '}
                          <a
                            href="https://github.com/w3hc/w3pk"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#8c1c84' }}
                          >
                            w3pk SDK Documentation
                          </a>
                        </Text>
                      </VStack>
                    </Box>

                    <Alert status="warning" bg="orange.900" opacity={0.9}>
                      <AlertIcon />
                      <Box fontSize="sm">
                        <Text fontWeight="bold" mb={1}>
                          Security Note:
                        </Text>
                        <Text fontSize="xs" color="gray.300">
                          Keep your private keys secret! The viewing key allows identifying
                          payments, and the spending key allows spending funds. Never share these
                          with anyone.
                        </Text>
                      </Box>
                    </Alert>
                  </VStack>
                </Box>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Container>
  )
}
