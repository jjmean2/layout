import type { Meta, StoryObj } from '@storybook/react-vite'
import { Grid, type Collision, type GridLayout } from '@justwonder/layout/grid'

interface Args {
  cols: number
  rowHeight: number | 'square'
  gap: number
  collision: Collision
  compact: boolean
  presets: boolean
}

const LAYOUT: GridLayout = [
  { id: 'a', x: 0, y: 0, w: 2, h: 2 },
  { id: 'b', x: 2, y: 0, w: 2, h: 1 },
  { id: 'c', x: 4, y: 0, w: 2, h: 2 },
  { id: 'd', x: 2, y: 1, w: 2, h: 2 },
  { id: 'e', x: 0, y: 3, w: 4, h: 1 },
  { id: 'pinned', x: 6, y: 0, w: 2, h: 1, static: true },
]

function Demo(args: Args) {
  return (
    <div className="grid-wrap">
      <Grid.Root
        key={`${args.cols}-${args.collision}-${args.compact}`}
        defaultLayout={LAYOUT}
        cols={args.cols}
        rowHeight={args.rowHeight}
        gap={args.gap}
        collision={args.collision}
        compact={args.compact}
      >
        {LAYOUT.map((item) => (
          <Grid.Item
            key={item.id}
            id={item.id}
            className="widget"
            sizes={
              args.presets
                ? [
                    [2, 1],
                    [2, 2],
                    [4, 2],
                  ]
                : undefined
            }
            maxW={args.presets ? undefined : 4}
          >
            {item.static ? (
              <div className="widget-bar">{item.id} · static</div>
            ) : (
              <Grid.MoveHandle className="widget-bar" aria-label={`${item.id} 이동`}>
                {item.id}
              </Grid.MoveHandle>
            )}
            <div className="widget-body muted">
              {item.static ? '밀리지 않는 고정 위젯' : '방향키로 이동 (handle 포커스)'}
            </div>
            {item.static ? null : <Grid.ResizeHandle className="corner" aria-label={`${item.id} 크기`} />}
          </Grid.Item>
        ))}
        <Grid.Placeholder className="drop-target" />
      </Grid.Root>
    </div>
  )
}

const meta = {
  title: 'Layouts/Grid',
  component: Demo,
  args: { cols: 8, rowHeight: 'square', gap: 12, collision: 'push', compact: false, presets: true },
  argTypes: {
    cols: { control: { type: 'range', min: 4, max: 12 } },
    rowHeight: { control: 'select', options: ['square', 60, 90, 120] },
    gap: { control: { type: 'range', min: 0, max: 24 } },
    collision: { control: 'inline-radio', options: ['push', 'block'] },
  },
} satisfies Meta<typeof Demo>

export default meta
type Story = StoryObj<typeof meta>

/** 홈 화면 방식: 정사각 셀, 허용 크기 목록, 겹치면 밀어낸다 */
export const HomeScreen: Story = {}

/** 겹치는 이동을 거부한다 */
export const BlockCollisions: Story = { args: { collision: 'block' } }

/** 위쪽 빈칸을 자동으로 메운다 (대시보드 방식) */
export const Compact: Story = { args: { compact: true, rowHeight: 90, presets: false } }
