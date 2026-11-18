import { center, drag, expect, renders, settledRenders, test } from './fixtures'
import type { Page } from '@playwright/test'

const items = async (page: Page) =>
  JSON.parse((await page.getByTestId('grid-json').textContent())!) as Array<{
    id: string
    x: number
    y: number
    w: number
    h: number
  }>
const item = async (page: Page, id: string) => (await items(page)).find((i) => i.id === id)!

/** 아이템은 측정(hydration 후 layout effect) 전까지 숨겨져 있다. 보이면 이벤트 핸들러도 붙어 있다. */
const gotoGrid = async (page: Page) => {
  await page.goto('/grid')
  await expect(page.getByTestId('item-clock')).toBeVisible()
}

test.describe('Grid', () => {
  test('server HTML contains items but hides them until measured', async ({ request, page }) => {
    const html = await (await request.get('/grid')).text()
    expect(html).toContain('data-grid-item="clock"')
    expect(html).toMatch(/visibility:hidden/)
    await page.goto('/grid')
    await expect(page.getByTestId('item-clock')).toBeVisible()
  })

  test('cells are square and sized from the container width', async ({ page }) => {
    await page.goto('/grid')
    const grid = page.getByTestId('grid')
    const clientWidth = await grid.evaluate((el) => el.clientWidth)
    const cell = (clientWidth - 12 * 7) / 8
    const box = (await page.getByTestId('item-clock').boundingBox())!
    expect(box.width).toBeCloseTo(cell * 2 + 12, 0)
    expect(box.height).toBeCloseTo(cell * 2 + 12, 0)
  })

  test('drag moves an item, pushes others, shows placeholder, commits once', async ({ page }) => {
    await page.goto('/grid')
    const r0 = await settledRenders(page, 'widget-notes')
    const handle = await center(page, '[data-testid=move-todo]')
    const clock = (await page.getByTestId('item-clock').boundingBox())!
    await page.mouse.move(handle.x, handle.y)
    await page.mouse.down()
    await page.mouse.move(clock.x + 20, clock.y + 10, { steps: 12 })
    await expect(page.getByTestId('placeholder')).toBeVisible()
    await expect(page.getByTestId('item-todo')).toHaveAttribute('data-dragging', '')
    expect(await renders(page, 'widget-notes')).toBe(r0)
    await page.mouse.up()
    await expect(page.getByTestId('placeholder')).toHaveCount(0)
    expect(await item(page, 'todo')).toMatchObject({ x: 0, y: 0 })
    expect((await item(page, 'clock')).y).toBeGreaterThanOrEqual(2)
    // static 아이템은 그대로다
    expect(await item(page, 'pinned')).toMatchObject({ x: 6, y: 0 })
  })

  test('resize snaps to allowed sizes', async ({ page }) => {
    await gotoGrid(page)
    const grip = await center(page, '[data-testid=resize-clock]')
    const box = (await page.getByTestId('item-clock').boundingBox())!
    await drag(page, grip, { x: grip.x + box.width * 0.9, y: grip.y }, 10)
    await expect.poll(() => item(page, 'clock')).toMatchObject({ w: 4, h: 2 })
  })

  test('keyboard moves and resizes one step', async ({ page }) => {
    await gotoGrid(page)
    await page.getByTestId('move-notes').focus()
    await page.keyboard.press('ArrowDown')
    await expect.poll(() => item(page, 'notes')).toMatchObject({ x: 0, y: 3 })
    await page.getByTestId('resize-clock').focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => item(page, 'clock')).toMatchObject({ w: 4, h: 2 })
  })

  test('container resize updates cells via CSS only, flags data-resizing, no React renders', async ({ page }) => {
    await page.goto('/grid')
    const r0 = await settledRenders(page, 'widget-clock')
    const w0 = (await page.getByTestId('item-clock').boundingBox())!.width
    await page.setViewportSize({ width: 900, height: 800 })
    await expect(page.getByTestId('grid')).toHaveAttribute('data-resizing', '')
    await expect.poll(async () => (await page.getByTestId('item-clock').boundingBox())!.width).toBeLessThan(w0)
    await expect(page.getByTestId('grid')).not.toHaveAttribute('data-resizing', '')
    expect(await renders(page, 'widget-clock')).toBe(r0)
  })

  test('square cells in a scrolling container do not oscillate', async ({ page }) => {
    await gotoGrid(page)
    await page.setViewportSize({ width: 1280, height: 300 })
    const grid = page.getByTestId('grid')
    // 측정과 리사이즈가 끝난 뒤부터 샘플링한다. 진동이라면 이후에도 값이 계속 바뀐다.
    await expect.poll(() => grid.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    await expect(grid).not.toHaveAttribute('data-resizing', '')
    const samples: string[] = []
    for (let i = 0; i < 10; i++) {
      samples.push(await grid.evaluate((el) => getComputedStyle(el).getPropertyValue('--grid-cell-w')))
      await page.waitForTimeout(30)
    }
    expect(new Set(samples).size).toBe(1)
    expect(await grid.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
  })
})
