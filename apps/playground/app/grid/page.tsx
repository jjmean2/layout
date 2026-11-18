'use client'

import { Dashboard } from '@/components/dashboard'

export default function GridPage() {
  return (
    <div className="app">
      <header className="gnb">Grid</header>
      <div style={{ flex: 1, minHeight: 0, padding: 0 }} data-testid="grid-host">
        <Dashboard />
      </div>
    </div>
  )
}
