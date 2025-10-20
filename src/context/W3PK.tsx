'use client'

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
  useEffect,
} from 'react'
import { useToast } from '@chakra-ui/react'
import { createWeb3Passkey, StealthKeys } from 'w3pk'

interface W3pkUser {
  id: string
  username: string
  displayName: string
  ethereumAddress: string
}

interface DerivedWallet {
  address: string
  privateKey: string
}

interface W3pkType {
  isAuthenticated: boolean
  user: W3pkUser | null
  isLoading: boolean
  login: () => Promise<void>
  register: (username: string) => Promise<void>
  logout: () => void
  signMessage: (message: string) => Promise<string | null>
  deriveWallet: (index: number) => Promise<DerivedWallet>
  generateStealthAddress: () => Promise<{
    stealthAddress: string
    stealthPrivateKey: string
    ephemeralPublicKey: string
  } | null>
  getStealthKeys: () => Promise<StealthKeys | null>
}

const W3PK = createContext<W3pkType>({
  isAuthenticated: false,
  user: null,
  isLoading: false,
  login: async () => {},
  register: async (username: string) => {},
  logout: () => {},
  signMessage: async (message: string) => null,
  deriveWallet: async (index: number) => ({ address: '', privateKey: '' }),
  generateStealthAddress: async () => null,
  getStealthKeys: async () => null,
})

export const useW3PK = () => useContext(W3PK)

interface W3pkProviderProps {
  children: ReactNode
}

export const W3pkProvider: React.FC<W3pkProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<W3pkUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const toast = useToast()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Stable callback to prevent w3pk re-creation
  const handleAuthStateChanged = useCallback((isAuth: boolean, w3pkUser?: any) => {
    if (isAuth && w3pkUser) {
      const userData: W3pkUser = {
        id: w3pkUser.id,
        username: w3pkUser.username,
        displayName: w3pkUser.displayName,
        ethereumAddress: w3pkUser.ethereumAddress,
      }
      setUser(userData)
      setIsAuthenticated(true)

      // Store authentication state in localStorage with expiration (24 hours)
      if (typeof window !== 'undefined' && window.localStorage) {
        const authStateData = {
          isAuthenticated: true,
          user: userData,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }
        localStorage.setItem('w3pk_auth_state', JSON.stringify(authStateData))
      }
    } else {
      setUser(null)
      setIsAuthenticated(false)

      // Clear stored authentication state
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('w3pk_auth_state')
      }
    }
  }, [])

  // Initialize w3pk SDK with stealth address capabilities only
  const w3pk = useMemo(
    () =>
      createWeb3Passkey({
        apiBaseUrl: process.env.NEXT_PUBLIC_WEBAUTHN_API_URL || 'https://webauthn.w3hc.org',
        stealthAddresses: {}, // Enable stealth address generation
        debug: process.env.NODE_ENV === 'development',
        onAuthStateChanged: handleAuthStateChanged,
      }),
    [handleAuthStateChanged]
  )

  // Check for existing authentication state on mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      if (!isMounted || !w3pk) return

      try {
        console.log('Checking for existing authentication state...')

        // Check if w3pk already has an authenticated user
        if (w3pk.isAuthenticated && w3pk.user) {
          console.log('Found existing w3pk authentication, restoring state...')
          handleAuthStateChanged(true, w3pk.user)
          return
        }

        // Check for stored authentication state in localStorage (if available)
        if (typeof window !== 'undefined' && window.localStorage) {
          const storedAuthState = localStorage.getItem('w3pk_auth_state')
          if (storedAuthState) {
            try {
              const authData = JSON.parse(storedAuthState)
              if (authData.isAuthenticated && authData.user && authData.expiresAt > Date.now()) {
                console.log('Found valid stored authentication, restoring...')
                handleAuthStateChanged(true, authData.user)
                return
              } else {
                console.log('Stored authentication expired, clearing...')
                localStorage.removeItem('w3pk_auth_state')
              }
            } catch (parseError) {
              console.error('Failed to parse stored auth state:', parseError)
              localStorage.removeItem('w3pk_auth_state')
            }
          }
        }

        console.log('No existing authentication found')
        handleAuthStateChanged(false)
      } catch (error) {
        console.error('Error checking authentication state:', error)
        handleAuthStateChanged(false)
      }
    }

    checkExistingAuth()
  }, [isMounted, w3pk, handleAuthStateChanged])

  const register = async (username: string) => {
    try {
      setIsLoading(true)
      console.log('=== Starting Registration with w3pk ===')

      await w3pk.register({
        username,
        ethereumAddress: '0x0000000000000000000000000000000000000000',
      })
      console.log('Registration successful, address:', w3pk.walletAddress)

      toast({
        title: 'Registration Successful! 🎉',
        description: 'Your encrypted wallet has been created and stored securely with w3pk',
        status: 'success',
        duration: 5000,
        isClosable: true,
      })

      toast({
        title: '🚨 BACKUP YOUR RECOVERY PHRASE',
        description: 'Save your 12-word recovery phrase in a safe place. This is your only backup!',
        status: 'warning',
        duration: 10000,
        isClosable: true,
      })
    } catch (error: any) {
      console.error('Registration failed:', error)
      toast({
        title: 'Registration Failed',
        description: error.message || 'Failed to register with w3pk',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const login = async () => {
    try {
      setIsLoading(true)
      console.log('=== Starting Login with w3pk ===')

      const result = await w3pk.login()
      console.log('Login successful, user:', result.user?.username)

      const hasWallet = w3pk.isAuthenticated && w3pk.walletAddress
      const displayName =
        result.user?.displayName || w3pk.user?.displayName || result.user?.username || 'Anon'

      toast({
        title: 'Login Successful! ✅',
        description: hasWallet
          ? `Oh! It's you, ${displayName}! Welcome back! Your wallet is available.`
          : `Welcome back, ${displayName}! Welcome back! No wallet found on this device.`,
        status: hasWallet ? 'success' : 'warning',
        duration: 5000,
        isClosable: true,
      })
    } catch (error: any) {
      console.error('Authentication failed:', error)
      toast({
        title: 'Authentication Failed',
        description: error.message || 'Failed to authenticate with w3pk',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signMessage = async (message: string): Promise<string | null> => {
    if (!user) {
      toast({
        title: 'Not Authenticated',
        description: 'Please log in first.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return null
    }

    try {
      console.log('=== Starting Message Signing with w3pk ===')

      // ALWAYS require fresh authentication for signing operations
      await w3pk.login()
      console.log('Fresh authentication completed')

      const signature = await w3pk.signMessage(message)
      console.log('Message signed successfully')

      return signature
    } catch (error: any) {
      console.error('Message signing failed:', error)
      toast({
        title: 'Signing Failed',
        description: error.message || 'Failed to sign message with w3pk',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return null
    }
  }

  const deriveWallet = async (index: number): Promise<DerivedWallet> => {
    if (!user) {
      throw new Error('Not authenticated. Please log in first.')
    }

    try {
      console.log(`=== Deriving Wallet at Index ${index} ===`)

      // Check if we need fresh authentication
      // If w3pk.isAuthenticated is false, we need to login first
      if (!w3pk.isAuthenticated) {
        console.log('SDK not authenticated, requiring fresh login...')
        await w3pk.login()
        console.log('Fresh authentication completed')
      }

      const derivedWallet = await w3pk.deriveWallet(index)
      console.log(`Wallet derived successfully at index ${index}:`, derivedWallet.address)

      return derivedWallet
    } catch (error: any) {
      console.error(`Wallet derivation failed at index ${index}:`, error)

      // If it's an auth error, try to login once and retry
      if (error.message?.includes('Not authenticated') || error.message?.includes('login')) {
        console.log('Authentication required, prompting for login...')
        try {
          await w3pk.login()
          const derivedWallet = await w3pk.deriveWallet(index)
          console.log(`Wallet derived successfully after re-authentication at index ${index}`)
          return derivedWallet
        } catch (retryError: any) {
          console.error('Retry after authentication failed:', retryError)
          toast({
            title: 'Authentication Required',
            description: 'Please authenticate to derive addresses',
            status: 'error',
            duration: 5000,
            isClosable: true,
          })
          throw retryError
        }
      }

      toast({
        title: 'Derivation Failed',
        description: error.message || `Failed to derive wallet at index ${index}`,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      throw error
    }
  }

  const logout = () => {
    w3pk.logout()

    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out. Your wallet remains on this device.',
      status: 'info',
      duration: 4000,
      isClosable: true,
    })
  }

  const generateStealthAddress = async (): Promise<{
    stealthAddress: string
    stealthPrivateKey: string
    ephemeralPublicKey: string
  } | null> => {
    if (!user) {
      toast({
        title: 'Not Authenticated',
        description: 'Please log in first',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return null
    }

    try {
      console.log('=== Generating Stealth Address with w3pk ===')

      if (!w3pk.stealth) {
        throw new Error('Stealth address module not initialized')
      }

      const stealthResult = await w3pk.stealth.generateStealthAddress()
      console.log('Stealth address generated:', stealthResult.stealthAddress)

      return stealthResult
    } catch (error: any) {
      console.error('Stealth address generation failed:', error)
      toast({
        title: 'Stealth Address Failed',
        description: error.message || 'Failed to generate stealth address',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return null
    }
  }

  const getStealthKeys = async (): Promise<StealthKeys | null> => {
    if (!user) {
      toast({
        title: 'Not Authenticated',
        description: 'Please log in first',
        status: 'error',
        duration: 3000,
        isClosable: true,
      })
      return null
    }

    try {
      console.log('=== Getting Stealth Keys with w3pk ===')

      if (!w3pk.stealth) {
        throw new Error('Stealth address module not initialized')
      }

      const stealthKeys = await w3pk.stealth.getKeys()
      console.log('Stealth keys retrieved, meta address:', stealthKeys.metaAddress)

      return stealthKeys
    } catch (error: any) {
      console.error('Failed to get stealth keys:', error)
      toast({
        title: 'Stealth Keys Failed',
        description: error.message || 'Failed to get stealth keys',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
      return null
    }
  }

  return (
    <W3PK.Provider
      value={{
        isAuthenticated: isMounted && isAuthenticated,
        user,
        isLoading,
        login,
        register,
        logout,
        signMessage,
        deriveWallet,
        generateStealthAddress,
        getStealthKeys,
      }}
    >
      {children}
    </W3PK.Provider>
  )
}
