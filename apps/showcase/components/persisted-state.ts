'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

const listeners = new Map<string, Set<() => void>>()

function subscribe(key: string, listener: () => void) {
  const set = listeners.get(key) ?? new Set()
  set.add(listener)
  listeners.set(key, set)
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    set.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // 저장소를 쓸 수 없으면 무시한다
  }
  for (const listener of listeners.get(key) ?? []) listener()
}

/**
 * 레이아웃을 localStorage에 저장하는 hook.
 * 서버와 hydration 첫 렌더는 initial을 쓰고 (server snapshot = null), 그 뒤 저장값을 읽는다.
 * 그 사이의 layout shift는 허용한다 (docs/design.md 3.5).
 */
export function usePersistedState<T>(key: string, initial: T) {
  const raw = useSyncExternalStore(
    useCallback((listener) => subscribe(key, listener), [key]),
    () => read(key),
    () => null,
  )
  const value = useMemo<T>(() => {
    if (raw === null) return initial
    try {
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
  }, [raw, initial])

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = (() => {
        const stored = read(key)
        if (stored === null) return initial
        try {
          return JSON.parse(stored) as T
        } catch {
          return initial
        }
      })()
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(current) : next
      write(key, JSON.stringify(resolved))
    },
    [key, initial],
  )

  const reset = useCallback(() => write(key, null), [key])

  return [value, setValue, reset] as const
}
