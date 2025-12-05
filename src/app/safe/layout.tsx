import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Web3 payment app',
  description: 'Deploy and manage your Safe onchain wallet with session keys',
}

export default function SafeLayout({ children }: { children: React.ReactNode }) {
  return children
}
