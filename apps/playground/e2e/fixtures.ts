import { test as base, expect, type Page } from '@playwright/test'

/** 콘솔 오류, hydration 경고, 페이지 예외를 모아 테스트 끝에 0건인지 확인한다. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (msg) => {
        const text = msg.text()
        if (msg.type() === 'error' || /hydrat/i.test(text)) errors.push(`[${msg.type()}] ${text}`)
      })
      page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`))
      await use(errors)
      expect(errors, 'console errors / hydration warnings').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export async function renders(page: Page, id: string): Promise<number> {
  return page.evaluate((key) => window.__renders?.[key] ?? 0, id)
}

export async function instances(page: Page, id: string): Promise<string[]> {
  return page.evaluate((key) => window.__instances?.[key] ?? [], id)
}

export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps })
  await page.mouse.up()
}

export async function center(page: Page, selector: string) {
  const box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`no box for ${selector}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }
}
