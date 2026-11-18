import type { Metadata } from 'next'
import { Dashboard } from './dashboard'

export const metadata: Metadata = { title: '대시보드 · showcase' }

export default function DashboardPage() {
  return <Dashboard />
}
