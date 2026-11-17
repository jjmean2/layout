import { useCallback, useRef, useSyncExternalStore } from 'react'

export type Listener = () => void

export interface Store<T> {
  get(): T
  set(next: T): void
  update(fn: (prev: T) => T): void
  subscribe(listener: Listener): () => void
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<Listener>()
  return {
    get: () => state,
    set(next) {
      if (Object.is(next, state)) return
      state = next
      for (const listener of listeners) listener()
    },
    update(fn) {
      this.set(fn(state))
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * store에서 selector가 고른 값만 구독한다. 고른 값이 isEqual로 같으면 리렌더하지 않는다.
 * store의 초기값은 props에서 결정되므로 서버와 클라이언트 첫 렌더가 같다.
 */
export function useStoreSelector<T, S>(
  store: Store<T>,
  selector: (state: T) => S,
  isEqual: (a: S, b: S) => boolean = Object.is,
): S {
  const cache = useRef<{ state: T; selected: S } | null>(null)
  const selectorRef = useRef(selector)
  selectorRef.current = selector
  const isEqualRef = useRef(isEqual)
  isEqualRef.current = isEqual

  const getSnapshot = useCallback(() => {
    const state = store.get()
    const prev = cache.current
    if (prev && Object.is(prev.state, state)) return prev.selected
    const selected = selectorRef.current(state)
    if (prev && isEqualRef.current(prev.selected, selected)) {
      cache.current = { state, selected: prev.selected }
      return prev.selected
    }
    cache.current = { state, selected }
    return selected
  }, [store])

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}

export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  }
  return true
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  for (const k of ka) {
    if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  }
  return true
}
