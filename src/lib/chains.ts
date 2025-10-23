/**
 * Testnet chain configurations
 * Only Gnosis Chiado is enabled for Safe deployment
 */

export interface Chain {
  id: number
  name: string
  rpcUrl: string
  blockExplorer: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  enabled: boolean
  testnet: boolean
}

export const CHAINS: Record<string, Chain> = {
  ethereum: {
    id: 11155111, // Sepolia
    name: 'Ethereum Sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    enabled: false,
    testnet: true,
  },
  optimism: {
    id: 11155420, // OP Sepolia
    name: 'Optimism Sepolia',
    rpcUrl: 'https://sepolia.optimism.io',
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    enabled: false,
    testnet: true,
  },
  base: {
    id: 84532, // Base Sepolia
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    blockExplorer: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    enabled: false,
    testnet: true,
  },
  arbitrum: {
    id: 421614, // Arbitrum Sepolia
    name: 'Arbitrum Sepolia',
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    blockExplorer: 'https://sepolia.arbiscan.io',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    enabled: false,
    testnet: true,
  },
  zksync: {
    id: 300, // zkSync Sepolia
    name: 'zkSync Sepolia',
    rpcUrl: 'https://sepolia.era.zksync.dev',
    blockExplorer: 'https://sepolia.explorer.zksync.io',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    enabled: false,
    testnet: true,
  },
  ink: {
    id: 763373, // INK Sepolia
    name: 'INK Sepolia',
    rpcUrl: 'https://rpc-gel-sepolia.inkonchain.com',
    blockExplorer: 'https://explorer-sepolia.inkonchain.com',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    enabled: false,
    testnet: true,
  },
  gnosis: {
    id: 10200, // Gnosis Chiado
    name: 'Gnosis Chiado',
    rpcUrl: 'https://rpc.chiadochain.net',
    blockExplorer: 'https://gnosis-chiado.blockscout.com',
    nativeCurrency: {
      name: 'Chiado xDAI',
      symbol: 'xDAI',
      decimals: 18,
    },
    enabled: true, // Only enabled chain
    testnet: true,
  },
  celo: {
    id: 44787, // Celo Alfajores
    name: 'Celo Alfajores',
    rpcUrl: 'https://alfajores-forno.celo-testnet.org',
    blockExplorer: 'https://alfajores.celoscan.io',
    nativeCurrency: {
      name: 'CELO',
      symbol: 'CELO',
      decimals: 18,
    },
    enabled: false,
    testnet: true,
  },
  polygon: {
    id: 80002, // Polygon Amoy
    name: 'Polygon Amoy',
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    blockExplorer: 'https://amoy.polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    enabled: false,
    testnet: true,
  },
  lukso: {
    id: 4201, // LUKSO Testnet
    name: 'LUKSO Testnet',
    rpcUrl: 'https://rpc.testnet.lukso.network',
    blockExplorer: 'https://explorer.execution.testnet.lukso.network',
    nativeCurrency: {
      name: 'LYXt',
      symbol: 'LYXt',
      decimals: 18,
    },
    enabled: false,
    testnet: true,
  },
  avalanche: {
    id: 43113, // Avalanche Fuji
    name: 'Avalanche Fuji',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    blockExplorer: 'https://testnet.snowtrace.io',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18,
    },
    enabled: false,
    testnet: true,
  },
}

export const getChainById = (chainId: number): Chain | undefined => {
  return Object.values(CHAINS).find(chain => chain.id === chainId)
}

export const getEnabledChains = (): Chain[] => {
  return Object.values(CHAINS).filter(chain => chain.enabled)
}
