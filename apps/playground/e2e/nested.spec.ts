import { center, drag, expect, test } from './fixtures'

test.describe('Nesting', () => {
  test('dragging a grid item inside a floating pane moves only the grid item', async ({ page }) => {
    await page.goto('/nested')
    await page.getByTestId('float-dash').dispatchEvent('click')
    await expect(page.getByTestId('pane-dash')).toHaveAttribute('data-placement', 'floating')
    const paneBefore = await page.getByTestId('pane-dash').boundingBox()
    const side0 = await page.getByTestId('side-json').textContent()
    const layout0 = await page.getByTestId('layout-json').textContent()
    const grid0 = await page.getByTestId('d-grid-json').textContent()

    const handle = await center(page, '[data-testid=d-move-todo]')
    const clock = (await page.getByTestId('d-item-clock').boundingBox())!
    await drag(page, handle, { x: clock.x + 10, y: clock.y + 5 }, 12)

    expect(await page.getByTestId('d-grid-json').textContent()).not.toBe(grid0)
    expect(await page.getByTestId('pane-dash').boundingBox()).toEqual(paneBefore)
    expect(await page.getByTestId('layout-json').textContent()).toBe(layout0)
    expect(await page.getByTestId('side-json').textContent()).toBe(side0)
  })

  test('tiling separator drag does not change the side panel', async ({ page }) => {
    await page.goto('/nested')
    const side0 = await page.getByTestId('side-json').textContent()
    const sep = await center(page, '[data-testid="sep-:0"]')
    await drag(page, sep, { x: sep.x - 120, y: sep.y })
    expect(await page.getByTestId('side-json').textContent()).toBe(side0)
    expect(await page.getByTestId('layout-json').textContent()).not.toContain('"sizes":[0.7,0.3]')
  })

  test('grid inside a pane re-measures when the side panel resizes', async ({ page }) => {
    await page.goto('/nested')
    const w0 = (await page.getByTestId('d-item-clock').boundingBox())!.width
    const sash = await center(page, '.sash')
    await drag(page, sash, { x: sash.x + 150, y: sash.y })
    await expect.poll(async () => (await page.getByTestId('d-item-clock').boundingBox())!.width).toBeLessThan(w0)
  })
})
