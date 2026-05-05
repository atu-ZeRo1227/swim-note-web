import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Swim Note',
  description: 'Swim Note App',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
