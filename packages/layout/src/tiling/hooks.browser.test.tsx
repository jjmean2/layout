import { useEffect } from 'react'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { Tiling, createLayout, pane, splitNode, useTilingActions, useTilingLayout } from './index.js'

const renders = { actions: 0, layout: 0 }

/** commit마다 한 번씩 센다 */
function useCommitCounter(key: keyof typeof renders) {
  useEffect(() => {
    renders[key]++
  })
}

function ActionsOnly() {
  useTilingActions()
  useCommitCounter('actions')
  return null
}

function LayoutWatcher() {
  const sizes = useTilingLayout((l) => (l.root?.type === 'split' ? l.root.sizes.join(',') : ''))
  useCommitCounter('layout')
  return <output data-sizes={sizes} />
}

test('useTilingActions does not re-render on layout changes; useTilingLayout selector does', async () => {
  const screen = await render(
    <div style={{ width: 800, height: 400 }}>
      <Tiling.Root defaultLayout={createLayout(splitNode('row', [pane('my pane'), pane('other')]))}>
        <Tiling.Panes>
          {({ id }) => (
            <Tiling.Pane aria-label={id}>
              {id}
              <ActionsOnly />
            </Tiling.Pane>
          )}
        </Tiling.Panes>
        <Tiling.Separators>{(s) => <Tiling.Separator separator={s} data-testid="sep" />}</Tiling.Separators>
        <LayoutWatcher />
      </Tiling.Root>
    </div>,
  )
  const sep = screen.getByTestId('sep')
  await expect.element(sep).toBeInTheDocument()
  const before = { ...renders }
  const el = sep.element() as HTMLElement
  el.focus()
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  await expect.poll(() => screen.container.querySelector('output')?.getAttribute('data-sizes')).not.toBe('0.5,0.5')
  expect(renders.actions).toBe(before.actions)
  expect(renders.layout).toBeGreaterThan(before.layout)
})

test('pane ids with spaces still produce valid aria-controls / aria-labelledby references', async () => {
  const screen = await render(
    <div style={{ width: 800, height: 400 }}>
      <Tiling.Root defaultLayout={createLayout(splitNode('row', [pane('my pane'), pane('other')]))}>
        <Tiling.Panes>{({ id }) => <Tiling.Pane aria-label={id}>{id}</Tiling.Pane>}</Tiling.Panes>
        <Tiling.Separators>{(s) => <Tiling.Separator separator={s} data-testid="sep" />}</Tiling.Separators>
      </Tiling.Root>
    </div>,
  )
  const sep = screen.getByTestId('sep')
  await expect.element(sep).toBeInTheDocument()
  const controls = sep.element().getAttribute('aria-controls')!
  expect(controls).not.toMatch(/\s/)
  const target = document.getElementById(controls)
  expect(target?.getAttribute('aria-label')).toBe('my pane')
  expect(sep.element().getAttribute('aria-labelledby')).toBe(controls)
})
