import { describe, expect, it } from 'vitest'
import { clampFloatingRect, resizeRect } from './floating'

const opts = { minVisible: 100, minSize: { width: 100, height: 60 } } as const

describe('clampFloatingRect', () => {
  it('keeps the top edge inside bounds', () => {
    expect(clampFloatingRect({ x: 50, y: -40, width: 300, height: 200 }, { width: 800, height: 600 }, opts).y).toBe(0)
  })

  it('lets the window leave left/right/bottom but keeps minVisible px', () => {
    const b = { width: 800, height: 600 }
    expect(clampFloatingRect({ x: -500, y: 0, width: 300, height: 200 }, b, opts).x).toBe(-200)
    expect(clampFloatingRect({ x: 1000, y: 0, width: 300, height: 200 }, b, opts).x).toBe(700)
    expect(clampFloatingRect({ x: 0, y: 900, width: 300, height: 200 }, b, opts).y).toBe(500)
  })

  it("'full' keeps the whole window inside and shrinks it when larger than bounds", () => {
    const r = clampFloatingRect(
      { x: 700, y: 500, width: 1000, height: 200 },
      { width: 800, height: 600 },
      {
        ...opts,
        minVisible: 'full',
      },
    )
    expect(r).toEqual({ x: 0, y: 400, width: 800, height: 200 })
  })

  it('applies minimum size', () => {
    const r = clampFloatingRect({ x: 0, y: 0, width: 10, height: 10 }, { width: 800, height: 600 }, opts)
    expect([r.width, r.height]).toEqual([100, 60])
  })
})

describe('resizeRect', () => {
  const start = { x: 100, y: 100, width: 300, height: 200 }
  it('resizes from bottom-right', () => {
    expect(resizeRect(start, 'bottom-right', 50, 20, opts.minSize)).toEqual({ x: 100, y: 100, width: 350, height: 220 })
  })
  it('resizes from top-left keeping the opposite corner', () => {
    expect(resizeRect(start, 'top-left', 250, 0, opts.minSize)).toEqual({ x: 300, y: 100, width: 100, height: 200 })
  })
})
