import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { SidePanels, useSidePanels, type SidePanelsLayout } from './index.js'

const initial: SidePanelsLayout = { left: { size: 200, collapsed: false }, right: { size: 200, collapsed: false } }

function Both() {
  const api = useSidePanels()
  return (
    <>
      <button
        onClick={() => {
          api.toggle('left')
          api.toggle('right')
        }}
      >
        both
      </button>
      <output>{JSON.stringify(api.layout)}</output>
    </>
  )
}

const collapsedBoth = JSON.stringify({ left: { size: 200, collapsed: true }, right: { size: 200, collapsed: true } })

test('uncontrolled: two actions in one handler both apply', async () => {
  const screen = await render(
    <SidePanels.Root defaultLayout={initial}>
      <SidePanels.Main>
        <Both />
      </SidePanels.Main>
    </SidePanels.Root>,
  )
  await screen.getByRole('button', { name: 'both' }).click()
  await expect.element(screen.getByRole('status')).toHaveTextContent(collapsedBoth)
})

test('controlled: two actions in one handler both apply, details are passed', async () => {
  const onChange = vi.fn()
  function Controlled() {
    const [layout, setLayout] = useState(initial)
    return (
      <SidePanels.Root
        layout={layout}
        onLayoutChange={(next, details) => {
          onChange(details)
          setLayout(next)
        }}
      >
        <SidePanels.Main>
          <Both />
        </SidePanels.Main>
      </SidePanels.Root>
    )
  }
  const screen = await render(<Controlled />)
  await screen.getByRole('button', { name: 'both' }).click()
  await expect.element(screen.getByRole('status')).toHaveTextContent(collapsedBoth)
  expect(onChange.mock.calls.map((c) => c[0])).toEqual([
    { reason: 'action', source: 'left' },
    { reason: 'action', source: 'right' },
  ])
})

test('controlled: a parent that ignores changes keeps its value', async () => {
  const screen = await render(
    <SidePanels.Root layout={initial} onLayoutChange={() => {}}>
      <SidePanels.Main>
        <Both />
      </SidePanels.Main>
    </SidePanels.Root>,
  )
  await screen.getByRole('button', { name: 'both' }).click()
  await expect.element(screen.getByRole('status')).toHaveTextContent(JSON.stringify(initial))
})
