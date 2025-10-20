'use client'

import {
  Container,
  Text,
  VStack,
  Button,
  Box,
  Heading,
  SimpleGrid,
  Icon,
  Flex,
} from '@chakra-ui/react'
import { useW3PK } from '@/context/W3PK'
import Link from 'next/link'
import { useTranslation } from '@/hooks/useTranslation'
import { FiEdit3, FiUpload, FiShield } from 'react-icons/fi'

export default function Home() {
  const { isAuthenticated, user } = useW3PK()
  const t = useTranslation()

  return (
    <Container maxW="container.sm" py={20}>
      <VStack spacing={8} align="stretch">
        {isAuthenticated ? (
          <>
            <Box textAlign="center" mb={8}>
              <Heading as="h1" size="xl" mb={4}>
                Welcome {user?.displayName || user?.username}!
              </Heading>
              <Text color="gray.400" mb={2}>
                It&apos;s a pleasure to have you here! You&apos;re at the right place if you want to
                test the one and only w3pk brand new SDK. Sit back, relax, and enjoy!
              </Text>
              <Text fontSize="sm" color="gray.500">
                User ID: {user?.id}
              </Text>
            </Box>

            {/* Action Boxes */}
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
              <Link href="/sig">
                <Box
                  bg="gray.800"
                  p={6}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.700"
                  _hover={{
                    borderColor: '#8c1c84',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(140, 28, 132, 0.15)',
                  }}
                  transition="all 0.3s ease"
                  cursor="pointer"
                  height="160px"
                  display="flex"
                  flexDirection="column"
                  justifyContent="space-between"
                >
                  <Box>
                    <Flex align="center" mb={3}>
                      <Box bg="#8c1c84" p={2} borderRadius="md" mr={3}>
                        <Icon as={FiEdit3} color="white" boxSize={5} />
                      </Box>
                      <Heading as="h3" size="md" color="white">
                        Sign Message
                      </Heading>
                    </Flex>
                    <Text color="gray.400" fontSize="sm">
                      Sign messages
                    </Text>
                  </Box>
                  <Text color="#8c1c84" fontSize="xs" fontWeight="semibold">
                    Sign tx →
                  </Text>
                </Box>
              </Link>

              <Link href="/.">
                <Box
                  bg="gray.800"
                  p={6}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.700"
                  _hover={{
                    borderColor: '#8c1c84',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(140, 28, 132, 0.15)',
                  }}
                  transition="all 0.3s ease"
                  cursor="pointer"
                  height="160px"
                  display="flex"
                  flexDirection="column"
                  justifyContent="space-between"
                >
                  <Box>
                    <Flex align="center" mb={3}>
                      <Box bg="#8c1c84" p={2} borderRadius="md" mr={3}>
                        <Icon as={FiShield} color="white" boxSize={5} />
                      </Box>
                      <Heading as="h3" size="md" color="white">
                        Stealth addresses
                      </Heading>
                    </Flex>
                    <Text color="gray.400" fontSize="sm">
                      Manage stealth addresses
                    </Text>
                  </Box>
                  <Text color="#8c1c84" fontSize="xs" fontWeight="semibold">
                    Go →
                  </Text>
                </Box>
              </Link>

              <Link href="/.">
                <Box
                  bg="gray.800"
                  p={6}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.700"
                  _hover={{
                    borderColor: '#8c1c84',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(140, 28, 132, 0.15)',
                  }}
                  transition="all 0.3s ease"
                  cursor="pointer"
                  height="160px"
                  display="flex"
                  flexDirection="column"
                  justifyContent="space-between"
                >
                  <Box>
                    <Flex align="center" mb={3}>
                      <Box bg="#8c1c84" p={2} borderRadius="md" mr={3}>
                        <Icon as={FiUpload} color="white" boxSize={5} />
                      </Box>
                      <Heading as="h3" size="md" color="white">
                        Send tx
                      </Heading>
                    </Flex>
                    <Text color="gray.400" fontSize="sm">
                      Send onchain transactions{' '}
                    </Text>
                  </Box>
                  <Text color="#8c1c84" fontSize="xs" fontWeight="semibold">
                    Go →
                  </Text>
                </Box>
              </Link>
            </SimpleGrid>

            {/* Additional Info */}
            <Box bg="gray.800" p={4} borderRadius="md" textAlign="center">
              <Text fontSize="sm" color="gray.400" mb={2}>
                Your account is secured with W3PK (passkey)
              </Text>
              <Text fontSize="xs" color="blue.300">
                🔐 All operations require biometric or security key verification
              </Text>
            </Box>
          </>
        ) : (
          <Box bg="whiteAlpha.50" p={6} borderRadius="md" textAlign="center">
            <Heading as="h1" size="xl" mb={4}>
              Hello Anon!
            </Heading>
            <Text mb={6} color="gray.400">
              Not your keys, not your coins.
            </Text>
            <Text fontSize="sm" color="gray.500">
              Register or login
            </Text>
          </Box>
        )}
      </VStack>
    </Container>
  )
}
