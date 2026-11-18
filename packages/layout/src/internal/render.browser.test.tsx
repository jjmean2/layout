import { createElement, type ReactElement } from 'react'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { SidePanels } from '../side-panels/index.js'

const box = (children: ReactElement) => <div style={{ width: 800, height: 300 }}>{children}</div>

test('render accepts a function that receives props and part state', async () => {
  const screen = await render(
    box(
      <SidePanels.Root defaultLayout={{ left: { size: 200, collapsed: false } }}>
        <SidePanels.Panel
          side="left"
          render={(props, state) => (
            <aside {...props} data-testid="panel">
              {String(state.state)}
            </aside>
          )}
        />
        <SidePanels.Main>main</SidePanels.Main>
      </SidePanels.Root>,
    ),
  )
  const panel = screen.getByTestId('panel')
  await expect.element(panel).toHaveTextContent('expanded')
  expect(panel.element().tagName).toBe('ASIDE')
  expect(panel.element().getBoundingClientRect().width).toBe(200)
})

test('className and style accept state functions; layout style keys stay with the library', async () => {
  const screen = await render(
    box(
      <SidePanels.Root defaultLayout={{ left: { size: 200, collapsed: true } }}>
        <SidePanels.Panel
          side="left"
          data-testid="panel"
          className={(state) => `panel is-${String(state.state)}`}
          style={() => ({ width: 999, background: 'rgb(1, 2, 3)', cursor: 'pointer' })}
        />
        <SidePanels.Main>main</SidePanels.Main>
      </SidePanels.Root>,
    ),
  )
  const el = screen.getByTestId('panel').element() as HTMLElement
  expect(el.className).toBe('panel is-collapsed')
  expect(el.style.background).toBe('rgb(1, 2, 3)')
  expect(el.style.cursor).toBe('pointer')
  // width는 배치 키라 라이브러리 값(접힘 = 0)이 이긴다
  expect(el.getBoundingClientRect().width).toBe(0)
})

test('a lazy wrapper (as sent by Server Components in dev) is unwrapped via public APIs', async () => {
  const element = createElement('aside', { 'data-testid': 'lazy-panel' })
  // React Flight가 dev에서 넘기는 lazy 래퍼와 같은 모양
  const lazy = { $$typeof: Symbol.for('react.lazy'), _payload: element, _init: (payload: unknown) => payload }
  const screen = await render(
    box(
      <SidePanels.Root defaultLayout={{ left: { size: 200, collapsed: false } }}>
        <SidePanels.Panel side="left" render={lazy as unknown as ReactElement<Record<string, unknown>>} />
        <SidePanels.Main>main</SidePanels.Main>
      </SidePanels.Root>,
    ),
  )
  const el = screen.getByTestId('lazy-panel').element()
  expect(el.tagName).toBe('ASIDE')
  expect(el.getAttribute('data-state')).toBe('expanded')
})

test('Grid.Root accepts a style function and keeps its layout keys', async () => {
  const { Grid } = await import('../grid/index.js')
  const screen = await render(
    <div style={{ width: 600, height: 300 }}>
      <Grid.Root
        data-testid="grid"
        cols={4}
        defaultLayout={[]}
        style={(state) => ({ background: state.dragging ? 'red' : 'rgb(4, 5, 6)', overflow: 'hidden' })}
      />
    </div>,
  )
  const el = screen.getByTestId('grid').element() as HTMLElement
  expect(el.style.background).toBe('rgb(4, 5, 6)')
  // overflow는 Grid의 배치(스크롤 영역) 키라 라이브러리 값이 이긴다
  expect(el.style.overflow).toBe('auto')
})
