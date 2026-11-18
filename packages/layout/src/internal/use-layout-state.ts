import { useCallback, useReducer, useRef, useState } from 'react'
import { createStore, deepEqual, type Store } from './store.js'
import { useIsoLayoutEffect } from './use-iso-layout-effect.js'

export interface LayoutStateOptions<T> {
  layout: T | undefined
  defaultLayout: T | undefined
  fallback: T
  onLayoutChange: ((next: T) => void) | undefined
}

export interface LayoutState<T> {
  /** 확정된 값 또는 드래그 중 draft. part는 이 store를 구독한다. */
  store: Store<T>
  /** 확정된 값 */
  committed: () => T
  /** 드래그 중 미리보기. onLayoutChange를 호출하지 않는다. */
  preview: (next: T) => void
  /** 변경을 확정한다. 확정된 값과 같으면 아무것도 하지 않는다. */
  commit: (next: T | ((prev: T) => T)) => void
  /** draft를 버리고 확정된 값으로 되돌린다. */
  cancel: () => void
}

/**
 * controlled(layout + onLayoutChange)와 uncontrolled(defaultLayout)를 함께 지원한다.
 * draft는 store에만 반영되고, 확정은 commit에서 한 번만 일어난다.
 */
export function useLayoutState<T>(options: LayoutStateOptions<T>): LayoutState<T> {
  const { layout, defaultLayout, fallback, onLayoutChange } = options
  const controlled = layout !== undefined
  const [internal, setInternal] = useState<T>(() => defaultLayout ?? fallback)
  const committedValue = controlled ? layout : internal

  const [store] = useState(() => createStore<T>(committedValue))
  const [, forceRender] = useReducer((n: number) => n + 1, 0)
  const drafting = useRef(false)
  const committedRef = useRef(committedValue)
  committedRef.current = committedValue
  const onChangeRef = useRef(onLayoutChange)
  onChangeRef.current = onLayoutChange
  const controlledRef = useRef(controlled)
  controlledRef.current = controlled

  // 렌더마다 확정된 값을 store에 맞춘다. controlled에서 부모가 변경을 받아들이지 않으면 여기서 되돌아간다.
  useIsoLayoutEffect(() => {
    if (!drafting.current) store.set(committedValue)
  })

  const preview = useCallback(
    (next: T) => {
      drafting.current = true
      store.set(next)
    },
    [store],
  )

  const commit = useCallback(
    (nextOrFn: T | ((prev: T) => T)) => {
      const next = typeof nextOrFn === 'function' ? (nextOrFn as (prev: T) => T)(committedRef.current) : nextOrFn
      drafting.current = false
      if (deepEqual(next, committedRef.current)) {
        store.set(committedRef.current)
        return
      }
      store.set(next)
      if (!controlledRef.current) setInternal(next)
      onChangeRef.current?.(next)
      // controlled에서 부모가 값을 바꾸지 않았을 때 되돌리기 위해 다시 렌더한다.
      if (controlledRef.current) forceRender()
    },
    [store],
  )

  const cancel = useCallback(() => {
    drafting.current = false
    store.set(committedRef.current)
  }, [store])

  const committed = useCallback(() => committedRef.current, [])

  return { store, committed, preview, commit, cancel }
}
