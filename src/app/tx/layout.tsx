import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payment',
  description: 'Send and receive EUR with your Safe wallet',

  openGraph: {
    title: 'Payment | W3PK Playground',
    description: 'Send and receive EUR with your Safe wallet',
    url: 'https://w3pk.w3hc.org/tx',
    siteName: 'w3pk Playground',
    images: [
      {
        url: '/huangshan.png',
        width: 1200,
        height: 630,
        alt: 'Send and receive EUR',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Payment | W3PK Playground',
    description: 'Send and receive EUR with your Safe wallet',
    images: ['/huangshan.png'],
    creator: '@julienbrg',
  },
}

export default function SafeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
