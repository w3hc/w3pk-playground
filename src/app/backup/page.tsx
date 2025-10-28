// app/backup/page.tsx
'use client'

import React, { useState } from 'react'
import {
  Box,
  Button,
  Container,
  Heading,
  VStack,
  Text,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
  Code,
  Divider,
} from '@chakra-ui/react'
import { useW3PK } from '../../../src/context/W3PK' // Adjust path as needed
import Spinner from '../../../src/components/Spinner' // Import the custom Spinner component
import PasswordModal from '../../components/PasswordModal' // Adjust path as needed

const BackupPage = () => {
  const [backupStatus, setBackupStatus] = useState<string | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  const toast = useToast()
  const {
    isAuthenticated,
    isLoading: contextIsLoading,
    user,
    getBackupStatus,
    createZipBackup,
  } = useW3PK()

  if (contextIsLoading) {
    return (
      <Container maxW="container.md" py={10}>
        <Spinner size="md" /> {/* Use the custom Spinner */}
      </Container>
    )
  }

  if (!isAuthenticated || !getBackupStatus || !createZipBackup) {
    return (
      <Container maxW="container.md" py={20}>
        <VStack spacing={8} align="stretch">
          <Box bg="whiteAlpha.50" p={6} borderRadius="md" textAlign="center">
            <Alert status="warning" bg="transparent" color="orange.200">
              <AlertIcon />
              <AlertDescription>Please log in to access backup functionality.</AlertDescription>
            </Alert>
          </Box>
        </VStack>
      </Container>
    )
  }

  const handleGetBackupStatus = async () => {
    setIsCheckingStatus(true)
    setBackupStatus(null)
    try {
      const statusObject = await getBackupStatus()
      console.log('Retrieved status object:', statusObject)

      if (
        statusObject &&
        statusObject.securityScore &&
        typeof statusObject.securityScore.total === 'number'
      ) {
        const scoreValue = statusObject.securityScore.total
        const scoreLevel = statusObject.securityScore.level || 'unknown'
        const statusString = `Security Score: ${scoreValue}/100 (Level: ${scoreLevel})`
        setBackupStatus(statusString)
      } else {
        console.error('Unexpected status object structure:', statusObject)
        setBackupStatus('Error: Unexpected status data format.')
      }

      toast({
        title: 'Backup Status Retrieved.',
        status: 'info',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error getting backup status:', error)
      toast({
        title: 'Error retrieving status.',
        description: (error as Error).message || 'An unexpected error occurred.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      setBackupStatus(null)
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true)
    try {
      setShowPasswordModal(true)
    } catch (error) {
      console.error('Error creating backup:', error)
      toast({
        title: 'Error creating backup.',
        description: (error as Error).message || 'An unexpected error occurred.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsCreatingBackup(false)
    }
  }

  const handlePasswordSubmit = async (password: string) => {
    setShowPasswordModal(false)

    try {
      const backupBlob = await createZipBackup(password)
      const link = document.createElement('a')
      link.href = URL.createObjectURL(backupBlob)
      link.download = `w3pk_backup_${user?.username || 'user'}_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: 'Backup Created Successfully!',
        status: 'success',
        duration: 3000,
        isClosable: true,
      })
    } catch (error) {
      console.error('Error creating backup:', error)
      toast({
        title: 'Error creating backup.',
        description: (error as Error).message || 'An unexpected error occurred.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const handleModalClose = () => {
    setShowPasswordModal(false)
  }

  return (
    <Container maxW="container.md" py={10}>
      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="lg" mb={4}>
            Wallet Backup
          </Heading>
          <Text color="gray.400" mb={6}>
            Manage your encrypted wallet backup securely
          </Text>
        </Box>

        <VStack spacing={6} align="stretch">
          <Box bg="gray.800" p={4} borderRadius="md">
            <Text fontSize="sm" color="gray.400" mb={2}>
              Logged in as: <strong>{user?.displayName || user?.username}</strong>
            </Text>
            <Text fontSize="xs" color="gray.500" mb={2}>
              Ethereum Address:
              <Code fontSize="xs" ml={2} _hover={{ bg: 'gray.600' }} title="Ethereum Address">
                {user?.ethereumAddress}
              </Code>
            </Text>
            <Text fontSize="xs" color="blue.300">
              🔒 Your private key is encrypted client-side and never sent to the server
            </Text>
          </Box>

          <Divider />

          <Box p={4} borderWidth="1px" borderRadius="lg" bg="gray.800">
            <Heading as="h2" size="md" mb={2}>
              Backup Status
            </Heading>
            {isCheckingStatus ? (
              <Spinner size="sm" />
            ) : (
              <Text color="gray.300">
                {backupStatus || "Click 'Check Status' to see the security score."}
              </Text>
            )}
          </Box>

          <Button
            bg="#8c1c84"
            color="white"
            _hover={{ bg: '#6d1566' }}
            onClick={handleGetBackupStatus}
            isLoading={isCheckingStatus}
            spinner={<Spinner size="16px" />}
            loadingText="Checking..."
            isDisabled={isCheckingStatus || isCreatingBackup}
            size="lg"
          >
            Check Backup Status
          </Button>

          <Button
            bg="#8c1c84"
            color="white"
            _hover={{ bg: '#6d1566' }}
            onClick={handleCreateBackup}
            isLoading={isCreatingBackup}
            spinner={<Spinner size="16px" />}
            loadingText="Creating..."
            isDisabled={isCheckingStatus || isCreatingBackup}
            size="lg"
          >
            Create ZIP Backup
          </Button>
        </VStack>

        <Box bg="gray.800" p={4} borderRadius="md">
          <Text fontSize="sm" color="gray.400" mb={2}>
            <strong>About Client-Side Backup:</strong>
          </Text>
          <Text fontSize="xs" color="gray.500" mb={2}>
            Your wallet&apos;s core secret (the mnemonic phrase) is generated and encrypted entirely
            on your device. The &quot;backup&quot; process retrieves this encrypted data from your
            browser&apos;s local storage using your password, then packages it into a secure ZIP
            file for you to download. This ZIP file contains the necessary information to recover
            your wallet on another device.
          </Text>
          <Text fontSize="xs" color="gray.500" mb={2}>
            The encryption key for your wallet is derived using a WebAuthn signature, which requires
            your biometric authentication (fingerprint, face scan) or device PIN. This means even if
            someone gains access to the encrypted data stored in your browser, they cannot decrypt
            it without your physical device and authentication.
          </Text>
          <Text fontSize="xs" color="gray.500" mb={3}>
            Your backup ZIP file is encrypted using AES-256-GCM with a key derived from the password
            you provide. Store this file securely and remember your password. If you lose access to
            your device, passkey, AND the backup file/password, your wallet cannot be recovered.
          </Text>
          <Text fontSize="xs" color="yellow.300">
            🔐 Security Note: The backup ZIP is protected by your chosen password. Use a strong,
            unique password.
          </Text>
        </Box>
      </VStack>

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={handleModalClose}
        onSubmit={handlePasswordSubmit}
        title={`Enter Password to Create Backup`}
        description={`Please enter your password to create the backup. This is required by the w3pk SDK to access your encrypted wallet data.`}
      />
    </Container>
  )
}

export default BackupPage
