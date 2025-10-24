'use client'

import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Spinner,
  IconButton,
  Tooltip,
} from '@chakra-ui/react'
import { FiArrowUpRight, FiArrowDownLeft, FiRefreshCw, FiExternalLink } from 'react-icons/fi'
import { ethers } from 'ethers'
import { Transaction } from '@/lib/safeStorage'

interface TransactionHistoryProps {
  transactions: Transaction[]
  isLoading: boolean
  onRefresh: () => void
  safeAddress: string
}

export function TransactionHistory({
  transactions,
  isLoading,
  onRefresh,
  safeAddress,
}: TransactionHistoryProps) {
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
      <Card bg="gray.800" borderColor="gray.700">
        <CardBody>
          <VStack spacing={4} py={8}>
            <Spinner size="lg" color="purple.500" />
            <Text color="gray.400">Loading transactions...</Text>
          </VStack>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card bg="gray.800" borderColor="gray.700">
      <CardHeader>
        <HStack justify="space-between">
          <Heading size="md">Transaction History</Heading>
          <Tooltip label="Refresh transactions">
            <IconButton
              aria-label="Refresh transactions"
              icon={<FiRefreshCw />}
              size="sm"
              variant="ghost"
              onClick={onRefresh}
              isLoading={isLoading}
            />
          </Tooltip>
        </HStack>
      </CardHeader>
      <CardBody>
        {transactions.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Text color="gray.500">No transactions yet</Text>
            <Text fontSize="sm" color="gray.600" mt={2}>
              Your transaction history will appear here
            </Text>
          </Box>
        ) : (
          <VStack spacing={3} align="stretch">
            {transactions.map(tx => (
              <Box
                key={tx.txId}
                p={4}
                bg="gray.900"
                borderRadius="md"
                borderWidth="1px"
                borderColor="gray.700"
                _hover={{ borderColor: 'gray.600', bg: 'gray.850' }}
                transition="all 0.2s"
              >
                <HStack justify="space-between" mb={2}>
                  <HStack spacing={2}>
                    {tx.direction === 'outgoing' ? (
                      <Box color="orange.400">
                        <FiArrowUpRight size={20} />
                      </Box>
                    ) : (
                      <Box color="green.400">
                        <FiArrowDownLeft size={20} />
                      </Box>
                    )}
                    <VStack align="start" spacing={0}>
                      <Text fontWeight="bold" fontSize="sm">
                        {tx.direction === 'outgoing' ? 'Sent' : 'Received'}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {formatTime(tx.timestamp)}
                      </Text>
                    </VStack>
                  </HStack>
                  <Badge colorScheme={getStatusColor(tx.status)} fontSize="xs">
                    {tx.status}
                  </Badge>
                </HStack>

                <VStack align="stretch" spacing={2} fontSize="sm">
                  <HStack justify="space-between">
                    <Text color="gray.400">Amount:</Text>
                    <Text fontWeight="bold" fontFamily="mono">
                      {parseFloat(ethers.formatEther(tx.amount)).toFixed(6)} xDAI
                    </Text>
                  </HStack>

                  <HStack justify="space-between">
                    <Text color="gray.400">
                      {tx.direction === 'outgoing' ? 'To:' : 'From:'}
                    </Text>
                    <Text fontFamily="mono" fontSize="xs">
                      {formatAddress(tx.direction === 'outgoing' ? tx.to : tx.from)}
                    </Text>
                  </HStack>

                  {tx.sessionKeyAddress && tx.direction === 'outgoing' && (
                    <HStack justify="space-between">
                      <Text color="gray.400" fontSize="xs">
                        Session Key:
                      </Text>
                      <Text fontFamily="mono" fontSize="xs" color="purple.400">
                        {formatAddress(tx.sessionKeyAddress)}
                      </Text>
                    </HStack>
                  )}

                  {tx.duration && (
                    <HStack justify="space-between">
                      <Text color="gray.400" fontSize="xs">
                        Duration:
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {tx.duration.toFixed(2)}s
                      </Text>
                    </HStack>
                  )}

                  {tx.txHash && (
                    <HStack justify="space-between">
                      <Text color="gray.400" fontSize="xs">
                        Tx Hash:
                      </Text>
                      <HStack spacing={1}>
                        <Text fontFamily="mono" fontSize="xs" color="blue.400">
                          {formatAddress(tx.txHash)}
                        </Text>
                        <IconButton
                          as="a"
                          href={getBlockExplorerUrl(tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="View on explorer"
                          icon={<FiExternalLink />}
                          size="xs"
                          variant="ghost"
                          color="blue.400"
                        />
                      </HStack>
                    </HStack>
                  )}
                </VStack>
              </Box>
            ))}
          </VStack>
        )}
      </CardBody>
    </Card>
  )
}
