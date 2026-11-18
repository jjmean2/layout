export interface GridItemLayout {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** 다른 아이템에 밀리지 않고, 사용자가 옮길 수도 없다. */
  static?: boolean
}

export type GridLayout = GridItemLayout[]

export type Collision = 'push' | 'block'

export interface GridOptions {
  cols: number
  collision?: Collision
  /** 위쪽 빈칸을 자동으로 메울지 */
  compact?: boolean
}

type Box = Pick<GridItemLayout, 'x' | 'y' | 'w' | 'h'>

export function collides(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function rows(layout: GridLayout): number {
  return layout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
}

/** 위로 당겨 빈칸을 메운다. static 아이템은 움직이지 않는다. */
export function compactLayout(layout: GridLayout): GridLayout {
  const statics = layout.filter((i) => i.static)
  const placed: Box[] = [...statics]
  const order = layout
    .filter((i) => !i.static)
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const moved = new Map<string, GridItemLayout>()
  for (const item of order) {
    let y = item.y
    while (y > 0 && !placed.some((p) => collides({ ...item, y: y - 1 }, p))) y--
    // 겹친 상태로 들어왔으면 아래로 내린다
    while (placed.some((p) => collides({ ...item, y }, p))) y++
    const next = y === item.y ? item : { ...item, y }
    placed.push(next)
    moved.set(item.id, next)
  }
  let changed = false
  const result = layout.map((i) => {
    const next = moved.get(i.id) ?? i
    if (next !== i) changed = true
    return next
  })
  return changed ? result : layout
}

/**
 * moved 자리를 확정하고 겹치는 아이템을 아래로 밀어낸다.
 * static에 막히면 null.
 */
function push(others: GridItemLayout[], moved: GridItemLayout): GridItemLayout[] | null {
  const items = new Map(others.map((i) => [i.id, i] as const))
  const fixed: Box[] = [moved, ...others.filter((i) => i.static)]
  const queue: Box[] = [moved]
  let guard = 0
  while (queue.length) {
    if (++guard > 10_000) return null
    const cur = queue.shift()!
    const hits = [...items.values()]
      .filter((o) => o !== cur && o.id !== moved.id && collides(cur, o))
      .sort((a, b) => a.y - b.y)
    for (const other of hits) {
      if (other.static) return null
      let y = cur.y + cur.h
      // 고정된 것(moved, static)과 겹치지 않을 때까지 더 내린다
      for (;;) {
        const block = fixed.find((f) => f !== other && collides({ ...other, y }, f))
        if (!block) break
        y = block.y + block.h
      }
      const next = { ...other, y }
      items.set(other.id, next)
      queue.push(next)
    }
  }
  return [...items.values()]
}

function place(layout: GridLayout, id: string, box: Box, options: GridOptions): GridLayout {
  const index = layout.findIndex((i) => i.id === id)
  const item = layout[index]
  if (!item || item.static) return layout
  const cols = Math.max(1, options.cols)
  const w = Math.max(1, Math.min(Math.round(box.w), cols))
  const h = Math.max(1, Math.round(box.h))
  const x = Math.min(Math.max(0, Math.round(box.x)), cols - w)
  const y = Math.max(0, Math.round(box.y))
  if (item.x === x && item.y === y && item.w === w && item.h === h) return layout
  const moved: GridItemLayout = { ...item, x, y, w, h }
  const others = layout.filter((i) => i.id !== id)
  if (others.some((o) => o.static && collides(moved, o))) return layout
  let next: GridItemLayout[] | null
  if ((options.collision ?? 'push') === 'block') {
    next = others.some((o) => collides(moved, o)) ? null : others
  } else {
    next = push(others, moved)
  }
  if (!next) return layout
  const byId = new Map(next.map((i) => [i.id, i] as const))
  byId.set(id, moved)
  // 배열 순서를 유지한다 (DOM 순서가 바뀌지 않도록). 바뀌지 않은 아이템은 같은 객체를 쓴다.
  const result = layout.map((i) => {
    const n = byId.get(i.id)!
    return n.x === i.x && n.y === i.y && n.w === i.w && n.h === i.h ? i : n
  })
  return options.compact ? compactLayout(result) : result
}

export function moveItem(layout: GridLayout, id: string, x: number, y: number, options: GridOptions): GridLayout {
  const item = layout.find((i) => i.id === id)
  if (!item) return layout
  return place(layout, id, { x, y, w: item.w, h: item.h }, options)
}

export function resizeItem(layout: GridLayout, id: string, w: number, h: number, options: GridOptions): GridLayout {
  const item = layout.find((i) => i.id === id)
  if (!item) return layout
  return place(layout, id, { x: item.x, y: item.y, w, h }, options)
}

/** w x h가 들어갈 첫 빈자리 (위에서부터, 왼쪽부터). */
export function findFreeSlot(layout: GridLayout, w: number, h: number, cols: number): { x: number; y: number } {
  const width = Math.min(w, cols)
  for (let y = 0; ; y++) {
    for (let x = 0; x + width <= cols; x++) {
      const box = { x, y, w: width, h }
      if (!layout.some((i) => collides(box, i))) return { x, y }
    }
  }
}

export function addItem(layout: GridLayout, item: Omit<GridItemLayout, 'x' | 'y'> & Partial<Pick<GridItemLayout, 'x' | 'y'>>, cols: number): GridLayout {
  if (layout.some((i) => i.id === item.id)) throw new Error(`Grid: item id "${item.id}" already exists`)
  const slot = item.x !== undefined && item.y !== undefined ? { x: item.x, y: item.y } : findFreeSlot(layout, item.w, item.h, cols)
  return [...layout, { ...item, ...slot }]
}

export function removeItem(layout: GridLayout, id: string): GridLayout {
  return layout.some((i) => i.id === id) ? layout.filter((i) => i.id !== id) : layout
}

export interface SizeConstraints {
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number
  /** 허용 크기 목록. 있으면 min/max 대신 이 중 가장 가까운 크기로 맞춘다. */
  sizes?: ReadonlyArray<readonly [number, number]>
}

/** 연속 값(w, h)을 허용 크기로 맞춘다. */
export function snapSize(w: number, h: number, c: SizeConstraints, cols: number): [number, number] {
  if (c.sizes && c.sizes.length) {
    let best = c.sizes[0]!
    let bestD = Number.POSITIVE_INFINITY
    for (const s of c.sizes) {
      if (s[0] > cols) continue
      const d = (s[0] - w) ** 2 + (s[1] - h) ** 2
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    return [best[0], best[1]]
  }
  const rw = Math.round(w)
  const rh = Math.round(h)
  return [
    Math.min(Math.max(rw, c.minW ?? 1), Math.min(c.maxW ?? cols, cols)),
    Math.min(Math.max(rh, c.minH ?? 1), c.maxH ?? Number.POSITIVE_INFINITY),
  ]
}

/** 허용 크기 목록에서 현재 크기 다음/이전 크기 (키보드 조작용). */
export function stepSize(w: number, h: number, c: SizeConstraints, cols: number, dw: number, dh: number): [number, number] {
  if (c.sizes && c.sizes.length) {
    const list = c.sizes.filter((s) => s[0] <= cols).slice().sort((a, b) => a[0] * a[1] - b[0] * b[1] || a[0] - b[0])
    const index = list.findIndex((s) => s[0] === w && s[1] === h)
    const dir = dw + dh > 0 ? 1 : -1
    const next = list[Math.min(list.length - 1, Math.max(0, (index < 0 ? 0 : index) + dir))]!
    return [next[0], next[1]]
  }
  return snapSize(w + dw, h + dh, c, cols)
}

export function validate(layout: GridLayout, cols: number): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const item of layout) {
    if (ids.has(item.id)) errors.push(`duplicate id ${item.id}`)
    ids.add(item.id)
    if (item.x < 0 || item.y < 0 || item.x + item.w > cols) errors.push(`out of bounds ${item.id}`)
  }
  for (let i = 0; i < layout.length; i++)
    for (let j = i + 1; j < layout.length; j++)
      if (collides(layout[i]!, layout[j]!)) errors.push(`overlap ${layout[i]!.id} ${layout[j]!.id}`)
  return errors
}
