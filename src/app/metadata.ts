import { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://w3pk.w3hc.org'),

  title: 'w3pk Playground',
  description:
    'Passwordless Ethereum wallets secured by biometric authentication and client-side encryption',

  keywords: ['w3pk', 'WebAuthn', 'Next.js', 'Web3', 'Ethereum'],
  authors: [{ name: 'Julien', url: 'https://github.com/julienbrg' }],

  openGraph: {
    title: 'w3pk Playground',
    description:
      'Passwordless Ethereum wallets secured by biometric authentication and client-side encryption',
    url: 'https://w3pk.w3hc.org',
    siteName: 'w3pk Playground',
    images: [
      {
        url: '/huangshan.png',
        width: 1200,
        height: 630,
        alt: 'Passwordless Ethereum wallets secured by biometric authentication and client-side encryption',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'w3pk Playground',
    description:
      'Passwordless Ethereum wallets secured by biometric authentication and client-side encryption',
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
