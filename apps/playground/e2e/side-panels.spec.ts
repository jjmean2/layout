import { center, drag, expect, renders, test } from './fixtures'

test.describe('SidePanels', () => {
  test('Server Component page renders with dot-notation parts', async ({ page }) => {
    await page.goto('/rsc')
    await expect(page.getByTestId('rsc-left')).toBeVisible()
    const box = await page.locator('aside').boundingBox()
    expect(Math.round(box!.width)).toBe(220)
  })

  test('resize by pointer commits once and does not re-render main content', async ({ page }) => {
    await page.goto('/side-panels')
    const left = page.getByTestId('left')
    await expect(left).toHaveAttribute('data-state', 'expanded')
    const before = await renders(page, 'main-content')
    const handle = await center(page, '[data-testid=left-handle]')
    await page.mouse.move(handle.x, handle.y)
    await page.mouse.down()
    await page.mouse.move(handle.x + 80, handle.y, { steps: 12 })
    // 드래그 중: 화면은 바뀌지만 부모 state(onLayoutChange)와 Main 내용은 그대로다
    await expect.poll(async () => Math.round((await left.boundingBox())!.width)).toBe(340)
    await expect(left).toHaveAttribute('data-dragging', '')
    await expect(page.getByTestId('layout-json')).toContainText('"size":260')
    expect(await renders(page, 'main-content')).toBe(before)
    await page.mouse.up()
    await expect(page.getByTestId('layout-json')).toContainText('"size":340')
    // 확정 시 controlled 부모가 한 번 리렌더된다 (문서 3.4의 4번)
    expect(await renders(page, 'main-content')).toBe(before + 1)
  })

  test('resize respects min/max and main minSize', async ({ page }) => {
    await page.goto('/side-panels')
    const handle = await center(page, '[data-testid=left-handle]')
    await drag(page, handle, { x: handle.x - 400, y: handle.y })
    await expect(page.getByTestId('layout-json')).toContainText('"size":180')
    const h2 = await center(page, '[data-testid=left-handle]')
    await drag(page, h2, { x: h2.x + 900, y: h2.y })
    await expect(page.getByTestId('layout-json')).toContainText('"size":480')
  })

  test('keyboard: arrows, Home/End, Enter toggles collapse', async ({ page }) => {
    await page.goto('/side-panels')
    const handle = page.getByTestId('left-handle')
    await handle.focus()
    await expect(handle).toHaveAttribute('role', 'separator')
    await expect(handle).toHaveAttribute('aria-valuenow', '260')
    await page.keyboard.press('ArrowRight')
    await expect(handle).toHaveAttribute('aria-valuenow', '270')
    await page.keyboard.press('Shift+ArrowLeft')
    await expect(handle).toHaveAttribute('aria-valuenow', '220')
    await page.keyboard.press('Home')
    await expect(handle).toHaveAttribute('aria-valuenow', '180')
    await page.keyboard.press('End')
    await expect(handle).toHaveAttribute('aria-valuenow', '480')
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('left')).toHaveAttribute('data-state', 'collapsed')
  })

  test('controlled toggle from GNB outside Root; collapsed panel is inert', async ({ page }) => {
    await page.goto('/side-panels')
    await page.getByTestId('toggle-left').click()
    const left = page.getByTestId('left')
    await expect(left).toHaveAttribute('data-state', 'collapsed')
    expect((await left.boundingBox())?.width ?? 0).toBe(0)
    await expect(left).toHaveAttribute('inert', '')
    await page.getByTestId('toggle-left').click()
    await expect(left).toHaveAttribute('data-state', 'expanded')
  })

  test('hover overlay opens without reflowing main and closes on leave / Esc', async ({ page }) => {
    await page.goto('/side-panels')
    await page.getByTestId('toggle-left').click()
    const main = page.locator('[data-main]')
    const mainBefore = await main.boundingBox()
    const trigger = await center(page, '[data-testid=left-trigger]')
    await page.mouse.move(trigger.x, trigger.y)
    const left = page.getByTestId('left')
    await expect(left).toHaveAttribute('data-state', 'overlay')
    expect(await main.boundingBox()).toEqual(mainBefore)
    // 패널 위로 옮겨도 닫히지 않는다
    await page.mouse.move(trigger.x + 100, trigger.y, { steps: 5 })
    await page.waitForTimeout(400)
    await expect(left).toHaveAttribute('data-state', 'overlay')
    // 벗어나면 닫힌다
    await page.mouse.move(900, 400)
    await expect(left).toHaveAttribute('data-state', 'collapsed')
  })

  test('hover overlay by keyboard: Enter opens and focuses panel, Esc closes and returns focus', async ({ page }) => {
    await page.goto('/side-panels')
    await page.getByTestId('toggle-left').click()
    const trigger = page.getByTestId('left-trigger')
    await trigger.focus()
    await page.keyboard.press('Enter')
    const left = page.getByTestId('left')
    await expect(left).toHaveAttribute('data-state', 'overlay')
    await expect(left).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(left).toHaveAttribute('data-state', 'collapsed')
    await expect(trigger).toBeFocused()
  })

  test('hoverOverlay={false} renders no trigger', async ({ page }) => {
    await page.goto('/side-panels')
    await expect(page.getByTestId('right')).toHaveAttribute('data-state', 'collapsed')
    await expect(page.getByTestId('right-trigger')).toHaveCount(0)
  })
})
