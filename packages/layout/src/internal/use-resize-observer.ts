import { useEffect, useRef, type RefObject } from 'react'

/** 요소 크기가 바뀔 때 callback을 호출한다. React 상태를 만들지 않는다. */
export function useResizeObserver(
  ref: RefObject<Element | null>,
  callback: (entry: ResizeObserverEntry) => void,
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (entry) callbackRef.current(entry)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
}
