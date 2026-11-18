'use client'

import { SidePanels, getSide, toggleCollapsed, type SidePanelsLayout } from '@justwonder/layout/side-panels'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { usePersistedState } from './persisted-state'
import { ShellContext } from './shell-context'

const NAV = [
  { href: '/', label: '개요' },
  { href: '/workspace', label: '주문 관리 (Tiling)' },
  { href: '/dashboard', label: '대시보드 (Grid)' },
  { href: '/mail', label: '메일 (SidePanels 중첩)' },
]

const INITIAL: SidePanelsLayout = {
  left: { size: 232, collapsed: false },
  right: { size: 300, collapsed: true },
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [layout, setLayout, resetLayout] = usePersistedState('showcase:shell', INITIAL)
  const [inspector, setInspector] = useState<ReactNode>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const shell = useMemo(() => ({ workspaceRef, setInspector }), [])

  const leftOpen = !getSide(layout, 'left').collapsed
  const rightOpen = !getSide(layout, 'right').collapsed

  return (
    <ShellContext.Provider value={shell}>
      <div className="shell">
        <header className="gnb">
          <button
            className="icon-btn"
            aria-pressed={leftOpen}
            aria-label="탐색 패널"
            onClick={() => setLayout((l) => toggleCollapsed(l, 'left'))}
          >
            ☰
          </button>
          <span className="brand">justwonder/layout</span>
          <span className="spacer" />
          <button className="icon-btn" onClick={resetLayout}>
            셸 레이아웃 초기화
          </button>
          <button
            className="icon-btn"
            aria-pressed={rightOpen}
            onClick={() => setLayout((l) => toggleCollapsed(l, 'right'))}
          >
            Inspector
          </button>
        </header>

        <SidePanels.Root ref={workspaceRef} className="workspace" layout={layout} onLayoutChange={setLayout}>
          <SidePanels.Panel side="left" className="side" minSize={180} maxSize={360} render={<nav aria-label="예제" />}>
            <div className="side-inner nav">
              <div className="nav-title">예제</div>
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} aria-current={pathname === item.href ? 'page' : undefined}>
                  {item.label}
                </Link>
              ))}
            </div>
            <SidePanels.ResizeHandle className="sash" aria-label="탐색 패널 너비" />
          </SidePanels.Panel>
          <SidePanels.HoverTrigger side="left" className="edge-zone" aria-label="탐색 패널 열기" />

          <SidePanels.Main className="main" minSize={420}>
            {children}
          </SidePanels.Main>

          <SidePanels.Panel side="right" className="side" minSize={240} maxSize={560} render={<aside aria-label="Inspector" />}>
            <div className="side-inner inspector">
              {inspector ?? <p style={{ color: 'var(--muted)' }}>이 화면에는 표시할 정보가 없습니다.</p>}
            </div>
            <SidePanels.ResizeHandle className="sash" aria-label="Inspector 너비" />
          </SidePanels.Panel>
          <SidePanels.HoverTrigger side="right" className="edge-zone" aria-label="Inspector 열기" />
        </SidePanels.Root>
      </div>
    </ShellContext.Provider>
  )
}
