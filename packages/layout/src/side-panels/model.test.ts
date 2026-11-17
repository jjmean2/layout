import { describe, expect, it } from 'vitest'
import { clamp, setCollapsed, setSize, toggleCollapsed } from './model'

describe('side-panels model', () => {
  it('setSize rounds and keeps collapsed flag', () => {
    const next = setSize({ left: { size: 200, collapsed: true } }, 'left', 250.6)
    expect(next.left).toEqual({ size: 251, collapsed: true })
  })

  it('returns the same reference when nothing changes', () => {
    const layout = { left: { size: 200, collapsed: false } }
    expect(setSize(layout, 'left', 200)).toBe(layout)
    expect(setCollapsed(layout, 'left', false)).toBe(layout)
  })

  it('creates a side entry from defaults', () => {
    expect(toggleCollapsed({}, 'right').right).toEqual({ size: 240, collapsed: true })
  })

  it('clamp keeps min when max < min', () => {
    expect(clamp(50, 100, 80)).toBe(100)
    expect(clamp(500, 100, 300)).toBe(300)
  })
})
