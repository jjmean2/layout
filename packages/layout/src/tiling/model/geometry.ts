import type { Direction, Path, PaneId, TileNode } from './types'

/** pct% + px 형태의 1차식. CSS calc()로 그대로 쓴다. */
export interface Lin {
  pct: number
  px: number
}

export interface LinRect {
  left: Lin
  top: Lin
  width: Lin
  height: Lin
}

export interface SeparatorGeometry {
  key: string
  path: Path
  index: number
  /** 부모 split 방향. row면 세로 막대 */
  direction: Direction
  /** row: 막대 중심선의 x, 위쪽 y, 높이. column: 막대 중심선의 y, 왼쪽 x, 너비 */
  center: Lin
  start: Lin
  length: Lin
}

export interface SplitGeometry {
  path: Path
  direction: Direction
  box: LinRect
  count: number
}

export interface TiledGeometry {
  panes: Map<PaneId, LinRect>
  separators: SeparatorGeometry[]
  splits: Map<string, SplitGeometry>
}

const add = (a: Lin, b: Lin): Lin => ({ pct: a.pct + b.pct, px: a.px + b.px })
const scale = (a: Lin, k: number): Lin => ({ pct: a.pct * k, px: a.px * k })
const px = (v: number): Lin => ({ pct: 0, px: v })

export const pathKey = (path: Path) => path.join('.')

/** root를 Root 박스(0~100%)에 배치한다. gap은 형제 사이 간격(px). */
export function computeTiledGeometry(root: TileNode | null, gap = 0): TiledGeometry {
  const result: TiledGeometry = { panes: new Map(), separators: [], splits: new Map() }
  if (!root) return result
  const full: LinRect = { left: px(0), top: px(0), width: { pct: 100, px: 0 }, height: { pct: 100, px: 0 } }

  const visit = (node: TileNode, box: LinRect, path: Path) => {
    if (node.type === 'pane') {
      result.panes.set(node.id, box)
      return
    }
    const n = node.children.length
    const row = node.direction === 'row'
    result.splits.set(pathKey(path), { path, direction: node.direction, box, count: n })
    const extent = row ? box.width : box.height
    const available = add(extent, px(-(n - 1) * gap))
    let offset = row ? box.left : box.top
    node.children.forEach((child, i) => {
      const size = scale(available, node.sizes[i] ?? 0)
      const childBox: LinRect = row
        ? { left: offset, top: box.top, width: size, height: box.height }
        : { left: box.left, top: offset, width: box.width, height: size }
      visit(child, childBox, [...path, i])
      offset = add(offset, size)
      if (i < n - 1) {
        result.separators.push({
          key: `${pathKey(path)}:${i}`,
          path,
          index: i,
          direction: node.direction,
          center: add(offset, px(gap / 2)),
          start: row ? box.top : box.left,
          length: row ? box.height : box.width,
        })
        offset = add(offset, px(gap))
      }
    })
  }
  visit(root, full, [])
  return result
}

const round = (v: number) => Math.round(v * 10000) / 10000

export function toCss(v: Lin): string {
  const pct = round(v.pct)
  const p = round(v.px)
  if (p === 0) return `${pct}%`
  if (pct === 0) return `${p}px`
  return `calc(${pct}% + ${p}px)`
}

export function evaluate(v: Lin, total: number): number {
  return (v.pct / 100) * total + v.px
}

export function evaluateRect(r: LinRect, width: number, height: number) {
  return {
    x: evaluate(r.left, width),
    y: evaluate(r.top, height),
    width: evaluate(r.width, width),
    height: evaluate(r.height, height),
  }
}

/** 방향(axis)으로 node가 차지해야 하는 최소 길이(px). */
export function minExtent(node: TileNode, axis: 'x' | 'y', minPane: number, gap: number): number {
  if (node.type === 'pane') return minPane
  const along = (node.direction === 'row') === (axis === 'x')
  const children = node.children.map((c) => minExtent(c, axis, minPane, gap))
  return along ? children.reduce((a, b) => a + b, 0) + gap * (children.length - 1) : Math.max(...children)
}

export type FocusDirection = 'left' | 'right' | 'up' | 'down'

/** from pane에서 direction 쪽으로 가장 가까운 tiled pane. */
export function neighbor(geometry: TiledGeometry, from: PaneId, direction: FocusDirection): PaneId | null {
  const W = 1000
  const H = 1000
  const rects = [...geometry.panes].map(([id, r]) => [id, evaluateRect(r, W, H)] as const)
  const origin = rects.find(([id]) => id === from)?.[1]
  if (!origin) return null
  const cx = origin.x + origin.width / 2
  const cy = origin.y + origin.height / 2
  let best: PaneId | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const [id, r] of rects) {
    if (id === from) continue
    const horizontal = direction === 'left' || direction === 'right'
    const overlap = horizontal
      ? Math.min(origin.y + origin.height, r.y + r.height) - Math.max(origin.y, r.y)
      : Math.min(origin.x + origin.width, r.x + r.width) - Math.max(origin.x, r.x)
    if (overlap <= 0) continue
    const distance =
      direction === 'left'
        ? origin.x - (r.x + r.width)
        : direction === 'right'
          ? r.x - (origin.x + origin.width)
          : direction === 'up'
            ? origin.y - (r.y + r.height)
            : r.y - (origin.y + origin.height)
    if (distance < -1) continue
    const ox = r.x + r.width / 2
    const oy = r.y + r.height / 2
    const score = distance * 10 + (horizontal ? Math.abs(oy - cy) : Math.abs(ox - cx))
    if (score < bestScore) {
      bestScore = score
      best = id
    }
  }
  return best
}
