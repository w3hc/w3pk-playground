import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Safe Wallet | W3PK Playground',
  description: 'Deploy and manage your Safe smart wallet with session keys',
}

export default function SafeLayout({ children }: { children: React.ReactNode }) {
  return children
}
