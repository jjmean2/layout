import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/with-selector'

export type Listener = () => void

export interface Store<T> extends Readable<T> {
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

/** 구독 가능한 값. store와 controller가 구현한다. */
export interface Readable<T> {
  get(): T
  subscribe(listener: Listener): () => void
}

/**
 * readable에서 selector가 고른 값만 구독한다. 고른 값이 isEqual로 같으면 리렌더하지 않는다.
 * React 팀의 useSyncExternalStoreWithSelector를 쓴다. 서버 snapshot은 클라이언트 첫 렌더와 같은 값이다.
 */
export function useStoreSelector<T, S>(
  readable: Readable<T>,
  selector: (state: T) => S,
  isEqual: (a: S, b: S) => boolean = Object.is,
): S {
  return useSyncExternalStoreWithSelector(readable.subscribe, readable.get, readable.get, selector, isEqual)
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
