'use client'

import { SidePanels, toggleCollapsed, type SidePanelsLayout } from '@justwonder/layout/side-panels'
import { useState } from 'react'
import { RenderCounter } from '@/components/render-counter'

export default function SidePanelsPage() {
  const [layout, setLayout] = useState<SidePanelsLayout>({
    left: { size: 260, collapsed: false },
    right: { size: 300, collapsed: true },
  })
  return (
    <div className="app">
      <header className="gnb">
        <button data-testid="toggle-left" onClick={() => setLayout((l) => toggleCollapsed(l, 'left'))}>
          왼쪽 패널
        </button>
        <button data-testid="toggle-right" onClick={() => setLayout((l) => toggleCollapsed(l, 'right'))}>
          오른쪽 패널
        </button>
        <span data-testid="layout-json" style={{ fontSize: 11, opacity: 0.7 }}>
          {JSON.stringify(layout)}
        </span>
      </header>
      <SidePanels.Root className="workspace" layout={layout} onLayoutChange={setLayout}>
        <SidePanels.Panel
          side="left"
          className="side"
          minSize={180}
          maxSize={480}
          render={<aside aria-label="왼쪽 패널" />}
          data-testid="left"
        >
          <div className="side-inner">
            <p>왼쪽 패널</p>
            <input aria-label="left-input" />
          </div>
        </SidePanels.Panel>
        <SidePanels.Separator side="left" className="sash" data-testid="left-handle" />
        <SidePanels.HoverTrigger
          side="left"
          className="edge-zone"
          data-testid="left-trigger"
          aria-label="왼쪽 패널 보기"
        />
        <SidePanels.Main className="main" minSize={240}>
          <div style={{ padding: 16 }}>
            <RenderCounter id="main-content" />
            Main 영역
          </div>
        </SidePanels.Main>
        <SidePanels.Panel
          side="right"
          className="side"
          hoverOverlay={false}
          data-testid="right"
          aria-label="오른쪽 패널"
        >
          <div className="side-inner">오른쪽 패널 (hover overlay 꺼짐)</div>
        </SidePanels.Panel>
        <SidePanels.Separator side="right" className="sash" data-testid="right-handle" />
        <SidePanels.HoverTrigger
          side="right"
          className="edge-zone"
          data-testid="right-trigger"
          aria-label="오른쪽 패널 보기"
        />
      </SidePanels.Root>
    </div>
  )
}
