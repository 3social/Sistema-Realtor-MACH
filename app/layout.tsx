import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'Property Matcher — WhatsApp Inmobiliario',
  description: 'Sistema inteligente de matching automático entre ofertas y demandas de propiedades desde grupos de WhatsApp. Powered by AI.',
  keywords: ['inmobiliario', 'whatsapp', 'matching', 'propiedades', 'costa rica', 'realtor'],
  authors: [{ name: 'MACH Realtor' }],
  openGraph: {
    title: 'Property Matcher',
    description: 'Matching automático de propiedades en WhatsApp',
    type: 'website'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
