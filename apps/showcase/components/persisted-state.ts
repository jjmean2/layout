'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 레이아웃을 localStorage에 저장하는 hook.
 * 첫 렌더는 서버와 같은 initial 값으로 하고(hydration mismatch 없음), mount 후 저장값을 적용한다.
 * 그 사이의 layout shift는 허용한다 (docs/design.md 3.5).
 */
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState(initial)
  const loaded = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setValue(JSON.parse(raw) as T)
    } catch {
      // 저장소를 쓸 수 없거나 값이 깨졌으면 initial을 쓴다
    }
    loaded.current = true
  }, [key])

  useEffect(() => {
    if (!loaded.current) return
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // 무시
    }
  }, [key, value])

  const reset = () => {
    try {
      localStorage.removeItem(key)
    } catch {
      // 무시
    }
    setValue(initial)
  }

  return [value, setValue, reset] as const
}
