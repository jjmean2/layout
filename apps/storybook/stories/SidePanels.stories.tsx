import type { Meta, StoryObj } from '@storybook/react-vite'
import { SidePanels, toggleCollapsed, type SidePanelsLayout } from '@justwonder/layout/side-panels'
import { useState } from 'react'

interface Args {
  leftCollapsed: boolean
  rightCollapsed: boolean
  minSize: number
  maxSize: number
  hoverOverlay: boolean
  openDelay: number
  closeDelay: number
  mainMinSize: number
}

function Demo(args: Args) {
  return (
    <SidePanels.Root
      // args가 바뀌면 uncontrolled 초기값을 다시 적용한다
      key={`${args.leftCollapsed}-${args.rightCollapsed}`}
      defaultLayout={{
        left: { size: 260, collapsed: args.leftCollapsed },
        right: { size: 280, collapsed: args.rightCollapsed },
      }}
    >
      <SidePanels.Panel
        side="left"
        className="side"
        minSize={args.minSize}
        maxSize={args.maxSize}
        hoverOverlay={args.hoverOverlay ? { openDelay: args.openDelay, closeDelay: args.closeDelay } : false}
        render={<nav aria-label="탐색" />}
      >
        <div className="side-inner">
          <strong>왼쪽 패널</strong>
          <p className="muted">손잡이를 끌거나, 포커스 후 방향키 / Home / End / Enter.</p>
        </div>
        <SidePanels.ResizeHandle className="sash" aria-label="왼쪽 패널 너비" />
      </SidePanels.Panel>
      <SidePanels.HoverTrigger side="left" className="edge-zone" aria-label="왼쪽 패널 열기" />
      <SidePanels.Main className="main" minSize={args.mainMinSize}>
        <h2 style={{ marginTop: 0 }}>Main</h2>
        <p className="muted">접힌 패널은 가장자리에 마우스를 올리면 overlay로 나타나며, Main의 크기는 바뀌지 않는다.</p>
      </SidePanels.Main>
      <SidePanels.Panel side="right" className="side" minSize={args.minSize} render={<aside aria-label="속성" />}>
        <div className="side-inner">
          <strong>오른쪽 패널</strong>
        </div>
        <SidePanels.ResizeHandle className="sash" aria-label="오른쪽 패널 너비" />
      </SidePanels.Panel>
      <SidePanels.HoverTrigger side="right" className="edge-zone" aria-label="오른쪽 패널 열기" />
    </SidePanels.Root>
  )
}

const meta = {
  title: 'Layouts/SidePanels',
  component: Demo,
  args: {
    leftCollapsed: false,
    rightCollapsed: false,
    minSize: 160,
    maxSize: 480,
    hoverOverlay: true,
    openDelay: 150,
    closeDelay: 300,
    mainMinSize: 240,
  },
  argTypes: {
    minSize: { control: { type: 'range', min: 80, max: 300, step: 10 } },
    maxSize: { control: { type: 'range', min: 300, max: 800, step: 10 } },
    mainMinSize: { control: { type: 'range', min: 0, max: 600, step: 20 } },
  },
} satisfies Meta<typeof Demo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** 왼쪽 패널을 접은 상태. 화면 왼쪽 가장자리에 마우스를 올리면 overlay로 열린다. */
export const CollapsedWithHoverOverlay: Story = { args: { leftCollapsed: true } }

/** hoverOverlay={false}이면 접힌 패널은 가장자리 hover에 반응하지 않는다. */
export const HoverOverlayDisabled: Story = { args: { leftCollapsed: true, hoverOverlay: false } }

/** Root 밖(GNB)의 버튼으로 제어하는 controlled 사용. 순수 함수 toggleCollapsed를 쓴다. */
export const ControlledFromOutside: Story = {
  render: () => {
    const [layout, setLayout] = useState<SidePanelsLayout>({
      left: { size: 240, collapsed: false },
      right: { size: 240, collapsed: true },
    })
    return (
      <div className="demo-col">
        <div className="demo-bar">
          <button onClick={() => setLayout((l) => toggleCollapsed(l, 'left'))}>왼쪽</button>
          <button onClick={() => setLayout((l) => toggleCollapsed(l, 'right'))}>오른쪽</button>
          <code style={{ fontSize: 11, opacity: 0.8 }}>{JSON.stringify(layout)}</code>
        </div>
        <div className="demo-fill">
          <SidePanels.Root layout={layout} onLayoutChange={setLayout}>
            <SidePanels.Panel side="left" className="side">
              <div className="side-inner">왼쪽</div>
              <SidePanels.ResizeHandle className="sash" aria-label="왼쪽 패널 너비" />
            </SidePanels.Panel>
            <SidePanels.Main className="main">onLayoutChange는 놓을 때 한 번 호출된다.</SidePanels.Main>
            <SidePanels.Panel side="right" className="side">
              <div className="side-inner">오른쪽</div>
              <SidePanels.ResizeHandle className="sash" aria-label="오른쪽 패널 너비" />
            </SidePanels.Panel>
          </SidePanels.Root>
        </div>
      </div>
    )
  },
}
