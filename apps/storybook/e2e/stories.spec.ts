import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

interface Entry {
  id: string
  type: 'story' | 'docs'
}
const index = JSON.parse(readFileSync(new URL('../storybook-static/index.json', import.meta.url), 'utf8')) as {
  entries: Record<string, Entry>
}
const entries = Object.values(index.entries)

test('index has stories', () => {
  expect(entries.filter((e) => e.type === 'story').length).toBeGreaterThan(5)
})

for (const entry of entries) {
  test(`${entry.type} ${entry.id} renders without errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`/iframe.html?id=${entry.id}&viewMode=${entry.type === 'docs' ? 'docs' : 'story'}`)
    const root = page.locator(entry.type === 'docs' ? '#storybook-docs' : '#storybook-root')
    await expect(root).not.toBeEmpty()
    if (entry.type === 'story') {
      // 레이아웃이 실제 크기로 그려졌는지 확인한다
      const box = await page.locator('#storybook-root > *').first().boundingBox()
      expect(box?.height ?? 0).toBeGreaterThan(200)
    }
    await page.waitForTimeout(200)
    expect(errors).toEqual([])
  })
}
