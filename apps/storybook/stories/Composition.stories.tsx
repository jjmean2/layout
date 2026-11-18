import type { Meta, StoryObj } from '@storybook/react-vite'
import { SidePanels } from '@justwonder/layout/side-panels'
import { createLayout, pane, splitNode } from '@justwonder/layout/tiling'
import { useRef } from 'react'
import { TilingDemo } from './fixtures'

/** GNB 아래 SidePanels, Main 안의 Tiling. floating 창은 GNB 아래 작업 영역 전체를 움직인다. */
function AppShell() {
  const workspace = useRef<HTMLDivElement>(null)
  return (
    <div className="demo-col">
      <div className="demo-bar">GNB</div>
      <div className="demo-fill">
        <SidePanels.Root
          ref={workspace}
          defaultLayout={{ left: { size: 220, collapsed: false }, right: { size: 240, collapsed: false } }}
        >
          <SidePanels.Panel side="left" className="side" aria-label="탐색">
            <div className="side-inner">탐색</div>
          </SidePanels.Panel>
          <SidePanels.Separator side="left" className="sash" aria-label="탐색 패널 너비" />
          <SidePanels.HoverTrigger side="left" className="edge-zone" aria-label="탐색 패널 열기" />
          <SidePanels.Main minSize={320}>
            <div className="tiling-wrap">
              <TilingDemo
                defaultLayout={createLayout(splitNode('row', [pane('list'), pane('detail')]), {
                  floating: [{ id: 'floating', rect: { x: 260, y: 40, width: 300, height: 200 } }],
                })}
                floating={{ bounds: workspace }}
              />
            </div>
          </SidePanels.Main>
          <SidePanels.Panel side="right" className="side" aria-label="속성">
            <div className="side-inner">속성</div>
          </SidePanels.Panel>
          <SidePanels.Separator side="right" className="sash" aria-label="속성 패널 너비" />
          <SidePanels.HoverTrigger side="right" className="edge-zone" aria-label="속성 패널 열기" />
        </SidePanels.Root>
      </div>
    </div>
  )
}

const meta = {
  title: 'Recipes/App shell',
  component: AppShell,
  parameters: { docs: { story: { iframeHeight: '560px' } } },
} satisfies Meta<typeof AppShell>

export default meta
export const GnbSidePanelsTiling: StoryObj<typeof meta> = {}
