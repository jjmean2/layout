import type { Direction, Edge, Path, PaneId, RestoreHint, TileNode } from './types'

export function pane(id: PaneId): TileNode {
  return { type: 'pane', id }
}

export function splitNode(direction: Direction, children: TileNode[], sizes?: number[]): TileNode {
  const n = children.length
  return { type: 'split', direction, children, sizes: normalizeSizes(sizes ?? children.map(() => 1 / n)) }
}

export function normalizeSizes(sizes: number[]): number[] {
  const total = sizes.reduce((a, b) => a + Math.max(0, b), 0)
  if (total <= 0) return sizes.map(() => 1 / sizes.length)
  return sizes.map((s) => Math.max(0, s) / total)
}

/** 같은 방향의 중첩 split을 합치고, 자식이 하나인 split을 없앤다. */
export function normalize(node: TileNode | null): TileNode | null {
  if (!node || node.type === 'pane') return node
  const children: TileNode[] = []
  const sizes: number[] = []
  node.children.forEach((child, i) => {
    const size = node.sizes[i] ?? 0
    const normalized = normalize(child)
    if (!normalized) return
    if (normalized.type === 'split' && normalized.direction === node.direction) {
      normalized.children.forEach((grandchild, j) => {
        children.push(grandchild)
        sizes.push(size * (normalized.sizes[j] ?? 0))
      })
    } else {
      children.push(normalized)
      sizes.push(size)
    }
  })
  if (children.length === 0) return null
  if (children.length === 1) return children[0]!
  return { type: 'split', direction: node.direction, children, sizes: normalizeSizes(sizes) }
}

export function leafIds(node: TileNode | null, out: PaneId[] = []): PaneId[] {
  if (!node) return out
  if (node.type === 'pane') out.push(node.id)
  else for (const child of node.children) leafIds(child, out)
  return out
}

export function firstLeaf(node: TileNode): PaneId {
  return node.type === 'pane' ? node.id : firstLeaf(node.children[0]!)
}

export function lastLeaf(node: TileNode): PaneId {
  return node.type === 'pane' ? node.id : lastLeaf(node.children[node.children.length - 1]!)
}

export function containsPane(node: TileNode | null, id: PaneId): boolean {
  if (!node) return false
  if (node.type === 'pane') return node.id === id
  return node.children.some((c) => containsPane(c, id))
}

export function getNode(root: TileNode | null, path: Path): TileNode | null {
  let node = root
  for (const index of path) {
    if (!node || node.type !== 'split') return null
    node = node.children[index] ?? null
  }
  return node
}

export function updateAt(root: TileNode, path: Path, fn: (node: TileNode) => TileNode): TileNode {
  if (path.length === 0) return fn(root)
  if (root.type !== 'split') return root
  const [head, ...rest] = path
  const children = root.children.slice()
  children[head!] = updateAt(children[head!]!, rest, fn)
  return { ...root, children }
}

/** pane을 트리에서 제거하고, 되돌릴 자리를 돌려준다. */
export function removePane(root: TileNode | null, id: PaneId): { root: TileNode | null; restore?: RestoreHint } {
  if (!root) return { root }
  if (root.type === 'pane') return root.id === id ? { root: null } : { root }

  const index = root.children.findIndex((c) => c.type === 'pane' && c.id === id)
  if (index >= 0) {
    const before = index > 0
    const neighborIndex = before ? index - 1 : index + 1
    const neighbor = root.children[neighborIndex]!
    const removedSize = root.sizes[index] ?? 0
    const neighborSize = root.sizes[neighborIndex] ?? 0
    const restore: RestoreHint = {
      anchor: before ? lastLeaf(neighbor) : firstLeaf(neighbor),
      edge: edgeFor(root.direction, before ? 'after' : 'before'),
      ratio: removedSize + neighborSize > 0 ? removedSize / (removedSize + neighborSize) : 0.5,
    }
    // 제거한 크기는 이웃이 가져간다.
    const sizes = root.sizes.slice()
    sizes[neighborIndex] = neighborSize + removedSize
    sizes.splice(index, 1)
    const children = root.children.filter((_, i) => i !== index)
    return { root: normalize({ ...root, children, sizes }), restore }
  }

  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i]!
    if (!containsPane(child, id)) continue
    const result = removePane(child, id)
    const children = root.children.slice()
    const sizes = root.sizes.slice()
    if (result.root) children[i] = result.root
    else {
      children.splice(i, 1)
      sizes.splice(i, 1)
    }
    return { root: normalize({ ...root, children, sizes }), restore: result.restore }
  }
  return { root }
}

/** anchor pane의 edge 쪽에 새 pane을 붙인다. ratio는 새 pane이 차지할 비율. */
export function insertAt(root: TileNode | null, id: PaneId, anchor: PaneId, edge: Edge, ratio = 0.5): TileNode | null {
  if (!root) return pane(id)
  if (!containsPane(root, anchor)) return insertAtRoot(root, id, edge, ratio)
  const direction: Direction = edge === 'left' || edge === 'right' ? 'row' : 'column'
  const after = edge === 'right' || edge === 'bottom'
  const r = clampRatio(ratio)

  const visit = (node: TileNode): TileNode => {
    if (node.type === 'pane') {
      if (node.id !== anchor) return node
      const children = after ? [node, pane(id)] : [pane(id), node]
      const sizes = after ? [1 - r, r] : [r, 1 - r]
      return { type: 'split', direction, children, sizes }
    }
    const index = node.children.findIndex((c) => c.type === 'pane' && c.id === anchor)
    if (index >= 0 && node.direction === direction) {
      // 같은 방향이면 형제로 넣고, anchor의 크기를 나눠 갖는다.
      const anchorSize = node.sizes[index] ?? 0
      const children = node.children.slice()
      const sizes = node.sizes.slice()
      const insertIndex = after ? index + 1 : index
      sizes[index] = anchorSize * (1 - r)
      children.splice(insertIndex, 0, pane(id))
      sizes.splice(insertIndex, 0, anchorSize * r)
      return { ...node, children, sizes: normalizeSizes(sizes) }
    }
    return { ...node, children: node.children.map(visit) }
  }
  return normalize(visit(root))
}

export function insertAtRoot(root: TileNode | null, id: PaneId, edge: Edge = 'right', ratio = 0.5): TileNode {
  if (!root) return pane(id)
  const direction: Direction = edge === 'left' || edge === 'right' ? 'row' : 'column'
  const after = edge === 'right' || edge === 'bottom'
  const r = clampRatio(ratio)
  const node: TileNode = after
    ? { type: 'split', direction, children: [root, pane(id)], sizes: [1 - r, r] }
    : { type: 'split', direction, children: [pane(id), root], sizes: [r, 1 - r] }
  return normalize(node)!
}

export function replaceId(node: TileNode | null, from: PaneId, to: PaneId): TileNode | null {
  if (!node) return node
  if (node.type === 'pane') return node.id === from ? pane(to) : node
  return { ...node, children: node.children.map((c) => replaceId(c, from, to)!) }
}

function edgeFor(direction: Direction, position: 'before' | 'after'): Edge {
  if (direction === 'row') return position === 'before' ? 'left' : 'right'
  return position === 'before' ? 'top' : 'bottom'
}

function clampRatio(r: number): number {
  return Math.min(0.95, Math.max(0.05, Number.isFinite(r) ? r : 0.5))
}

/** split 노드들을 경로와 함께 순회한다. */
export function forEachSplit(node: TileNode | null, fn: (split: Extract<TileNode, { type: 'split' }>, path: Path) => void, path: Path = []) {
  if (!node || node.type !== 'split') return
  fn(node, path)
  node.children.forEach((child, i) => forEachSplit(child, fn, [...path, i]))
}
