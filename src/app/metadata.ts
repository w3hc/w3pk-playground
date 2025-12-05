import { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://w3pk.w3hc.org'),

  title: 'Shebam',
  description: 'Web3 payment app',

  keywords: ['shebam', 'w3pk', 'WebAuthn', 'Next.js', 'Web3', 'Ethereum'],
  authors: [{ name: 'W3HC', url: 'https://github.com/w3hc' }],

  openGraph: {
    title: 'Shebam',
    description: 'Web3 payment app',
    url: 'https://w3pk.w3hc.org',
    siteName: 'w3pk Playground',
    images: [
      {
        url: '/huangshan.png',
        width: 1200,
        height: 630,
        alt: 'Web3 payment app',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Shebam',
    description: 'Web3 payment app',
    images: ['/huangshan.png'],
    creator: '@julienbrg',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  verification: {
    google: 'your-google-site-verification',
  },
}
