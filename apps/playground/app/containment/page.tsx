'use client'

import { createLayout, pane, splitNode, type TilingLayout } from '@justwonder/layout/tiling'
import { useState } from 'react'
import { Workspace } from '@/components/workspace-panes'

const make = (prefix: string): TilingLayout =>
  createLayout(splitNode('row', [pane(`${prefix}-a`), pane(`${prefix}-b`)]))

/** 스크롤되는 문서 안, transform과 overflow: hidden이 걸린 영역에 Tiling을 넣는다. */
export default function ContainmentPage() {
  const [contained, setContained] = useState(() => make('c'))
  const [escaping, setEscaping] = useState(() => make('v'))
  const frame = {
    height: 320,
    margin: '16px 0',
    border: '1px solid #ccc',
    overflow: 'hidden',
    transform: 'translateZ(0)',
  } as const
  return (
    <div style={{ padding: '24px 48px' }}>
      <h1>Containment</h1>
      <p>각 영역은 transform과 overflow: hidden이 걸린 컨테이너다.</p>
      <h2>bounds: container</h2>
      <div style={frame} data-testid="frame-container">
        <Workspace layout={contained} onLayoutChange={setContained} floating={{ bounds: 'container' }} />
      </div>
      <h2>bounds: viewport</h2>
      <div style={frame} data-testid="frame-viewport">
        <Workspace layout={escaping} onLayoutChange={setEscaping} floating={{ bounds: 'viewport' }} />
      </div>
    </div>
  )
}
