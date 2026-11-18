import { describe, expect, it, vi } from 'vitest'
import { LayoutController, type ChangeDetails } from './controller.js'

type L = { a: number; b: number }
const action: ChangeDetails = { reason: 'action' }
const incA = (l: L) => ({ ...l, a: l.a + 1 })
const incB = (l: L) => ({ ...l, b: l.b + 1 })

describe('LayoutController — uncontrolled', () => {
  it('composes several functional commits in one tick', () => {
    const c = new LayoutController<L>({ a: 0, b: 0 }, { layout: undefined, onLayoutChange: undefined })
    c.commit(incA, action)
    c.commit(incB, action)
    expect(c.get()).toEqual({ a: 1, b: 1 })
  })

  it('preview shows a draft without committing; cancel restores', () => {
    const onChange = vi.fn()
    const c = new LayoutController<L>({ a: 0, b: 0 }, { layout: undefined, onLayoutChange: onChange })
    c.preview({ a: 5, b: 0 })
    expect(c.get()).toEqual({ a: 5, b: 0 })
    expect(c.getCommitted()).toEqual({ a: 0, b: 0 })
    c.cancel()
    expect(c.get()).toEqual({ a: 0, b: 0 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('commit of an equal value clears the draft and does not notify the parent', () => {
    const onChange = vi.fn()
    const c = new LayoutController<L>({ a: 0, b: 0 }, { layout: undefined, onLayoutChange: onChange })
    c.preview({ a: 0, b: 0 })
    c.commit({ a: 0, b: 0 }, action)
    expect(c.isDrafting()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('LayoutController — controlled reconciliation', () => {
  const setup = () => {
    const onChange = vi.fn()
    const requestRender = vi.fn()
    const prop: L = { a: 0, b: 0 }
    const c = new LayoutController<L>({ a: -1, b: -1 }, { layout: prop, onLayoutChange: onChange })
    c.setRenderRequest(requestRender)
    return { c, onChange, requestRender, prop }
  }

  it('parent accepts: adopts the new prop', () => {
    const { c, onChange, requestRender } = setup()
    c.commit(incA, { reason: 'keyboard', source: 'left' })
    expect(onChange).toHaveBeenCalledWith({ a: 1, b: 0 }, { reason: 'keyboard', source: 'left' })
    expect(requestRender).toHaveBeenCalled()
    const accepted = onChange.mock.calls[0]![0] as L
    c.syncProps({ layout: accepted, onLayoutChange: onChange })
    expect(c.get()).toBe(accepted)
  })

  it('parent ignores: reverts to the last prop on the next render', () => {
    const { c, onChange, prop } = setup()
    c.commit(incA, action)
    expect(c.get()).toEqual({ a: 1, b: 0 })
    c.syncProps({ layout: prop, onLayoutChange: onChange })
    expect(c.get()).toBe(prop)
  })

  it('parent alters: adopts the altered value', () => {
    const { c, onChange } = setup()
    c.commit(incA, action)
    const altered = { a: 100, b: 0 }
    c.syncProps({ layout: altered, onLayoutChange: onChange })
    expect(c.get()).toBe(altered)
  })

  it('two commits in one tick compose; parent receives both and keeps the last', () => {
    const { c, onChange } = setup()
    c.commit(incA, action)
    c.commit(incB, action)
    expect(onChange.mock.calls.map((call) => call[0])).toEqual([
      { a: 1, b: 0 },
      { a: 1, b: 1 },
    ])
    c.syncProps({ layout: onChange.mock.calls[1]![0] as L, onLayoutChange: onChange })
    expect(c.get()).toEqual({ a: 1, b: 1 })
  })

  it('prop changes mid-drag: committed follows the prop, the draft stays until the drag ends', () => {
    const { c, onChange } = setup()
    c.preview({ a: 9, b: 0 })
    const external = { a: 0, b: 7 }
    c.syncProps({ layout: external, onLayoutChange: onChange })
    expect(c.getCommitted()).toBe(external)
    expect(c.get()).toEqual({ a: 9, b: 0 })
    // 드래그는 매 프레임 committed에서 다시 계산하므로 다음 미리보기는 외부 변경을 반영한다
    c.preview({ ...c.getCommitted(), a: 9 })
    c.commit(c.get(), { reason: 'drag' })
    expect(c.get()).toEqual({ a: 9, b: 7 })
  })

  it('parent re-renders mid-drag with an unchanged prop: draft and committed are untouched', () => {
    const { c, onChange, prop } = setup()
    c.preview({ a: 3, b: 0 })
    c.syncProps({ layout: prop, onLayoutChange: onChange })
    expect(c.get()).toEqual({ a: 3, b: 0 })
    expect(c.getCommitted()).toBe(prop)
  })

  it('switching from controlled to uncontrolled keeps the current value', () => {
    const { c, onChange } = setup()
    c.syncProps({ layout: undefined, onLayoutChange: onChange })
    c.commit(incA, action)
    c.syncProps({ layout: undefined, onLayoutChange: onChange })
    expect(c.get()).toEqual({ a: 1, b: 0 })
  })
})
