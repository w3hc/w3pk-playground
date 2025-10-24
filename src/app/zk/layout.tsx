import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ZK proofs with w3pk',
  description:
    'Passwordless Web3 authentication SDK with encrypted wallets, HD derivation, stealth addresses, and privacy features',
}

export default function ZKLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
