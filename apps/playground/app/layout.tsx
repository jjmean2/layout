import type { ReactNode } from 'react'
import './globals.css'

export const metadata = { title: 'Layout playground' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
