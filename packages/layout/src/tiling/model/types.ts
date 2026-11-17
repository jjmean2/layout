export type PaneId = string
export type Direction = 'row' | 'column'
export type Edge = 'left' | 'right' | 'top' | 'bottom'

export type TileNode =
  | { type: 'split'; direction: Direction; children: TileNode[]; sizes: number[] }
  | { type: 'pane'; id: PaneId }

/** px. bounds 박스의 왼쪽 위가 원점이다. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 숨기거나 띄운 pane을 되돌릴 자리. anchor pane의 edge 쪽에 ratio 비율로 붙인다. */
export interface RestoreHint {
  anchor: PaneId
  edge: Edge
  ratio: number
}

export interface FloatingPane {
  id: PaneId
  rect: Rect
  restore?: RestoreHint
}

export interface HiddenPane {
  id: PaneId
  restore?: RestoreHint
  /** floating 상태에서 숨겼으면 그 위치 */
  rect?: Rect
}

export interface TilingLayout {
  root: TileNode | null
  /** 배열 순서가 z-order. 마지막이 맨 앞이다. */
  floating: FloatingPane[]
  hidden: HiddenPane[]
}

/** split 노드의 위치. root부터의 child index 목록. */
export type Path = number[]

export type Placement = 'tiled' | 'floating' | 'hidden'
