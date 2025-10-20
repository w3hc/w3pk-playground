import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Addresses',
  description: 'Manage your derived Ethereum addresses',

  openGraph: {
    title: 'My Addresses',
    description: 'Manage your derived Ethereum addresses',
    url: 'https://w3pk.w3hc.org/addr',
    siteName: 'w3pk Playground',
    images: [
      {
        url: '/huangshan.png',
        width: 1200,
        height: 630,
        alt: 'Manage your derived Ethereum addresses',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'My Addresses | W3PK Playground',
    description: 'Manage your derived Ethereum addresses',
    images: ['/huangshan.png'],
    creator: '@julienbrg',
  },
}

export default function AddressesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
