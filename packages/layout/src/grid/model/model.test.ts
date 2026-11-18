import { describe, expect, it } from 'vitest'
import {
  addItem,
  compactLayout,
  findFreeSlot,
  moveItem,
  resizeItem,
  snapSize,
  stepSize,
  validate,
  type GridLayout,
} from './index'

const layout: GridLayout = [
  { id: 'a', x: 0, y: 0, w: 2, h: 2 },
  { id: 'b', x: 2, y: 0, w: 2, h: 2 },
  { id: 'c', x: 0, y: 2, w: 4, h: 1 },
]
const opts = { cols: 4 }

describe('grid model', () => {
  it('push moves colliding items down and cascades', () => {
    const next = moveItem(layout, 'b', 0, 0, opts)
    expect(validate(next, 4)).toEqual([])
    expect(next.find((i) => i.id === 'b')).toMatchObject({ x: 0, y: 0 })
    expect(next.find((i) => i.id === 'a')).toMatchObject({ x: 0, y: 2 })
    expect(next.find((i) => i.id === 'c')).toMatchObject({ y: 4 })
  })

  it('keeps array order and object identity for unaffected items', () => {
    const next = moveItem(layout, 'a', 0, 3, opts)
    expect(next.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(next[1]).toBe(layout[1])
  })

  it('block mode rejects overlapping moves', () => {
    expect(moveItem(layout, 'b', 0, 0, { cols: 4, collision: 'block' })).toBe(layout)
    expect(moveItem(layout, 'c', 0, 5, { cols: 4, collision: 'block' })).not.toBe(layout)
  })

  it('static items are never pushed and block moves', () => {
    const withStatic: GridLayout = [...layout, { id: 's', x: 0, y: 3, w: 4, h: 1, static: true }]
    expect(moveItem(withStatic, 'a', 0, 3, opts)).toBe(withStatic)
    expect(moveItem(withStatic, 's', 0, 0, opts)).toBe(withStatic)
    // c를 밀어야 하는데 그 아래에 static이 있으면 static 아래로 보낸다
    const next = resizeItem(withStatic, 'a', 2, 3, opts)
    expect(validate(next, 4)).toEqual([])
    expect(next.find((i) => i.id === 'c')!.y).toBe(4)
  })

  it('clamps to columns', () => {
    const next = moveItem(layout, 'a', 10, 0, opts)
    expect(next.find((i) => i.id === 'a')!.x).toBe(2)
  })

  it('compact pulls items up', () => {
    const gappy: GridLayout = [
      { id: 'a', x: 0, y: 3, w: 2, h: 1 },
      { id: 'b', x: 2, y: 5, w: 2, h: 1 },
    ]
    expect(compactLayout(gappy).map((i) => i.y)).toEqual([0, 0])
    expect(moveItem(layout, 'c', 0, 8, { cols: 4, compact: true }).find((i) => i.id === 'c')!.y).toBe(2)
  })

  it('findFreeSlot / addItem', () => {
    expect(findFreeSlot(layout, 2, 1, 4)).toEqual({ x: 0, y: 3 })
    expect(addItem(layout, { id: 'd', w: 1, h: 1 }, 4).at(-1)).toMatchObject({ x: 0, y: 3 })
  })

  it('snapSize picks nearest preset or clamps', () => {
    expect(
      snapSize(
        3.4,
        1.8,
        {
          sizes: [
            [2, 2],
            [4, 2],
            [4, 4],
          ],
        },
        8,
      ),
    ).toEqual([4, 2])
    expect(snapSize(9, 0.2, { minW: 2, maxW: 6 }, 8)).toEqual([6, 1])
    expect(
      stepSize(
        2,
        2,
        {
          sizes: [
            [2, 2],
            [4, 2],
            [4, 4],
          ],
        },
        8,
        1,
        0,
      ),
    ).toEqual([4, 2])
    expect(
      stepSize(
        4,
        2,
        {
          sizes: [
            [2, 2],
            [4, 2],
            [4, 4],
          ],
        },
        8,
        -1,
        0,
      ),
    ).toEqual([2, 2])
  })

  it('random moves keep the layout valid', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed / 2 ** 31)
    let l: GridLayout = Array.from({ length: 12 }, (_, i) => ({
      id: `i${i}`,
      x: (i * 2) % 8,
      y: Math.floor(i / 4) * 2,
      w: 2,
      h: 2,
    }))
    l.push({ id: 'fixed', x: 2, y: 9, w: 4, h: 1, static: true })
    expect(validate(l, 8)).toEqual([])
    for (let step = 0; step < 400; step++) {
      const item = l[Math.floor(rand() * l.length)]!
      l =
        rand() < 0.6
          ? moveItem(l, item.id, Math.floor(rand() * 8), Math.floor(rand() * 12), { cols: 8, compact: rand() < 0.3 })
          : resizeItem(l, item.id, 1 + Math.floor(rand() * 4), 1 + Math.floor(rand() * 3), { cols: 8 })
      expect(validate(l, 8)).toEqual([])
    }
  })
})
