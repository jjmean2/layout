import type { Meta, StoryObj } from '@storybook/react-vite'
import { createLayout, pane, show, splitNode, type TilingLayout } from '@justwonder/layout/tiling'
import { useState } from 'react'
import { TilingDemo } from './fixtures'

const basic = () =>
  createLayout(
    splitNode(
      'row',
      [pane('editor'), splitNode('column', [pane('preview'), pane('terminal')], [0.6, 0.4])],
      [0.55, 0.45],
    ),
  )

const meta = {
  title: 'Layouts/Tiling',
  component: TilingDemo,
  decorators: [
    (Story) => (
      <div className="tiling-wrap">
        <Story />
      </div>
    ),
  ],
  args: { gap: 6 },
  argTypes: { gap: { control: { type: 'range', min: 0, max: 24 } } },
} satisfies Meta<typeof TilingDemo>

export default meta
type Story = StoryObj<typeof meta>

/** 분할, separator 드래그(키보드: 방향키, Home, End), pane 헤더의 float/split/hide/close */
export const Basic: Story = { args: { defaultLayout: basic() } }

/** floating 창이 Tiling 영역 안에서만 움직인다 (bounds: 'container', 기본값) */
export const FloatingInContainer: Story = {
  args: {
    defaultLayout: createLayout(splitNode('row', [pane('main'), pane('side')]), {
      floating: [{ id: 'palette', rect: { x: 60, y: 40, width: 320, height: 200 } }],
    }),
    floating: { bounds: 'container' },
  },
}

/** floating 창이 화면 전체로 나간다. 창 위치를 바깥 여백까지 옮겨 보라 (bounds: 'viewport') */
export const FloatingInViewport: Story = {
  decorators: [
    (Story) => (
      <div style={{ height: '100%', padding: 48, background: '#e6e9ee' }}>
        <div style={{ height: '100%', overflow: 'hidden', transform: 'translateZ(0)', border: '1px solid #c5ccd6' }}>
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    defaultLayout: createLayout(splitNode('row', [pane('left'), pane('right')]), {
      floating: [{ id: 'inspector', rect: { x: 40, y: 20, width: 300, height: 200 } }],
    }),
    floating: { bounds: 'viewport', minVisible: 'full' },
  },
}

/** 숨긴 pane은 mount 상태를 유지하고, 원래 자리로 돌아온다 */
function HiddenPanesDemo(args: Parameters<typeof TilingDemo>[0]) {
  const [layout, setLayout] = useState<TilingLayout>(() => createLayout(basic().root, { hidden: [{ id: 'notes' }] }))
  return (
    <div className="demo-col">
      <div className="demo-bar">
        {layout.hidden.length === 0 ? <span>pane 헤더의 hide로 숨겨 보라</span> : null}
        {layout.hidden.map((h) => (
          <button key={h.id} onClick={() => setLayout((l) => show(l, h.id))}>
            {h.id} 보이기
          </button>
        ))}
      </div>
      <div className="demo-fill" style={{ padding: 8 }}>
        <TilingDemo {...args} layout={layout} onLayoutChange={setLayout} />
      </div>
    </div>
  )
}

export const HiddenPanes: Story = { render: (args) => <HiddenPanesDemo {...args} /> }
