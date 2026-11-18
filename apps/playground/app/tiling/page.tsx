'use client'

import { SidePanels, toggleCollapsed, type SidePanelsLayout } from '@justwonder/layout/side-panels'
import { createLayout, pane, show, splitNode, type TilingLayout } from '@justwonder/layout/tiling'
import { useRef, useState } from 'react'
import { Workspace } from '@/components/workspace-panes'

const initial: TilingLayout = createLayout(
  splitNode('row', [pane('editor'), splitNode('column', [pane('list'), pane('frame')], [0.5, 0.5])], [0.55, 0.45]),
)

export default function TilingPage() {
  const [side, setSide] = useState<SidePanelsLayout>({
    left: { size: 220, collapsed: false },
    right: { size: 240, collapsed: false },
  })
  const [layout, setLayout] = useState(initial)
  const workspaceRef = useRef<HTMLDivElement>(null)

  return (
    <div className="app">
      <header className="gnb" data-testid="gnb">
        <button onClick={() => setSide((l) => toggleCollapsed(l, 'left'))}>왼쪽</button>
        <button onClick={() => setSide((l) => toggleCollapsed(l, 'right'))}>오른쪽</button>
        {layout.hidden.map((h) => (
          <button key={h.id} data-testid={`show-${h.id}`} onClick={() => setLayout((l) => show(l, h.id))}>
            {h.id} 보이기
          </button>
        ))}
        <span
          data-testid="layout-json"
          style={{ fontSize: 10, opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden' }}
        >
          {JSON.stringify(layout)}
        </span>
      </header>
      <SidePanels.Root
        ref={workspaceRef}
        className="workspace"
        layout={side}
        onLayoutChange={setSide}
        data-testid="workspace"
      >
        <SidePanels.Panel side="left" className="side" render={<aside aria-label="탐색" />}>
          <div className="side-inner">탐색</div>
        </SidePanels.Panel>
        <SidePanels.Separator side="left" className="sash" />
        <SidePanels.HoverTrigger side="left" className="edge-zone" aria-label="탐색 보기" />
        <SidePanels.Main className="main" minSize={320}>
          <Workspace layout={layout} onLayoutChange={setLayout} floating={{ bounds: workspaceRef }} />
        </SidePanels.Main>
        <SidePanels.Panel side="right" className="side" data-testid="right-panel" aria-label="속성">
          <div className="side-inner">속성</div>
        </SidePanels.Panel>
        <SidePanels.Separator side="right" className="sash" />
        <SidePanels.HoverTrigger side="right" className="edge-zone" aria-label="속성 보기" />
      </SidePanels.Root>
    </div>
  )
}
