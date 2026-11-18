import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' || /hydrat/i.test(m.text()) || m.text().includes('[@justwonder/layout]'))
      errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

for (const route of ['/', '/workspace', '/dashboard', '/mail']) {
  test(`${route} renders without console errors`, async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto(route)
    await expect(page.locator('main, [data-main]').first()).toBeVisible()
    await page.waitForTimeout(300)
    expect(errors).toEqual([])
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    // aria-prohibited-attr(역할 없는 요소의 이름)는 axe가 incomplete로 분류하므로 함께 본다
    const findings = [...result.violations, ...result.incomplete.filter((r) => r.id === 'aria-prohibited-attr')]
    expect(
      findings.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      'axe WCAG 2.2 AA',
    ).toEqual([])
  })
}

test('shell persists across client navigation (layout.tsx)', async ({ page }) => {
  await page.goto('/')
  const nav = page.locator('nav[aria-label="예제"]')
  const handle = page.getByLabel('탐색 패널 너비')
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + 100)
  await page.mouse.down()
  await page.mouse.move(box.x + 60, box.y + 100, { steps: 6 })
  await page.mouse.up()
  const width = (await nav.boundingBox())!.width
  await page.getByRole('link', { name: '대시보드 (Grid)' }).click()
  await expect(page).toHaveURL(/dashboard/)
  expect((await nav.boundingBox())!.width).toBe(width)
})

test('workspace: floating window crosses the side panel but not the GNB', async ({ page }) => {
  await page.goto('/workspace')
  const pane = page.getByRole('region', { name: '주문 상세' }).or(page.locator('[data-pane-id="detail"]'))
  await page.locator('[data-pane-id="detail"] [title="창으로 띄우기"]').click()
  await expect(page.locator('[data-pane-id="detail"]')).toHaveAttribute('data-placement', 'floating')
  const handle = (await page.getByLabel('주문 상세 창 이동').boundingBox())!
  await page.mouse.move(handle.x + 40, handle.y + 10)
  await page.mouse.down()
  await page.mouse.move(60, 0, { steps: 10 })
  await page.mouse.up()
  const box = (await pane.first().boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(52)
  expect(box.x).toBeLessThan(232)
})

test('mail: nested SidePanels resize does not change the shell', async ({ page }) => {
  await page.goto('/mail')
  const nav = page.locator('nav[aria-label="예제"]')
  const outer = (await nav.boundingBox())!.width
  const list = page.getByTestId('mail-list')
  const before = (await list.boundingBox())!.width
  const handle = (await page.getByTestId('mail-handle').boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 200)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 80, handle.y + 200, { steps: 6 })
  await page.mouse.up()
  expect(Math.round((await list.boundingBox())!.width - before)).toBe(80)
  expect((await nav.boundingBox())!.width).toBe(outer)
})
