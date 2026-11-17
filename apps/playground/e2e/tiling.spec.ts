import { center, drag, expect, instances, renders, settledRenders, test } from './fixtures'
import type { Page } from '@playwright/test'

const paneBox = async (page: Page, id: string) => (await page.getByTestId(`pane-${id}`).boundingBox())!
const inLayer = (page: Page, id: string) =>
  page.getByTestId(`pane-${id}`).evaluate((el) => !!el.closest('[data-layout-floating-layer]'))

async function markIframe(page: Page, id: string) {
  await page.getByTestId(`iframe-${id}`).evaluate((f: HTMLIFrameElement) => {
    ;(f.contentWindow as unknown as { __marker?: number }).__marker = 42
  })
}
const iframeMarker = (page: Page, id: string) =>
  page
    .getByTestId(`iframe-${id}`)
    .evaluate((f: HTMLIFrameElement) => (f.contentWindow as unknown as { __marker?: number })?.__marker ?? null)

test.describe('Tiling', () => {
  test('server HTML has the frame but no pane content', async ({ request, page }) => {
    const html = await (await request.get('/tiling')).text()
    expect(html).toContain('data-tiling-panes')
    expect(html).not.toContain('data-testid="pane-editor"')
    await page.goto('/tiling')
    await expect(page.getByTestId('pane-editor')).toBeVisible()
  })

  test('split, hide, show keep pane state and never remount', async ({ page }) => {
    await page.goto('/tiling')
    await page.getByTestId('input-editor').fill('hello')
    await page.getByTestId('scroll-list').evaluate((el) => (el.scrollTop = 300))
    await markIframe(page, 'frame')
    const editorInstances = await instances(page, 'pane-editor')
    expect(editorInstances).toHaveLength(1)

    await page.getByTestId('split-editor').dispatchEvent('click')
    await expect(page.locator('[data-pane-id^="editor-"]')).toHaveCount(1)
    await page.getByTestId('hide-list').dispatchEvent('click')
    await expect(page.getByTestId('pane-list')).toBeHidden()
    await page.getByTestId('show-list').dispatchEvent('click')
    await expect(page.getByTestId('pane-list')).toBeVisible()

    await expect(page.getByTestId('input-editor')).toHaveValue('hello')
    expect(await page.getByTestId('scroll-list').evaluate((el) => el.scrollTop)).toBe(300)
    expect(await iframeMarker(page, 'frame')).toBe(42)
    expect(await instances(page, 'pane-editor')).toEqual(editorInstances)
    expect(await instances(page, 'pane-list')).toHaveLength(1)
  })

  test('separator drag resizes without re-rendering pane content; keyboard works', async ({ page }) => {
    await page.goto('/tiling')
    const before = await paneBox(page, 'editor')
    const r0 = await settledRenders(page, 'pane-editor')
    const sep = await center(page, '[data-testid="sep-:0"]')
    await page.mouse.move(sep.x, sep.y)
    await page.mouse.down()
    await page.mouse.move(sep.x - 100, sep.y, { steps: 10 })
    await expect.poll(async () => Math.round((await paneBox(page, 'editor')).width)).toBe(Math.round(before.width - 100))
    expect(await renders(page, 'pane-editor')).toBe(r0)
    await page.mouse.up()

    const handle = page.getByTestId('sep-:0')
    await handle.focus()
    await expect(handle).toHaveAttribute('role', 'separator')
    await expect(handle).toHaveAttribute('aria-orientation', 'vertical')
    const w1 = (await paneBox(page, 'editor')).width
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => Math.round((await paneBox(page, 'editor')).width)).toBe(Math.round(w1 + 10))
    await page.keyboard.press('Home')
    await expect.poll(async () => Math.round((await paneBox(page, 'editor')).width)).toBe(48)
  })

  test('float moves the pane to the floating layer, preserving state (moveBefore path)', async ({ page }) => {
    await page.goto('/tiling')
    const supported = await page.evaluate(() => typeof Element.prototype.moveBefore === 'function')
    test.skip(!supported, 'moveBefore 미지원 브라우저 (fallback 경로는 다음 테스트가 확인한다)')
    await page.getByTestId('input-frame').count() // frame pane has iframe, no input
    await markIframe(page, 'frame')
    await page.getByTestId('input-editor').fill('typed')
    const before = await instances(page, 'pane-editor')

    await page.getByTestId('float-frame').dispatchEvent('click')
    await expect(page.getByTestId('pane-frame')).toHaveAttribute('data-placement', 'floating')
    expect(await inLayer(page, 'frame')).toBe(true)
    expect(await iframeMarker(page, 'frame')).toBe(42)
    await expect(page.getByTestId('pane-frame')).toBeFocused()

    await page.getByTestId('float-editor').dispatchEvent('click')
    expect(await inLayer(page, 'editor')).toBe(true)
    await expect(page.getByTestId('input-editor')).toHaveValue('typed')
    expect(await instances(page, 'pane-editor')).toEqual(before)

    await page.getByTestId('dock-editor').dispatchEvent('click')
    await expect(page.getByTestId('pane-editor')).toHaveAttribute('data-placement', 'tiled')
    expect(await inLayer(page, 'editor')).toBe(false)
    await expect(page.getByTestId('input-editor')).toHaveValue('typed')
    expect(await instances(page, 'pane-editor')).toEqual(before)
  })

  test('fallback without moveBefore: React state, focus and scroll survive; iframe reloads', async ({ page }) => {
    await page.addInitScript(() => {
      delete (Element.prototype as { moveBefore?: unknown }).moveBefore
    })
    await page.goto('/tiling')
    expect(await page.evaluate(() => 'moveBefore' in Element.prototype)).toBe(false)
    await page.getByTestId('scroll-list').evaluate((el) => (el.scrollTop = 500))
    await markIframe(page, 'frame')
    await page.getByTestId('input-editor').fill('typed')
    const before = await instances(page, 'pane-editor')

    await page.getByTestId('float-list').dispatchEvent('click')
    expect(await inLayer(page, 'list')).toBe(true)
    expect(await page.getByTestId('scroll-list').evaluate((el) => el.scrollTop)).toBe(500)

    await page.getByTestId('input-editor').focus()
    await page.getByTestId('float-editor').dispatchEvent('click')
    expect(await inLayer(page, 'editor')).toBe(true)
    await expect(page.getByTestId('input-editor')).toHaveValue('typed')
    expect(await instances(page, 'pane-editor')).toEqual(before)

    await page.getByTestId('float-frame').dispatchEvent('click')
    expect(await inLayer(page, 'frame')).toBe(true)
    // 문서 5.3: fallback 경로에서는 iframe이 재로드된다
    await expect.poll(() => iframeMarker(page, 'frame')).toBe(null)
  })

  test('floating window moves over side panels but stays below the GNB (bounds = SidePanels Root)', async ({ page }) => {
    await page.goto('/tiling')
    await page.getByTestId('float-editor').dispatchEvent('click')
    const handle = await center(page, '[data-testid=move-editor]')
    await drag(page, handle, { x: 1100, y: 5 }, 15)
    const box = await paneBox(page, 'editor')
    const workspace = (await page.getByTestId('workspace').boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(workspace.y - 0.5)
    // 오른쪽 사이드 패널 위에 있다
    const right = (await page.getByTestId('right-panel').boundingBox())!
    expect(box.x + box.width).toBeGreaterThan(right.x)
    const topEl = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.closest('[data-pane-id]')?.getAttribute('data-pane-id'),
      [Math.max(right.x, box.x) + 10, box.y + 40],
    )
    expect(topEl).toBe('editor')
  })

  test('floating window resize handle and keyboard move', async ({ page }) => {
    await page.goto('/tiling')
    await page.getByTestId('float-editor').dispatchEvent('click')
    const before = await paneBox(page, 'editor')
    const grip = await center(page, '[data-testid=resize-editor]')
    await drag(page, grip, { x: grip.x + 60, y: grip.y + 40 })
    const after = await paneBox(page, 'editor')
    expect(Math.round(after.width - before.width)).toBe(60)
    expect(Math.round(after.height - before.height)).toBe(40)

    await page.getByTestId('move-editor').focus()
    await page.keyboard.press('ArrowRight')
    expect(Math.round((await paneBox(page, 'editor')).x - after.x)).toBe(10)
  })

  test('a body-portaled popup with z-index above the layer shows over the floating window', async ({ page }) => {
    await page.goto('/tiling')
    await page.getByTestId('float-editor').dispatchEvent('click')
    const handle = await center(page, '[data-testid=move-editor]')
    await drag(page, handle, { x: 300, y: 60 }, 10)
    await page.getByTestId('popup-open-editor').click()
    const hit = await page.evaluate(() => document.elementFromPoint(20, 20)?.closest('[data-testid]')?.getAttribute('data-testid'))
    expect(hit).toBe('popup-editor')
  })

  test('clicking a floating window brings it to front; clicking the front one does not commit', async ({ page }) => {
    await page.goto('/tiling')
    await page.getByTestId('float-editor').dispatchEvent('click')
    await page.getByTestId('float-list').dispatchEvent('click')
    const json = () => page.getByTestId('layout-json').textContent()
    const order = async () => JSON.parse((await json())!).floating.map((f: { id: string }) => f.id)
    expect(await order()).toEqual(['editor', 'list'])
    const r0 = await settledRenders(page, 'pane-list')
    await page.getByTestId('pane-list').click({ position: { x: 40, y: 60 } })
    expect(await order()).toEqual(['editor', 'list'])
    expect(await renders(page, 'pane-list')).toBe(r0)
    // editor 창이 list 창에 가려지지 않는 곳을 누른다
    const handle = await center(page, '[data-testid=move-list]')
    await drag(page, handle, { x: 1100, y: 600 }, 8)
    const editor = await paneBox(page, 'editor')
    await page.mouse.click(editor.x + 20, editor.y + 60)
    expect(await order()).toEqual(['list', 'editor'])
  })
})

test.describe('Tiling showcase (transform + overflow ancestors)', () => {
  test("bounds 'container' keeps the window inside the frame", async ({ page }) => {
    await page.goto('/showcase')
    await page.getByTestId('float-c-a').dispatchEvent('click')
    expect(await inLayer(page, 'c-a')).toBe(false)
    const frame = (await page.getByTestId('frame-container').boundingBox())!
    const handle = await center(page, '[data-testid=move-c-a]')
    await drag(page, handle, { x: handle.x, y: frame.y - 200 }, 10)
    const box = await paneBox(page, 'c-a')
    expect(box.y).toBeGreaterThanOrEqual(frame.y)
  })

  test("bounds 'viewport' escapes a transformed, clipped ancestor", async ({ page }) => {
    await page.goto('/showcase')
    await page.getByTestId('float-v-a').dispatchEvent('click')
    expect(await inLayer(page, 'v-a')).toBe(true)
    const frame = (await page.getByTestId('frame-viewport').boundingBox())!
    const handle = await center(page, '[data-testid=move-v-a]')
    await drag(page, handle, { x: 200, y: 20 }, 15)
    const box = await paneBox(page, 'v-a')
    expect(box.y).toBeLessThan(frame.y)
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.closest('[data-pane-id]')?.getAttribute('data-pane-id'),
      [box.x + 30, box.y + 40],
    )
    expect(hit).toBe('v-a')
  })
})
