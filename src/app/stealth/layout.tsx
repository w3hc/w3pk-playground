import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ERC-5564 Stealth Addresses | w3pk Playground',
  description: 'Privacy-preserving stealth addresses with view tag optimization - ERC-5564 compliant',
}

export default function StealthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
