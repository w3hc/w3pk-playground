'use client'

import {
  Container,
  VStack,
  Box,
  Heading,
  Text,
  HStack,
  Code,
  Separator,
} from '@chakra-ui/react'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { toaster } from '@/components/ui/toaster'
import { useState, useEffect } from 'react'
import { FaSatellite, FaCheckCircle, FaTimesCircle } from 'react-icons/fa'
import Link from 'next/link'

interface NFCDebugInfo {
  // Browser & Environment
  userAgent: string
  platform: string
  isSecureContext: boolean
  protocol: string
  hostname: string

  // NFC API Availability
  hasNDEFReader: boolean
  hasNDEFWriter: boolean
  hasNDEFRecord: boolean

  // Deeper NFC API checks
  ndefReaderType?: string
  ndefWriterType?: string
  windowNDEFReader?: string
  windowNDEFWriter?: string
  hasWebNFC?: boolean

  // Permissions
  nfcPermissionState?: string
  nfcPermissionError?: string

  // Device Detection
  isMobile: boolean
  isAndroid: boolean
  isIOS: boolean
  isChrome: boolean
  isFirefox: boolean
  isSafari: boolean

  // Additional Info
  screenWidth: number
  screenHeight: number
  touchPoints: number

  // Chrome Flags Detection
  chromeVersion?: string
  experimentalFeaturesEnabled?: boolean

  // Device Manufacturer Detection
  deviceManufacturer?: string
  deviceModel?: string
}

export default function NFCDebugPage() {
  const [debugInfo, setDebugInfo] = useState<NFCDebugInfo | null>(null)
  const [isNFCSupported, setIsNFCSupported] = useState<boolean>(false)
  const [nfcTestResult, setNfcTestResult] = useState<string>('')
  const [isTesting, setIsTesting] = useState(false)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)

  useEffect(() => {
    collectDebugInfo()
  }, [])

  const collectDebugInfo = async () => {
    if (typeof window === 'undefined') return

    const ua = navigator.userAgent
    const w = window as any

    // Deeper NFC API inspection
    const hasNDEFReader = 'NDEFReader' in window
    const hasNDEFWriter = 'NDEFWriter' in w
    const hasNDEFRecord = 'NDEFRecord' in w

    // Check types and constructors
    let ndefReaderType = 'undefined'
    let ndefWriterType = 'undefined'
    let windowNDEFReader = 'undefined'
    let windowNDEFWriter = 'undefined'

    try {
      if (hasNDEFReader) {
        ndefReaderType = typeof w.NDEFReader
        windowNDEFReader = w.NDEFReader?.toString() || 'no toString'
      }
    } catch (e: any) {
      ndefReaderType = `error: ${e.message}`
    }

    try {
      if (hasNDEFWriter) {
        ndefWriterType = typeof w.NDEFWriter
        windowNDEFWriter = w.NDEFWriter?.toString() || 'no toString'
      }
    } catch (e: any) {
      ndefWriterType = `error: ${e.message}`
    }

    // Check if Web NFC is actually available (both reader and writer)
    const hasWebNFC = hasNDEFReader && hasNDEFWriter

    // Extract Chrome version
    let chromeVersion = 'Unknown'
    const chromeMatch = ua.match(/Chrome\/(\d+)/)
    if (chromeMatch) {
      chromeVersion = chromeMatch[1]
    }

    // Try to detect if experimental features might be enabled
    // This is a heuristic - we can't directly query flag state
    const experimentalFeaturesEnabled = hasNDEFReader // If we have Reader, some NFC features are enabled

    // Get platform info (navigator.platform is deprecated, but still widely supported)
    let platformInfo = 'Unknown'
    try {
      // Try modern API first
      if ('userAgentData' in navigator && (navigator as any).userAgentData?.platform) {
        platformInfo = (navigator as any).userAgentData.platform
      } else if (navigator.platform) {
        // Fallback to deprecated API
        platformInfo = navigator.platform
      }
    } catch (e) {
      platformInfo = 'Unknown'
    }

    // Try to detect device manufacturer and model from user agent
    let deviceManufacturer = 'Unknown'
    let deviceModel = 'Unknown'

    // Common patterns in Android UA strings
    if (/Samsung/i.test(ua)) {
      deviceManufacturer = 'Samsung'
    } else if (/Pixel/i.test(ua)) {
      deviceManufacturer = 'Google'
      deviceModel = 'Pixel'
    } else if (/Xiaomi/i.test(ua) || /MI /i.test(ua) || /Redmi/i.test(ua)) {
      deviceManufacturer = 'Xiaomi'
    } else if (/OPPO/i.test(ua)) {
      deviceManufacturer = 'OPPO'
    } else if (/vivo/i.test(ua)) {
      deviceManufacturer = 'Vivo'
    } else if (/OnePlus/i.test(ua)) {
      deviceManufacturer = 'OnePlus'
    } else if (/Huawei/i.test(ua) || /Honor/i.test(ua)) {
      deviceManufacturer = 'Huawei/Honor'
    } else if (/Motorola/i.test(ua) || /Moto/i.test(ua)) {
      deviceManufacturer = 'Motorola'
    } else if (/LG/i.test(ua)) {
      deviceManufacturer = 'LG'
    }

    // Try to extract model from UA
    const modelMatch = ua.match(/;\s*([^;)]+)\s*\)/)
    if (modelMatch && modelMatch[1] !== 'K') {
      deviceModel = modelMatch[1]
    }

    const info: NFCDebugInfo = {
      // Browser & Environment
      userAgent: ua,
      platform: platformInfo,
      isSecureContext: window.isSecureContext,
      protocol: window.location.protocol,
      hostname: window.location.hostname,

      // NFC API Availability
      hasNDEFReader,
      hasNDEFWriter,
      hasNDEFRecord,

      // Deeper NFC API checks
      ndefReaderType,
      ndefWriterType,
      windowNDEFReader: windowNDEFReader.substring(0, 100),
      windowNDEFWriter: windowNDEFWriter.substring(0, 100),
      hasWebNFC,

      // Device Detection
      isMobile: /Mobile|Android|iPhone|iPad|iPod/i.test(ua),
      isAndroid: /Android/i.test(ua),
      isIOS: /iPhone|iPad|iPod/i.test(ua),
      isChrome: /Chrome/i.test(ua) && !/Edg/i.test(ua),
      isFirefox: /Firefox/i.test(ua),
      isSafari: /Safari/i.test(ua) && !/Chrome/i.test(ua),

      // Additional Info
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      touchPoints: navigator.maxTouchPoints || 0,

      // Chrome Flags Detection
      chromeVersion,
      experimentalFeaturesEnabled,

      // Device Manufacturer Detection
      deviceManufacturer,
      deviceModel,
    }

    // Check NFC Permission (if available)
    if ('permissions' in navigator && (navigator.permissions as any).query) {
      try {
        const permissionStatus = await (navigator.permissions as any).query({ name: 'nfc' })
        info.nfcPermissionState = permissionStatus.state
      } catch (error: any) {
        info.nfcPermissionError = error.message || 'Permission query not supported'
      }
    } else {
      info.nfcPermissionError = 'Permissions API not available'
    }

    setDebugInfo(info)

    // Determine if NFC is supported
    const nfcSupported =
      info.isSecureContext && info.hasNDEFReader && info.hasNDEFWriter && info.isAndroid
    setIsNFCSupported(nfcSupported)
  }

  const testNFCWrite = async () => {
    setIsTesting(true)
    setNfcTestResult('')

    try {
      const NDEFWriter = (window as any).NDEFWriter
      if (!NDEFWriter) {
        throw new Error('NDEFWriter not available')
      }

      const writer = new NDEFWriter()
      const testUrl = 'https://example.com/test'

      toaster.create({
        title: 'Ready to Write',
        description: 'Hold an NFC tag near your device now',
        type: 'info',
        duration: 10000,
      })

      await writer.write({
        records: [{ recordType: 'url', data: testUrl }],
      })

      setNfcTestResult('✅ NFC Write Test PASSED - Tag was written successfully!')
      toaster.create({
        title: '✅ Success!',
        description: 'NFC tag written successfully',
        type: 'success',
        duration: 5000,
      })
    } catch (error: any) {
      console.error('NFC write test failed:', error)
      let errorMessage = error.message || 'Unknown error'

      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permission denied. Allow NFC access in browser settings.'
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'NFC is not supported on this device.'
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Cannot read NFC tag. Try again.'
      } else if (error.name === 'AbortError') {
        errorMessage = 'Operation canceled or timed out.'
      }

      setNfcTestResult(`❌ NFC Write Test FAILED: ${errorMessage}`)
      toaster.create({
        title: 'Test Failed',
        description: errorMessage,
        type: 'error',
        duration: 5000,
      })
    } finally {
      setIsTesting(false)
    }
  }

  const testNFCRead = async () => {
    setIsTesting(true)
    setNfcTestResult('')

    try {
      const NDEFReader = (window as any).NDEFReader
      if (!NDEFReader) {
        throw new Error('NDEFReader not available')
      }

      const reader = new NDEFReader()

      toaster.create({
        title: 'Ready to Read',
        description: 'Hold an NFC tag near your device now',
        type: 'info',
        duration: 10000,
      })

      await reader.scan()

      reader.onreading = (event: any) => {
        console.log('NFC tag read:', event)
        setNfcTestResult(`✅ NFC Read Test PASSED - Tag detected: ${event.serialNumber}`)
        toaster.create({
          title: '✅ Tag Read!',
          description: `Serial: ${event.serialNumber}`,
          type: 'success',
          duration: 5000,
        })
        setIsTesting(false)
      }

      reader.onerror = (error: any) => {
        console.error('NFC read error:', error)
        setNfcTestResult(`❌ NFC Read Test FAILED: ${error.message || 'Read error'}`)
        setIsTesting(false)
      }

      // Set a timeout to stop scanning after 30 seconds
      setTimeout(() => {
        if (isTesting) {
          setNfcTestResult('⏱️ NFC Read Test TIMEOUT - No tag detected in 30 seconds')
          setIsTesting(false)
        }
      }, 30000)
    } catch (error: any) {
      console.error('NFC read test failed:', error)
      let errorMessage = error.message || 'Unknown error'

      if (error.name === 'NotAllowedError') {
        errorMessage = 'Permission denied. Allow NFC access in browser settings.'
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'NFC is not supported on this device.'
      }

      setNfcTestResult(`❌ NFC Read Test FAILED: ${errorMessage}`)
      toaster.create({
        title: 'Test Failed',
        description: errorMessage,
        type: 'error',
        duration: 5000,
      })
      setIsTesting(false)
    }
  }

  const requestNFCPermission = async () => {
    setIsRequestingPermission(true)

    try {
      // Try to trigger NFC permission by attempting to scan
      // This will prompt the user to allow NFC access
      const NDEFReader = (window as any).NDEFReader
      if (!NDEFReader) {
        throw new Error('NDEFReader not available on this device')
      }

      const reader = new NDEFReader()

      toaster.create({
        title: 'Permission Request',
        description: 'Please allow NFC access when prompted',
        type: 'info',
        duration: 5000,
      })

      // Start scan to trigger permission prompt
      await reader.scan()

      // If we get here, permission was granted
      toaster.create({
        title: '✅ Permission Granted!',
        description: 'NFC access has been allowed. Refreshing page...',
        type: 'success',
        duration: 3000,
      })

      // Wait a moment then reload the page to refresh the debug info
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error: any) {
      console.error('Permission request failed:', error)
      let errorMessage = error.message || 'Unknown error'

      if (error.name === 'NotAllowedError') {
        errorMessage =
          'Permission denied. Go to Chrome Settings → Site Settings → NFC and manually allow this site.'
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'NFC is not supported on this device or browser.'
      } else if (error.message.includes('not available')) {
        errorMessage =
          'NDEFReader not available. Enable Chrome flags or check system NFC settings.'
      }

      toaster.create({
        title: 'Permission Request Failed',
        description: errorMessage,
        type: 'error',
        duration: 8000,
      })
    } finally {
      setIsRequestingPermission(false)
    }
  }

  const InfoRow = ({ label, value, isGood }: { label: string; value: any; isGood?: boolean }) => (
    <HStack justify="space-between" w="100%">
      <Text fontSize="sm" color="gray.400">
        {label}:
      </Text>
      <HStack>
        {typeof value === 'boolean' ? (
          <>
            {value ? (
              <FaCheckCircle color="green" />
            ) : (
              <FaTimesCircle color={isGood === false ? 'red' : 'gray'} />
            )}
            <Text fontSize="sm" fontWeight="bold">
              {value ? 'Yes' : 'No'}
            </Text>
          </>
        ) : (
          <Text fontSize="sm" fontWeight="bold" fontFamily="mono" truncate maxW="250px">
            {String(value)}
          </Text>
        )}
      </HStack>
    </HStack>
  )

  if (!debugInfo) {
    return (
      <Container maxW="container.md" py={10}>
        <Text>Loading debug info...</Text>
      </Container>
    )
  }

  return (
    <Container maxW="container.md" py={10}>
      <VStack gap={8} align="stretch">
        {/* Header */}
        <Box textAlign="center">
          <Heading as="h1" size="xl" mb={2}>
            NFC Debug Console
          </Heading>
          <Text color="gray.400">Diagnose NFC support and compatibility</Text>
        </Box>

        {/* Overall Status */}
        <Card.Root bg={isNFCSupported ? 'green.900' : 'red.900'} borderColor="gray.700">
          <Card.Body>
            <HStack justify="center" gap={4}>
              {isNFCSupported ? (
                <FaCheckCircle size={32} color="lightgreen" />
              ) : (
                <FaTimesCircle size={32} color="salmon" />
              )}
              <VStack align="start" gap={0}>
                <Heading size="md">NFC is {isNFCSupported ? 'SUPPORTED' : 'NOT SUPPORTED'}</Heading>
                <Text fontSize="sm" color="gray.300">
                  {isNFCSupported
                    ? 'Your device appears to support Web NFC'
                    : 'Your device does not meet NFC requirements'}
                </Text>
              </VStack>
            </HStack>
          </Card.Body>
        </Card.Root>

        {/* Requirements Check */}
        <Card.Root bg="gray.800" borderColor="gray.700">
          <Card.Header>
            <Heading size="md">Requirements Check</Heading>
          </Card.Header>
          <Card.Body>
            <VStack gap={3} align="stretch">
              <InfoRow
                label="Secure Context (HTTPS)"
                value={debugInfo.isSecureContext}
                isGood={false}
              />
              <InfoRow label="Android Device" value={debugInfo.isAndroid} isGood={false} />
              <InfoRow label="Chrome Browser" value={debugInfo.isChrome} isGood={false} />
              <InfoRow label="NDEFReader API" value={debugInfo.hasNDEFReader} isGood={false} />
              <InfoRow label="NDEFWriter API" value={debugInfo.hasNDEFWriter} isGood={false} />
            </VStack>

            {!isNFCSupported && debugInfo.hasNDEFReader && !debugInfo.hasNDEFWriter && (
              <Alert.Root
                status={
                  debugInfo.nfcPermissionState === 'granted' ? 'error' : 'warning'
                }
                mt={4}
                borderRadius="md"
              >
                <Alert.Indicator />
                <Box flex="1">
                  <Alert.Title>NDEFWriter Not Available</Alert.Title>
                  <Alert.Description fontSize="sm">
                    {debugInfo.nfcPermissionState === 'granted' ? (
                      <>
                        <Text fontWeight="bold" mb={2} color="red.300">
                          Permission is granted, but NDEFWriter is still missing!
                        </Text>
                        <VStack align="stretch" gap={3}>
                          <Text>
                            This is NOT a permission issue. Most likely causes:
                            <br />
                            <Text as="span" fontWeight="bold" color="orange.300">
                              • Chrome flags not enabled
                            </Text>
                            <br />• Device manufacturer disabled Web NFC write
                            <br />• NFC hardware issue
                          </Text>
                          <Text fontSize="sm" fontWeight="bold">
                            Try enabling Chrome flags (see troubleshooting below) ↓
                          </Text>
                        </VStack>
                      </>
                    ) : (
                      <>
                        <Text fontWeight="bold" mb={2}>
                          Most likely cause: Site permissions not granted for NFC
                        </Text>
                        <VStack align="stretch" gap={3}>
                          <Text>
                            Go to Chrome → Settings → Site Settings → NFC and make sure{' '}
                            <Code fontSize="xs">{debugInfo.hostname}</Code> is allowed.
                          </Text>
                          <Button
                            colorScheme="orange"
                            size="sm"
                            onClick={requestNFCPermission}
                            loading={isRequestingPermission}
                            loadingText="Requesting..."
                          >
                            <FaSatellite />
                            Request NFC Permission
                          </Button>
                          <Text fontSize="xs" color="gray.400">
                            Other possible causes:
                            <br />• Chrome flags not enabled (see troubleshooting below)
                            <br />• NFC hardware disabled in Android settings
                          </Text>
                        </VStack>
                      </>
                    )}
                  </Alert.Description>
                </Box>
              </Alert.Root>
            )}

            {!isNFCSupported && !debugInfo.hasNDEFReader && !debugInfo.hasNDEFWriter && (
              <Alert.Root status="warning" mt={4} borderRadius="md">
                <Alert.Indicator />
                <Box>
                  <Alert.Title>Requirements Not Met</Alert.Title>
                  <Alert.Description fontSize="sm">
                    Web NFC requires: HTTPS + Android + Chrome + NFC hardware
                  </Alert.Description>
                </Box>
              </Alert.Root>
            )}
          </Card.Body>
        </Card.Root>

        {/* Browser & Environment Info */}
        <Card.Root bg="gray.800" borderColor="gray.700">
          <Card.Header>
            <Heading size="md">Browser & Environment</Heading>
          </Card.Header>
          <Card.Body>
            <VStack gap={3} align="stretch">
              <InfoRow label="Protocol" value={debugInfo.protocol} />
              <InfoRow label="Hostname" value={debugInfo.hostname} />
              <InfoRow label="Platform" value={debugInfo.platform} />
              <InfoRow label="Chrome Version" value={debugInfo.chromeVersion || 'N/A'} />
              <InfoRow
                label="Device Manufacturer"
                value={debugInfo.deviceManufacturer || 'Unknown'}
              />
              <InfoRow label="Device Model" value={debugInfo.deviceModel || 'Unknown'} />
              <InfoRow label="Mobile Device" value={debugInfo.isMobile} />
              <InfoRow label="Touch Points" value={debugInfo.touchPoints} />
              <InfoRow
                label="Screen"
                value={`${debugInfo.screenWidth}x${debugInfo.screenHeight}`}
              />
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Device Detection */}
        <Card.Root bg="gray.800" borderColor="gray.700">
          <Card.Header>
            <Heading size="md">Device & Browser Detection</Heading>
          </Card.Header>
          <Card.Body>
            <VStack gap={3} align="stretch">
              <InfoRow label="Android" value={debugInfo.isAndroid} />
              <InfoRow label="iOS" value={debugInfo.isIOS} />
              <InfoRow label="Chrome" value={debugInfo.isChrome} />
              <InfoRow label="Firefox" value={debugInfo.isFirefox} />
              <InfoRow label="Safari" value={debugInfo.isSafari} />
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* NFC API Info */}
        <Card.Root bg="gray.800" borderColor="gray.700">
          <Card.Header>
            <Heading size="md">NFC API Availability</Heading>
          </Card.Header>
          <Card.Body>
            <VStack gap={3} align="stretch">
              <InfoRow label="NDEFReader" value={debugInfo.hasNDEFReader} />
              <InfoRow label="NDEFWriter" value={debugInfo.hasNDEFWriter} />
              <InfoRow label="NDEFRecord" value={debugInfo.hasNDEFRecord} />
              <InfoRow label="Web NFC Available" value={debugInfo.hasWebNFC || false} />
              <Separator />
              <InfoRow
                label="NFC Permission"
                value={debugInfo.nfcPermissionState || debugInfo.nfcPermissionError || 'Unknown'}
              />
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Deeper NFC API Inspection */}
        <Card.Root bg="gray.800" borderColor="gray.700">
          <Card.Header>
            <Heading size="md">NFC API Deep Inspection</Heading>
          </Card.Header>
          <Card.Body>
            <VStack gap={3} align="stretch">
              <Box>
                <Text fontSize="sm" color="gray.400" mb={1}>
                  NDEFReader Type:
                </Text>
                <Code
                  p={2}
                  borderRadius="md"
                  fontSize="xs"
                  wordBreak="break-all"
                  bg="gray.900"
                  color="green.300"
                  display="block"
                >
                  {debugInfo.ndefReaderType}
                </Code>
              </Box>
              <Box>
                <Text fontSize="sm" color="gray.400" mb={1}>
                  NDEFWriter Type:
                </Text>
                <Code
                  p={2}
                  borderRadius="md"
                  fontSize="xs"
                  wordBreak="break-all"
                  bg="gray.900"
                  color="green.300"
                  display="block"
                >
                  {debugInfo.ndefWriterType}
                </Code>
              </Box>
              <Box>
                <Text fontSize="sm" color="gray.400" mb={1}>
                  window.NDEFReader:
                </Text>
                <Code
                  p={2}
                  borderRadius="md"
                  fontSize="xs"
                  wordBreak="break-all"
                  whiteSpace="pre-wrap"
                  bg="gray.900"
                  color="green.300"
                  display="block"
                >
                  {debugInfo.windowNDEFReader}
                </Code>
              </Box>
              <Box>
                <Text fontSize="sm" color="gray.400" mb={1}>
                  window.NDEFWriter:
                </Text>
                <Code
                  p={2}
                  borderRadius="md"
                  fontSize="xs"
                  wordBreak="break-all"
                  whiteSpace="pre-wrap"
                  bg="gray.900"
                  color="green.300"
                  display="block"
                >
                  {debugInfo.windowNDEFWriter}
                </Code>
              </Box>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* User Agent */}
        <Card.Root bg="gray.800" borderColor="gray.700">
          <Card.Header>
            <Heading size="md">User Agent</Heading>
          </Card.Header>
          <Card.Body>
            <Code
              p={3}
              borderRadius="md"
              fontSize="xs"
              wordBreak="break-all"
              whiteSpace="pre-wrap"
              bg="gray.900"
              color="green.300"
            >
              {debugInfo.userAgent}
            </Code>
          </Card.Body>
        </Card.Root>

        {/* NFC Tests */}
        {isNFCSupported && (
          <Card.Root bg="gray.800" borderColor="gray.700">
            <Card.Header>
              <Heading size="md">NFC Function Tests</Heading>
            </Card.Header>
            <Card.Body>
              <VStack gap={4} align="stretch">
                <Text fontSize="sm" color="gray.400">
                  Test actual NFC read/write functionality:
                </Text>

                <HStack gap={4}>
                  <Button
                    colorScheme="blue"
                    onClick={testNFCRead}
                    loading={isTesting}
                    loadingText="Scanning..."
                    flex={1}
                  >
                    <FaSatellite />
                    Test NFC Read
                  </Button>
                  <Button
                    colorScheme="green"
                    onClick={testNFCWrite}
                    loading={isTesting}
                    loadingText="Writing..."
                    flex={1}
                  >
                    <FaSatellite />
                    Test NFC Write
                  </Button>
                </HStack>

                {nfcTestResult && (
                  <Alert.Root
                    status={nfcTestResult.includes('PASSED') ? 'success' : 'error'}
                    borderRadius="md"
                  >
                    <Alert.Indicator />
                    <Text fontSize="sm">{nfcTestResult}</Text>
                  </Alert.Root>
                )}

                <Text fontSize="xs" color="gray.500">
                  Note: You must have an NFC tag nearby to test these features.
                </Text>
              </VStack>
            </Card.Body>
          </Card.Root>
        )}

        {/* Quick Links */}
        <Box textAlign="center">
          <HStack justify="center" gap={4}>
            <Link href="/">
              <Button variant="plain" size="sm" color="gray.500">
                ← Payment Page
              </Button>
            </Link>
          </HStack>
        </Box>

        {/* Additional Notes */}
        <Card.Root bg="gray.800" borderColor="gray.700">
          <Card.Header>
            <Heading size="sm">NFC Support Notes</Heading>
          </Card.Header>
          <Card.Body>
            <VStack gap={2} align="stretch" fontSize="sm" color="gray.400">
              <Text>• Web NFC API is only supported on Android devices with Chrome 89+</Text>
              <Text>• HTTPS or localhost is required for security</Text>
              <Text>• iOS does not support Web NFC (iOS only allows native apps)</Text>
              <Text>• Device must have NFC hardware enabled in system settings</Text>
              <Text>
                • Browser must have NFC permission granted (check chrome://flags/#enable-web-nfc)
              </Text>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Troubleshooting - Only show if NDEFWriter is missing but Reader is available */}
        {debugInfo.hasNDEFReader && !debugInfo.hasNDEFWriter && (
          <Card.Root bg="orange.900" borderColor="orange.700">
            <Card.Header>
              <Heading size="sm">🔧 Troubleshooting NDEFWriter Issue</Heading>
            </Card.Header>
            <Card.Body>
              <VStack gap={3} align="stretch" fontSize="sm">
                <Text fontWeight="bold">
                  Your device has NDEFReader but not NDEFWriter. Try these steps:
                </Text>

                {debugInfo.nfcPermissionState === 'granted' && (
                  <Alert.Root status="info" borderRadius="md" size="sm">
                    <Alert.Indicator />
                    <Text fontSize="xs">
                      ✅ NFC Permission is already granted. The issue is likely Chrome flags or
                      device restrictions.
                    </Text>
                  </Alert.Root>
                )}

                <Box>
                  <Text
                    fontWeight="semibold"
                    mb={1}
                    color={
                      debugInfo.nfcPermissionState === 'granted' ? 'gray.400' : 'orange.300'
                    }
                  >
                    1. Check Site Permissions{' '}
                    {debugInfo.nfcPermissionState === 'granted' ? '✅ Done' : '(Try First!)'}
                  </Text>
                  {debugInfo.nfcPermissionState === 'granted' ? (
                    <Text color="gray.400" fontSize="xs" fontStyle="italic">
                      Permission already granted ✅
                    </Text>
                  ) : (
                    <>
                      <Text color="gray.300" fontSize="xs" mb={2}>
                        Chrome → Settings → Site Settings → NFC
                        <br />
                        Make sure <Code fontSize="xs">{debugInfo.hostname}</Code> is in the
                        &quot;Allowed&quot; list!
                      </Text>
                      <Button
                        colorScheme="orange"
                        size="sm"
                        onClick={requestNFCPermission}
                        loading={isRequestingPermission}
                        loadingText="Requesting..."
                        mt={2}
                      >
                        <FaSatellite />
                        Request NFC Permission Now
                      </Button>
                      <Text color="gray.400" fontSize="xs" mt={2}>
                        Click this button to trigger Chrome&apos;s permission prompt
                      </Text>
                    </>
                  )}
                </Box>

                <Box>
                  <Text
                    fontWeight="semibold"
                    mb={1}
                    color={debugInfo.nfcPermissionState === 'granted' ? 'orange.300' : 'gray.400'}
                  >
                    2. Enable Chrome Flags{' '}
                    {debugInfo.nfcPermissionState === 'granted'
                      ? '⚠️ TRY THIS!'
                      : '(if needed)'}
                  </Text>
                  <Text color="gray.300" fontSize="xs">
                    Type <Code>chrome://flags</Code> in your browser and enable:
                    <br />• <Code fontSize="xs">#enable-experimental-web-platform-features</Code>
                    <br />• <Code fontSize="xs">#enable-web-nfc</Code>
                  </Text>
                </Box>

                <Box>
                  <Text fontWeight="semibold" mb={1}>
                    3. Check System NFC Settings
                  </Text>
                  <Text color="gray.300" fontSize="xs">
                    Go to Android Settings → Connected Devices → Connection Preferences → NFC →
                    Enable NFC
                  </Text>
                </Box>

                <Box>
                  <Text fontWeight="semibold" mb={1}>
                    4. Restart Browser
                  </Text>
                  <Text color="gray.300" fontSize="xs">
                    After changing permissions or flags, completely close and restart Chrome
                  </Text>
                </Box>

                <Box>
                  <Text fontWeight="semibold" mb={1}>
                    5. Verify Chrome Version
                  </Text>
                  <Text color="gray.300" fontSize="xs">
                    Ensure you&aposre running Chrome 89 or later. Detected version:{' '}
                    {debugInfo.chromeVersion || 'Unknown'}
                    {debugInfo.chromeVersion && parseInt(debugInfo.chromeVersion) >= 89 ? (
                      <Text as="span" color="green.300">
                        {' '}
                        ✓ Compatible
                      </Text>
                    ) : (
                      <Text as="span" color="red.300">
                        {' '}
                        ⚠ May need update
                      </Text>
                    )}
                  </Text>
                </Box>

                <Alert.Root status="warning" size="sm" borderRadius="md">
                  <Alert.Indicator />
                  <Box>
                    <Text fontSize="xs" fontWeight="bold" mb={1}>
                      ⚠️ If Chrome flags are missing or you can&apos;t add sites to NFC settings:
                    </Text>
                    <Text fontSize="xs">
                      Your device manufacturer may have disabled Web NFC write capability. This is
                      common on some Android devices.
                      <br />
                      <br />
                      <Text as="span" fontWeight="bold">
                        Possible workarounds:
                      </Text>
                      <br />• Try Chrome Beta or Chrome Canary (may have different flags)
                      <br />• Check if device OEM has NFC restrictions
                      <br />• Some devices only support NFC read, not write via browser
                      <br />
                      <br />
                      <Text as="span" fontWeight="bold">
                        Device compatibility:
                      </Text>
                      <br />
                      Google Pixel, Samsung Galaxy (recent), and most stock Android devices support
                      Web NFC write. Some Chinese manufacturers (Xiaomi, Oppo, Vivo) may restrict
                      it.
                    </Text>
                  </Box>
                </Alert.Root>
              </VStack>
            </Card.Body>
          </Card.Root>
        )}
      </VStack>
    </Container>
  )
}
