import type { Metadata } from 'next'
import { Mail } from './mail'

export const metadata: Metadata = { title: '메일 · showcase' }

export default function MailPage() {
  return <Mail />
}
