import { center, drag, expect, renders, settledRenders, test } from './fixtures'

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
    const before = await settledRenders(page, 'main-content')
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

  test('resize respects min/max; dragging below half the min size collapses, dragging out expands', async ({
    page,
  }) => {
    await page.goto('/side-panels')
    const left = page.getByTestId('left')
    const handle = await center(page, '[data-testid=left-handle]')
    // 260 -> 120 (최소 180보다 작지만 절반 90보다 큼): 최소 너비로 고정
    await drag(page, handle, { x: handle.x - 140, y: handle.y })
    await expect(page.getByTestId('layout-json')).toContainText('"left":{"size":180,"collapsed":false}')
    const h2 = await center(page, '[data-testid=left-handle]')
    await drag(page, h2, { x: h2.x + 900, y: h2.y })
    await expect(page.getByTestId('layout-json')).toContainText('"size":480')
    // 끝까지 좁히면 접힌다
    const h3 = await center(page, '[data-testid=left-handle]')
    await drag(page, h3, { x: 5, y: h3.y })
    await expect(left).toHaveAttribute('data-state', 'collapsed')
    // 접힌 Separator를 끌어 내면 펼쳐진다
    const h4 = await center(page, '[data-testid=left-handle]')
    await drag(page, h4, { x: h4.x + 250, y: h4.y })
    await expect(left).toHaveAttribute('data-state', 'expanded')
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
    await expect(handle).toHaveAttribute('aria-valuemax', '480')
    await expect(handle).toHaveAttribute('aria-valuetext', '480px')
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
    // hover로 다시 열고, 포커스가 다른 곳에 있어도 Esc로 닫힌다
    await page.mouse.move(trigger.x, trigger.y)
    await expect(left).toHaveAttribute('data-state', 'overlay')
    await page.mouse.move(trigger.x + 100, trigger.y, { steps: 3 })
    await page.keyboard.press('Escape')
    await expect(left).toHaveAttribute('data-state', 'collapsed')
  })

  test('uncontrolled Root (Server Component page) keeps the dragged size', async ({ page }) => {
    await page.goto('/rsc')
    const aside = page.locator('aside')
    const handle = await center(page, '.sash')
    await drag(page, handle, { x: handle.x + 60, y: handle.y })
    await expect.poll(async () => Math.round((await aside.boundingBox())!.width)).toBe(280)
    await page.waitForTimeout(200)
    expect(Math.round((await aside.boundingBox())!.width)).toBe(280)
  })

  test('Separator keeps focus when Enter collapses its panel, and Enter expands it again', async ({ page }) => {
    await page.goto('/side-panels')
    const handle = page.getByTestId('left-handle')
    const left = page.getByTestId('left')
    await handle.focus()
    await page.keyboard.press('Enter')
    await expect(left).toHaveAttribute('data-state', 'collapsed')
    await expect(handle).toBeFocused()
    await expect(handle).toHaveAttribute('aria-valuenow', '0')
    await page.keyboard.press('Enter')
    await expect(left).toHaveAttribute('data-state', 'expanded')
    await expect(handle).toBeFocused()
  })

  test('HoverTrigger is a button outside the tab order; clicking toggles the overlay', async ({ page }) => {
    await page.goto('/side-panels')
    await page.getByTestId('toggle-left').click()
    const trigger = page.getByTestId('left-trigger')
    await expect(trigger).toHaveAttribute('type', 'button')
    await expect(trigger).toHaveAttribute('tabindex', '-1')
    await trigger.dispatchEvent('click')
    const left = page.getByTestId('left')
    await expect(left).toHaveAttribute('data-state', 'overlay')
    await trigger.dispatchEvent('click')
    await expect(left).toHaveAttribute('data-state', 'collapsed')
  })

  test('Escape closes the overlay unless another layer already handled it', async ({ page }) => {
    await page.goto('/side-panels')
    await page.getByTestId('toggle-left').click()
    const trigger = page.getByTestId('left-trigger')
    const left = page.getByTestId('left')
    // 다른 라이브러리의 dialog처럼 capture 단계에서 Escape를 처리하는 레이어
    await page.evaluate(() => {
      ;(window as unknown as { __foreign: (e: KeyboardEvent) => void }).__foreign = (e: KeyboardEvent) => {
        if (e.key === 'Escape') e.preventDefault()
      }
      document.addEventListener('keydown', (window as unknown as { __foreign: EventListener }).__foreign, true)
    })
    await trigger.dispatchEvent('click')
    await expect(left).toHaveAttribute('data-state', 'overlay')
    await page.keyboard.press('Escape')
    await expect(left).toHaveAttribute('data-state', 'overlay')
    await page.evaluate(() =>
      document.removeEventListener('keydown', (window as unknown as { __foreign: EventListener }).__foreign, true),
    )
    await page.keyboard.press('Escape')
    await expect(left).toHaveAttribute('data-state', 'collapsed')
  })

  test('hoverOverlay={false} renders no trigger', async ({ page }) => {
    await page.goto('/side-panels')
    await expect(page.getByTestId('right')).toHaveAttribute('data-state', 'collapsed')
    await expect(page.getByTestId('right-trigger')).toHaveCount(0)
  })
})
