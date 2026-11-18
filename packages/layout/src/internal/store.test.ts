import { describe, expect, it } from 'vitest'
import { createStore, deepEqual, shallowEqual } from './store'

describe('store', () => {
  it('notifies only on change', () => {
    const store = createStore(1)
    let calls = 0
    store.subscribe(() => calls++)
    store.set(1)
    store.set(2)
    store.update((n) => n + 1)
    expect(calls).toBe(2)
    expect(store.get()).toBe(3)
  })

  it('equality helpers', () => {
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(shallowEqual({ a: {} }, { a: {} })).toBe(false)
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
    expect(deepEqual([1], { 0: 1 })).toBe(false)
  })
})
