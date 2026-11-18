'use client'

import { Grid, type GridLayout } from '@justwonder/layout/grid'
import { useState } from 'react'
import { RenderCounter } from '@/components/render-counter'

const initial: GridLayout = [
  { id: 'clock', x: 0, y: 0, w: 2, h: 2 },
  { id: 'weather', x: 2, y: 0, w: 4, h: 2 },
  { id: 'notes', x: 0, y: 2, w: 4, h: 2 },
  { id: 'todo', x: 4, y: 2, w: 2, h: 2 },
  { id: 'pinned', x: 6, y: 0, w: 2, h: 1, static: true },
]

export function Dashboard({ testPrefix = '' }: { testPrefix?: string }) {
  const [items, setItems] = useState(initial)
  return (
    <Grid.Root layout={items} onLayoutChange={setItems} cols={8} gap={12} data-testid={`${testPrefix}grid`}>
      {items.map((item) => (
        <Grid.Item
          key={item.id}
          id={item.id}
          sizes={[
            [2, 1],
            [2, 2],
            [4, 2],
            [4, 4],
          ]}
          className="widget"
          data-testid={`${testPrefix}item-${item.id}`}
        >
          <Grid.MoveHandle className="widget-bar" data-testid={`${testPrefix}move-${item.id}`} />
          <div className="widget-body">
            <RenderCounter id={`${testPrefix}widget-${item.id}`} />
            {item.id}
            {item.static ? ' (고정)' : ''}
          </div>
          {item.static ? null : <Grid.ResizeHandle className="corner" data-testid={`${testPrefix}resize-${item.id}`} />}
        </Grid.Item>
      ))}
      <Grid.Placeholder className="drop-target" data-testid={`${testPrefix}placeholder`} />
      <span hidden data-testid={`${testPrefix}grid-json`}>
        {JSON.stringify(items)}
      </span>
    </Grid.Root>
  )
}

