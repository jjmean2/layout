import { describe, expect, it } from 'vitest'
import {
  allPaneIds,
  bringToFront,
  close,
  computeTiledGeometry,
  createLayout,
  dock,
  emptyLayout,
  evaluate,
  evaluateRect,
  float,
  hide,
  minExtent,
  moveSeparator,
  neighbor,
  pane,
  placementOf,
  show,
  split,
  splitNode,
  swap,
  toCss,
  validate,
  type TileNode,
  type TilingLayout,
} from './index.js'

const base = () => {
  let l = split(emptyLayout, null, 'a', 'row')
  l = split(l, 'a', 'b', 'row')
  l = split(l, 'b', 'c', 'column')
  return l
}

describe('tiling ops', () => {
  it('split builds a normalized tree', () => {
    const l = base()
    expect(validate(l)).toEqual([])
    expect(l.root).toEqual({
      type: 'split',
      direction: 'row',
      sizes: [0.5, 0.5],
      children: [
        pane('a'),
        { type: 'split', direction: 'column', sizes: [0.5, 0.5], children: [pane('b'), pane('c')] },
      ],
    })
  })

  it('split in the same direction inserts a sibling sharing the target size', () => {
    const l = split(base(), 'a', 'd', 'row')
    expect(validate(l)).toEqual([])
    const root = l.root as Extract<TileNode, { type: 'split' }>
    expect(root.children.map((c) => (c.type === 'pane' ? c.id : 'split'))).toEqual(['a', 'd', 'split'])
    expect(root.sizes).toEqual([0.25, 0.25, 0.5])
  })

  it('duplicate ids throw', () => {
    expect(() => split(base(), 'a', 'b', 'row')).toThrow(/already exists/)
  })

  it('hide then show restores the same tree', () => {
    const l = base()
    const hidden = hide(l, 'c')
    expect(placementOf(hidden, 'c')).toBe('hidden')
    expect(validate(hidden)).toEqual([])
    const shown = show(hidden, 'c')
    expect(shown.root).toEqual(l.root)
  })

  it('float then dock restores the same tree', () => {
    const l = base()
    const floated = float(l, 'b', { x: 10, y: 10, width: 300, height: 200 })
    expect(placementOf(floated, 'b')).toBe('floating')
    expect(validate(floated)).toEqual([])
    expect(dock(floated, 'b').root).toEqual(l.root)
  })

  it('restore falls back to root edge when the anchor is gone', () => {
    let l = hide(base(), 'c')
    l = close(l, 'b')
    l = show(l, 'c')
    expect(validate(l)).toEqual([])
    expect(placementOf(l, 'c')).toBe('tiled')
  })

  it('hide floating keeps its rect and show returns it to floating', () => {
    let l = float(base(), 'b', { x: 1, y: 2, width: 300, height: 200 })
    l = hide(l, 'b')
    expect(l.hidden[0]?.rect).toEqual({ x: 1, y: 2, width: 300, height: 200 })
    l = show(l, 'b')
    expect(placementOf(l, 'b')).toBe('floating')
  })

  it('swap across collections', () => {
    let l = float(base(), 'b', { x: 0, y: 0, width: 100, height: 100 })
    l = swap(l, 'a', 'b')
    expect(placementOf(l, 'a')).toBe('floating')
    expect(placementOf(l, 'b')).toBe('tiled')
    expect(validate(l)).toEqual([])
  })

  it('moveSeparator clamps to min ratios and keeps the pair total', () => {
    const l = base()
    const next = moveSeparator(l, [], 0, [0.5, 0.5], 0.6, [0.1, 0.2])
    const root = next.root as Extract<TileNode, { type: 'split' }>
    expect(root.sizes[0]).toBeCloseTo(0.8)
    expect(root.sizes[1]).toBeCloseTo(0.2)
  })

  it('bringToFront returns the same reference when already frontmost', () => {
    let l = float(base(), 'a', { x: 0, y: 0, width: 100, height: 100 })
    l = float(l, 'b', { x: 0, y: 0, width: 100, height: 100 })
    expect(bringToFront(l, 'b')).toBe(l)
    expect(bringToFront(l, 'a').floating.map((f) => f.id)).toEqual(['b', 'a'])
  })

  it('random operation sequences keep invariants', () => {
    let seed = 42
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed / 2 ** 31
    }
    let l: TilingLayout = split(emptyLayout, null, 'p0', 'row')
    let next = 1
    for (let step = 0; step < 500; step++) {
      const ids = allPaneIds(l)
      const pick = ids[Math.floor(rand() * ids.length)] ?? 'p0'
      const op = Math.floor(rand() * 7)
      if (op === 0 || ids.length < 2) {
        const target = placementOf(l, pick) === 'tiled' ? pick : null
        l = split(l, target, `p${next++}`, rand() < 0.5 ? 'row' : 'column', { ratio: rand() })
      } else if (op === 1) l = hide(l, pick)
      else if (op === 2) l = show(l, pick)
      else if (op === 3) l = float(l, pick, { x: 0, y: 0, width: 200, height: 100 })
      else if (op === 4) l = dock(l, pick)
      else if (op === 5 && ids.length > 2) l = close(l, pick)
      else l = swap(l, pick, ids[Math.floor(rand() * ids.length)] ?? pick)
      expect(validate(l)).toEqual([])
    }
  })
})

/** 비교용: px로 직접 재귀 배치 */
function referenceLayout(
  node: TileNode,
  x: number,
  y: number,
  w: number,
  h: number,
  gap: number,
  out: Map<string, [number, number, number, number]>,
) {
  if (node.type === 'pane') {
    out.set(node.id, [x, y, w, h])
    return
  }
  const n = node.children.length
  const row = node.direction === 'row'
  const available = (row ? w : h) - gap * (n - 1)
  let offset = row ? x : y
  node.children.forEach((child, i) => {
    const size = available * (node.sizes[i] ?? 0)
    if (row) referenceLayout(child, offset, y, size, h, gap, out)
    else referenceLayout(child, x, offset, w, size, gap, out)
    offset += size + gap
  })
}

describe('tiled geometry', () => {
  const tree = createLayout(
    splitNode(
      'row',
      [pane('a'), splitNode('column', [pane('b'), splitNode('row', [pane('c'), pane('d')], [0.3, 0.7])], [0.6, 0.4])],
      [0.25, 0.75],
    ),
  ).root!

  it.each([
    [800, 600, 0],
    [1280, 720, 4],
    [333, 1001, 6],
  ])('linear rects match a px layout at %ix%i gap %i', (W, H, gap) => {
    const geometry = computeTiledGeometry(tree, gap)
    const expected = new Map<string, [number, number, number, number]>()
    referenceLayout(tree, 0, 0, W, H, gap, expected)
    for (const [id, rect] of geometry.panes) {
      const r = evaluateRect(rect, W, H)
      const [x, y, w, h] = expected.get(id)!
      expect(r.x).toBeCloseTo(x, 6)
      expect(r.y).toBeCloseTo(y, 6)
      expect(r.width).toBeCloseTo(w, 6)
      expect(r.height).toBeCloseTo(h, 6)
    }
    // 첫 separator 중심은 a의 오른쪽 끝 + gap/2
    const sep = geometry.separators.find((s) => s.key === ':0')!
    const [ax, , aw] = expected.get('a')!
    expect(evaluate(sep.center, W)).toBeCloseTo(ax + aw + gap / 2, 6)
  })

  it('toCss formats linear values', () => {
    expect(toCss({ pct: 50, px: 0 })).toBe('50%')
    expect(toCss({ pct: 0, px: 4 })).toBe('4px')
    expect(toCss({ pct: 33.333333, px: -2 })).toBe('calc(33.3333% + -2px)')
  })

  it('minExtent sums along the axis and takes max across', () => {
    expect(minExtent(tree, 'x', 50, 4)).toBe(50 + 4 + (50 + 4 + 50))
    expect(minExtent(tree, 'y', 50, 4)).toBe(50 + 4 + 50)
  })

  it('neighbor finds adjacent panes', () => {
    const geometry = computeTiledGeometry(tree)
    expect(neighbor(geometry, 'a', 'right')).toBe('b')
    // 아래쪽 후보 c, d 중 b의 중심에 더 가까운 d
    expect(neighbor(geometry, 'b', 'down')).toBe('d')
    expect(neighbor(geometry, 'c', 'right')).toBe('d')
    expect(neighbor(geometry, 'd', 'left')).toBe('c')
    expect(neighbor(geometry, 'a', 'left')).toBe(null)
  })
})
