import type { Metadata } from 'next'
import { OrderWorkspace } from './order-workspace'

export const metadata: Metadata = { title: '주문 관리 · showcase' }

export default function WorkspacePage() {
  return <OrderWorkspace />
}
