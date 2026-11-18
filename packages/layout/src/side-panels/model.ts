export type Side = 'left' | 'right'

export interface SideLayout {
  /** expanded 상태의 너비(px). 접어도 유지된다. */
  size: number
  collapsed: boolean
}

export interface SidePanelsLayout {
  left?: SideLayout
  right?: SideLayout
}

export const DEFAULT_SIDE: SideLayout = { size: 240, collapsed: false }

export function getSide(layout: SidePanelsLayout, side: Side, fallback: SideLayout = DEFAULT_SIDE): SideLayout {
  return layout[side] ?? fallback
}

export function setSize(layout: SidePanelsLayout, side: Side, size: number): SidePanelsLayout {
  const current = getSide(layout, side)
  const rounded = Math.round(size)
  if (current.size === rounded && layout[side]) return layout
  return { ...layout, [side]: { ...current, size: rounded } }
}

export function setCollapsed(layout: SidePanelsLayout, side: Side, collapsed: boolean): SidePanelsLayout {
  const current = getSide(layout, side)
  if (current.collapsed === collapsed && layout[side]) return layout
  return { ...layout, [side]: { ...current, collapsed } }
}

export function toggleCollapsed(layout: SidePanelsLayout, side: Side): SidePanelsLayout {
  return setCollapsed(layout, side, !getSide(layout, side).collapsed)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}
