import AxeBuilder from '@axe-core/playwright'
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
      if (m.type() === 'error' || m.text().includes('[@justwonder/layout]')) errors.push(m.text())
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
    if (entry.type === 'story') {
      const result = await new AxeBuilder({ page })
        .include('#storybook-root')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      // aria-prohibited-attr(역할 없는 요소의 이름)는 axe가 incomplete로 분류하므로 함께 본다
      const findings = [...result.violations, ...result.incomplete.filter((r) => r.id === 'aria-prohibited-attr')]
      const violations = findings.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
      expect(violations, 'axe WCAG 2.2 AA').toEqual([])
    }
  })
}
