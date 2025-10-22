import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RPC Endpoints',
  description: 'Browse and test RPC endpoints for various blockchain networks',

  openGraph: {
    title: 'RPC Endpoints',
    description: 'Browse and test RPC endpoints for various blockchain networks',
    url: 'https://w3pk.w3hc.org/networks',
    siteName: 'w3pk Playground',
    images: [
      {
        url: '/huangshan.png',
        width: 1200,
        height: 630,
        alt: 'Browse and test RPC endpoints',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'RPC Endpoints | W3PK Playground',
    description: 'Browse and test RPC endpoints for various blockchain networks',
    images: ['/huangshan.png'],
    creator: '@julienbrg',
  },
}

export default function NetworksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
