'use client'

import { SidePanels, type SidePanelsLayout } from '@justwonder/layout/side-panels'
import { createLayout, pane, splitNode, type TilingLayout } from '@justwonder/layout/tiling'
import { useRef, useState } from 'react'
import { Dashboard } from '@/components/dashboard'
import { PaneBody, Workspace } from '@/components/workspace-panes'

/** 중첩: SidePanels > Main > Tiling > pane 안의 Grid */
export default function NestedPage() {
  const [side, setSide] = useState<SidePanelsLayout>({ left: { size: 200, collapsed: false } })
  const [layout, setLayout] = useState<TilingLayout>(() =>
    createLayout(splitNode('row', [pane('dash'), pane('editor')], [0.7, 0.3])),
  )
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className="app">
      <header className="gnb">
        <span data-testid="side-json">{JSON.stringify(side)}</span>
        <span data-testid="layout-json" style={{ fontSize: 10, opacity: 0.6 }}>
          {JSON.stringify(layout)}
        </span>
      </header>
      <SidePanels.Root ref={ref} className="workspace" layout={side} onLayoutChange={setSide}>
        <SidePanels.Panel side="left" className="side" aria-label="탐색">
          <div className="side-inner">탐색</div>
        </SidePanels.Panel>
        <SidePanels.Separator side="left" className="sash" />
        <SidePanels.Main className="main">
          <Workspace
            layout={layout}
            onLayoutChange={setLayout}
            floating={{ bounds: ref }}
            renderBody={(id) => (id === 'dash' ? <Dashboard testPrefix="d-" /> : <PaneBody id={id} />)}
          />
        </SidePanels.Main>
      </SidePanels.Root>
    </div>
  )
}
