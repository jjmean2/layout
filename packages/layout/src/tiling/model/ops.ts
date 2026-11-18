import {
  containsPane,
  getNode,
  insertAt,
  insertAtRoot,
  leafIds,
  normalize,
  normalizeSizes,
  pane,
  removePane,
  replaceId,
  updateAt,
} from './tree.js'
import type { Direction, Edge, Path, PaneId, Placement, Rect, RestoreHint, TilingLayout } from './types.js'

export const emptyLayout: TilingLayout = { root: null, floating: [], hidden: [] }

export function createLayout(root: TilingLayout['root'], rest: Partial<Omit<TilingLayout, 'root'>> = {}): TilingLayout {
  return { root: normalize(root), floating: rest.floating ?? [], hidden: rest.hidden ?? [] }
}

export function placementOf(layout: TilingLayout, id: PaneId): Placement | null {
  if (containsPane(layout.root, id)) return 'tiled'
  if (layout.floating.some((f) => f.id === id)) return 'floating'
  if (layout.hidden.some((h) => h.id === id)) return 'hidden'
  return null
}

/** 모든 pane id. 트리 순서, floating, hidden 순이다. */
export function allPaneIds(layout: TilingLayout): PaneId[] {
  return [...leafIds(layout.root), ...layout.floating.map((f) => f.id), ...layout.hidden.map((h) => h.id)]
}

function assertNew(layout: TilingLayout, id: PaneId) {
  if (placementOf(layout, id)) throw new Error(`Tiling: pane id "${id}" already exists`)
}

export interface SplitOptions {
  /** 새 pane을 target 뒤(오른쪽/아래)에 둘지 앞에 둘지. 기본값 'after' */
  position?: 'before' | 'after'
  /** 새 pane이 차지할 비율. 기본값 0.5 */
  ratio?: number
}

/** tiled pane target을 나눠 newId를 추가한다. 트리가 비어 있으면 newId가 root가 된다. */
export function split(
  layout: TilingLayout,
  target: PaneId | null,
  newId: PaneId,
  direction: Direction,
  options: SplitOptions = {},
): TilingLayout {
  assertNew(layout, newId)
  if (!layout.root) return { ...layout, root: pane(newId) }
  const after = (options.position ?? 'after') === 'after'
  const edge: Edge = direction === 'row' ? (after ? 'right' : 'left') : after ? 'bottom' : 'top'
  if (target === null || !containsPane(layout.root, target)) {
    return { ...layout, root: insertAtRoot(layout.root, newId, edge, options.ratio) }
  }
  return { ...layout, root: insertAt(layout.root, newId, target, edge, options.ratio) }
}

/** pane을 어디에 있든 제거한다. */
export function close(layout: TilingLayout, id: PaneId): TilingLayout {
  const placement = placementOf(layout, id)
  if (!placement) return layout
  if (placement === 'tiled') return { ...layout, root: removePane(layout.root, id).root }
  if (placement === 'floating') return { ...layout, floating: layout.floating.filter((f) => f.id !== id) }
  return { ...layout, hidden: layout.hidden.filter((h) => h.id !== id) }
}

/** path의 split 비율을 바꾼다. */
export function resize(layout: TilingLayout, path: Path, sizes: number[]): TilingLayout {
  const node = getNode(layout.root, path)
  if (!layout.root || !node || node.type !== 'split' || sizes.length !== node.children.length) return layout
  const next = normalizeSizes(sizes)
  if (next.every((s, i) => Math.abs(s - (node.sizes[i] ?? 0)) < 1e-9)) return layout
  return { ...layout, root: updateAt(layout.root, path, (n) => ({ ...n, sizes: next }) as typeof n) }
}

/**
 * index와 index+1 사이 경계를 delta(비율)만큼 옮긴다. 두 자식의 합은 유지된다.
 * min은 각 자식의 최소 비율이다.
 */
export function moveSeparator(
  layout: TilingLayout,
  path: Path,
  index: number,
  startSizes: number[],
  delta: number,
  min: [number, number] = [0, 0],
): TilingLayout {
  const a = startSizes[index]
  const b = startSizes[index + 1]
  if (a === undefined || b === undefined) return layout
  const total = a + b
  const lo = Math.min(min[0], total / 2)
  const hi = total - Math.min(min[1], total / 2)
  const nextA = Math.min(hi, Math.max(lo, a + delta))
  const sizes = startSizes.slice()
  sizes[index] = nextA
  sizes[index + 1] = total - nextA
  return resize(layout, path, sizes)
}

/** 두 pane의 자리를 바꾼다. 서로 다른 컬렉션(tiled, floating, hidden)에 있어도 된다. */
export function swap(layout: TilingLayout, a: PaneId, b: PaneId): TilingLayout {
  if (a === b || !placementOf(layout, a) || !placementOf(layout, b)) return layout
  const tmp = `\u0000swap:${a}`
  const rename = (from: PaneId, to: PaneId, l: TilingLayout): TilingLayout => ({
    root: replaceId(l.root, from, to),
    floating: l.floating.map((f) => (f.id === from ? { ...f, id: to } : f)),
    hidden: l.hidden.map((h) => (h.id === from ? { ...h, id: to } : h)),
  })
  return rename(tmp, b, rename(b, a, rename(a, tmp, layout)))
}

/** pane을 숨긴다. 되돌릴 자리를 기억한다. */
export function hide(layout: TilingLayout, id: PaneId): TilingLayout {
  const placement = placementOf(layout, id)
  if (placement === 'tiled') {
    const { root, restore } = removePane(layout.root, id)
    return { ...layout, root, hidden: [...layout.hidden, restore ? { id, restore } : { id }] }
  }
  if (placement === 'floating') {
    const entry = layout.floating.find((f) => f.id === id)!
    return {
      ...layout,
      floating: layout.floating.filter((f) => f.id !== id),
      hidden: [...layout.hidden, { id, rect: entry.rect, ...(entry.restore ? { restore: entry.restore } : {}) }],
    }
  }
  return layout
}

/** 숨긴 pane을 원래 자리(tiled 또는 floating)로 되돌린다. */
export function show(layout: TilingLayout, id: PaneId): TilingLayout {
  const entry = layout.hidden.find((h) => h.id === id)
  if (!entry) return layout
  const hidden = layout.hidden.filter((h) => h.id !== id)
  if (entry.rect) {
    return {
      ...layout,
      hidden,
      floating: [...layout.floating, { id, rect: entry.rect, ...(entry.restore ? { restore: entry.restore } : {}) }],
    }
  }
  return { ...layout, hidden, root: restoreInto(layout.root, id, entry.restore) }
}

function restoreInto(root: TilingLayout['root'], id: PaneId, hint: RestoreHint | undefined) {
  if (hint && containsPane(root, hint.anchor)) return insertAt(root, id, hint.anchor, hint.edge, hint.ratio)
  return insertAtRoot(root, id, hint?.edge ?? 'right', hint?.ratio ?? 0.5)
}

/** pane을 floating 창으로 띄운다. tiled에서 띄우면 되돌릴 자리를 기억한다. */
export function float(layout: TilingLayout, id: PaneId, rect: Rect): TilingLayout {
  const placement = placementOf(layout, id)
  if (placement === 'tiled') {
    const { root, restore } = removePane(layout.root, id)
    return { ...layout, root, floating: [...layout.floating, restore ? { id, rect, restore } : { id, rect }] }
  }
  if (placement === 'hidden') {
    const entry = layout.hidden.find((h) => h.id === id)!
    return {
      ...layout,
      hidden: layout.hidden.filter((h) => h.id !== id),
      floating: [...layout.floating, { id, rect, ...(entry.restore ? { restore: entry.restore } : {}) }],
    }
  }
  if (placement === 'floating') return moveFloating(layout, id, rect)
  return layout
}

/** floating 창을 트리에 붙인다. target이 없으면 띄우기 전 자리로 돌아간다. */
export function dock(layout: TilingLayout, id: PaneId, target?: RestoreHint): TilingLayout {
  const entry = layout.floating.find((f) => f.id === id)
  if (!entry) return layout
  return {
    ...layout,
    floating: layout.floating.filter((f) => f.id !== id),
    root: restoreInto(layout.root, id, target ?? entry.restore),
  }
}

export function moveFloating(layout: TilingLayout, id: PaneId, rect: Rect): TilingLayout {
  const index = layout.floating.findIndex((f) => f.id === id)
  if (index < 0) return layout
  const current = layout.floating[index]!
  const r = roundRect(rect)
  if (
    current.rect.x === r.x &&
    current.rect.y === r.y &&
    current.rect.width === r.width &&
    current.rect.height === r.height
  ) {
    return layout
  }
  const floating = layout.floating.slice()
  floating[index] = { ...current, rect: r }
  return { ...layout, floating }
}

/** floating 창을 맨 앞으로. 이미 맨 앞이면 같은 layout을 돌려준다. */
export function bringToFront(layout: TilingLayout, id: PaneId): TilingLayout {
  const index = layout.floating.findIndex((f) => f.id === id)
  if (index < 0 || index === layout.floating.length - 1) return layout
  const floating = layout.floating.slice()
  const [entry] = floating.splice(index, 1)
  floating.push(entry!)
  return { ...layout, floating }
}

export function roundRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

/** 불변 조건 검사. 위반하면 메시지 목록을 돌려준다. 테스트와 개발 모드 검증용. */
export function validate(layout: TilingLayout): string[] {
  const errors: string[] = []
  const ids = allPaneIds(layout)
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) errors.push(`duplicate pane id "${id}"`)
    seen.add(id)
  }
  const visit = (node: TilingLayout['root'], parentDirection: Direction | null) => {
    if (!node || node.type === 'pane') return
    if (node.children.length < 2) errors.push('split with fewer than 2 children')
    if (node.children.length !== node.sizes.length) errors.push('sizes length mismatch')
    const sum = node.sizes.reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 1) > 1e-6) errors.push(`sizes sum ${sum}`)
    if (node.direction === parentDirection) errors.push('nested split with same direction')
    for (const child of node.children) visit(child, node.direction)
  }
  visit(layout.root, null)
  return errors
}
