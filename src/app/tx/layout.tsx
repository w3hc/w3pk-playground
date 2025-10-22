import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Safe Wallet',
  description: 'Deploy and manage your Safe smart wallet with session keys',

  openGraph: {
    title: 'Safe Wallet | W3PK Playground',
    description: 'Deploy and manage your Safe smart wallet with session keys',
    url: 'https://w3pk.w3hc.org/tx',
    siteName: 'w3pk Playground',
    images: [
      {
        url: '/huangshan.png',
        width: 1200,
        height: 630,
        alt: 'Deploy and manage your Safe smart wallet',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Safe Wallet | W3PK Playground',
    description: 'Deploy and manage your Safe smart wallet with session keys',
    images: ['/huangshan.png'],
    creator: '@julienbrg',
  },
}

export default function SafeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
