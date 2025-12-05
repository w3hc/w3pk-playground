'use client'

import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Heading,
  Spinner,
  Tooltip as ChakraTooltip,
} from '@chakra-ui/react'
import { IconButton } from '@/components/ui/icon-button'
import { toaster } from '@/components/ui/toaster'
import { FiArrowUpRight, FiArrowDownLeft, FiRefreshCw, FiExternalLink } from 'react-icons/fi'
import { ethers } from 'ethers'
import { Transaction } from '@/lib/safeStorage'
import CustomSpinner from './Spinner'

interface TransactionHistoryProps {
  transactions: Transaction[]
  isLoading: boolean
  onRefresh: () => void
  safeAddress: string
  isError?: boolean
  error?: Error | null
  lastUpdated?: Date | null
  isRefetchingAfterConfirmation?: boolean // True when refetching blockchain data after tx confirmation
}

export function TransactionHistory({
  transactions,
  isLoading,
  onRefresh,
  safeAddress,
  isError = false,
  error = null,
  lastUpdated = null,
  isRefetchingAfterConfirmation = false,
}: TransactionHistoryProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toaster.create({
        title: `${label} copied!`,
        type: 'success',
        duration: 2000,
      })
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'green'
      case 'verified':
        return 'blue'
      case 'pending':
        return 'yellow'
      default:
        return 'gray'
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}m ago`
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const getBlockExplorerUrl = (txHash: string) => {
    // Gnosis Chiado explorer
    return `https://gnosis-chiado.blockscout.com/tx/${txHash}`
  }

  if (isLoading && transactions.length === 0) {
    return (
      <Box bg="gray.900" p={6} borderRadius="lg" border="1px solid" borderColor="gray.700">
        <VStack gap={4} py={8}>
          <Spinner size="lg" color="purple.500" />
          <Text color="gray.400">Loading transactions from blockchain...</Text>
        </VStack>
      </Box>
    )
  }

  if (isError && error) {
    return (
      <Box bg="gray.900" p={6} borderRadius="lg" border="1px solid" borderColor="gray.700">
        <HStack justify="space-between" mb={4}>
          <Heading size="md">Transaction History</Heading>
          <ChakraTooltip.Root>
            <ChakraTooltip.Trigger asChild>
              <IconButton
                aria-label="Retry"
                size="sm"
                variant="ghost"
                onClick={onRefresh}
              >
                <FiRefreshCw />
              </IconButton>
            </ChakraTooltip.Trigger>
            <ChakraTooltip.Positioner>
              <ChakraTooltip.Content>Retry</ChakraTooltip.Content>
            </ChakraTooltip.Positioner>
          </ChakraTooltip.Root>
        </HStack>
        <VStack gap={4} py={8}>
          <Text color="red.400" fontWeight="bold">
            Failed to load transactions
          </Text>
          <Text color="gray.400" fontSize="sm" textAlign="center">
            {error.message}
          </Text>
          <Text color="gray.500" fontSize="xs">
            Click the refresh button to try again
          </Text>
        </VStack>
      </Box>
    )
  }

  return (
    <Box bg="gray.900" p={6} borderRadius="lg" border="1px solid" borderColor="gray.700">
      <HStack justify="space-between" mb={4}>
        <VStack align="start" gap={0}>
          <Heading size="md">Transaction History</Heading>
          {lastUpdated && (
            <Text fontSize="xs" color="gray.500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Text>
          )}
        </VStack>
        <HStack gap={2}>
          <Badge colorPalette="purple" fontSize="xs">
            Onchain
          </Badge>
          <ChakraTooltip.Root>
            <ChakraTooltip.Trigger asChild>
              <IconButton
                aria-label="Refresh transactions"
                size="sm"
                variant="ghost"
                onClick={onRefresh}
              >
                <FiRefreshCw />
              </IconButton>
            </ChakraTooltip.Trigger>
            <ChakraTooltip.Positioner>
              <ChakraTooltip.Content>Refresh transactions</ChakraTooltip.Content>
            </ChakraTooltip.Positioner>
          </ChakraTooltip.Root>
        </HStack>
          {/* {isRefetchingAfterConfirmation ? (
            // <CustomSpinner size="100px" />
            ' '
          ) : (
            <HStack gap={2}>
              <Badge colorScheme="purple" fontSize="xs">
                Onchain
              </Badge>
              <Tooltip label="Refresh transactions">
                <IconButton
                  aria-label="Refresh transactions"
                  icon={<FiRefreshCw />}
                  size="sm"
                  variant="ghost"
                  onClick={onRefresh}
                />
              </Tooltip>
            </HStack>
          )} */}
      </HStack>
      <VStack gap={4} align="stretch">
        {transactions.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Text color="gray.500">No transactions yet</Text>
            <Text fontSize="sm" color="gray.600" mt={2}>
              Your transaction history will appear here
            </Text>
          </Box>
        ) : (
          <VStack gap={3} align="stretch">
            {transactions.map((tx, index) => (
              <Box
                key={`${tx.txHash}-${tx.direction}-${index}`}
                p={4}
                bg="gray.900"
                borderRadius="md"
                borderWidth="1px"
                borderColor="gray.700"
                _hover={{ borderColor: 'gray.600', bg: 'gray.850' }}
                transition="all 0.2s"
              >
                <HStack justify="space-between" mb={2}>
                  <HStack gap={2}>
                    {tx.direction === 'outgoing' ? (
                      <Box color="orange.400">
                        <FiArrowUpRight size={20} />
                      </Box>
                    ) : (
                      <Box color="green.400">
                        <FiArrowDownLeft size={20} />
                      </Box>
                    )}
                    <VStack align="start" gap={0}>
                      <Text fontWeight="bold" fontSize="sm">
                        {tx.isSelfTransfer
                          ? 'Self-Transfer'
                          : tx.direction === 'outgoing'
                            ? 'Sent'
                            : 'Received'}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {formatTime(tx.timestamp)}
                      </Text>
                    </VStack>
                  </HStack>
                  <Badge colorPalette={getStatusColor(tx.status)} fontSize="xs">
                    {tx.status === 'verified' ? 'PAID' : tx.status}
                  </Badge>
                </HStack>

                <VStack align="stretch" gap={2} fontSize="sm">
                  <HStack justify="space-between">
                    <Text color="gray.400">Amount:</Text>
                    <Text fontWeight="bold" fontFamily="mono">
                      {parseFloat(ethers.formatEther(tx.amount)).toFixed(2)} EUR
                    </Text>
                  </HStack>

                  <HStack justify="space-between" align="start">
                    <Text color="gray.400" flexShrink={0}>
                      {tx.direction === 'outgoing' ? 'To:' : 'From:'}
                    </Text>
                    <Text
                      fontFamily="mono"
                      fontSize="xs"
                      cursor="pointer"
                      onClick={() =>
                        copyToClipboard(tx.direction === 'outgoing' ? tx.to : tx.from, 'Address')
                      }
                      _hover={{ color: 'purple.400' }}
                      transition="color 0.2s"
                      wordBreak="break-all"
                      textAlign="right"
                      maxW="70%"
                    >
                      {tx.direction === 'outgoing' ? tx.to : tx.from}
                    </Text>
                  </HStack>

                  {/* {tx.sessionKeyAddress && tx.direction === 'outgoing' && (
                    <HStack justify="space-between">
                      <Text color="gray.400" fontSize="xs">
                        Session Key:
                      </Text>
                      <Text fontFamily="mono" fontSize="xs" color="purple.400">
                        {formatAddress(tx.sessionKeyAddress)}
                      </Text>
                    </HStack>
                  )} */}

                  {/* {tx.duration && (
                    <HStack justify="space-between">
                      <Text color="gray.400" fontSize="xs">
                        Duration:
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {tx.duration.toFixed(2)}s
                      </Text>
                    </HStack>
                  )} */}

                  <HStack justify="space-between">
                    <Text color="gray.400" fontSize="xs">
                      Tx Hash:
                    </Text>
                    {tx.txHash ? (
                      <HStack gap={1}>
                        <Text fontFamily="mono" fontSize="xs" color="blue.400">
                          {formatAddress(tx.txHash)}
                        </Text>
                        <IconButton
                          asChild
                          aria-label="View on explorer"
                          size="xs"
                          variant="ghost"
                          color="blue.400"
                        >
                          <a
                            href={getBlockExplorerUrl(tx.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FiExternalLink />
                          </a>
                        </IconButton>
                      </HStack>
                    ) : (
                      <Text
                        fontSize="xs"
                        color="blue.400"
                        css={{
                          '@keyframes blink': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.3 },
                          },
                          animation: 'blink 1.5s ease-in-out infinite',
                        }}
                      >
                        Settling this one...
                      </Text>
                    )}
                  </HStack>
                </VStack>
              </Box>
            ))}
          </VStack>
        )}
      </VStack>
    </Box>
  )
}
