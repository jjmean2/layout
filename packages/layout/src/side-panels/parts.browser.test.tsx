import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { SidePanels } from './index.js'

test('Root renders panels with state attributes', async () => {
  const screen = await render(
    <div style={{ width: 800, height: 400 }}>
      <SidePanels.Root defaultLayout={{ left: { size: 200, collapsed: false } }}>
        <SidePanels.Panel side="left" data-testid="left">
          nav
        </SidePanels.Panel>
        <SidePanels.Main>main</SidePanels.Main>
      </SidePanels.Root>
    </div>,
  )
  const left = screen.getByTestId('left')
  await expect.element(left).toHaveAttribute('data-state', 'expanded')
  expect(left.element().getBoundingClientRect().width).toBe(200)
})
