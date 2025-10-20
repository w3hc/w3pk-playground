import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Message',
  description: 'Sign messages with your Ethereum wallet',

  openGraph: {
    title: 'Sign Message',
    description: 'Sign messages with your Ethereum wallet',
    url: 'https://w3pk.w3hc.org/sig',
    siteName: 'w3pk Playground',
    images: [
      {
        url: '/huangshan.png',
        width: 1200,
        height: 630,
        alt: 'Sign messages with your Ethereum wallet',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Sign Message | w3pk Playground',
    description: 'Sign messages with your Ethereum wallet',
    images: ['/huangshan.png'],
    creator: '@julienbrg',
  },
}

export default function Web3Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
