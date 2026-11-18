import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/app-shell'
import './globals.css'

export const metadata: Metadata = {
  title: '@justwonder/layout showcase',
  description: 'SidePanels, Tiling, Grid로 구성한 업무 화면 예제',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
