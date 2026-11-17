import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export interface DragDelta {
  dx: number
  dy: number
  event: PointerEvent
}

export interface DragGestureOptions {
  /** 이 거리(px)를 넘어야 드래그가 시작된다. 0이면 pointerdown에서 바로 시작한다. */
  threshold?: number
  /** 드래그 시작. false를 반환하면 시작하지 않는다. */
  onStart?: (event: PointerEvent) => void | false
  /** rAF로 묶어 프레임당 한 번 호출된다. */
  onMove: (delta: DragDelta) => void
  onEnd: (delta: DragDelta) => void
  /** Esc 또는 pointercancel */
  onCancel?: () => void
}

const HANDLED = Symbol.for('@layout/react:drag-handled')

/**
 * handle 요소의 onPointerDown에 연결한다.
 * - 중첩된 handle 중 가장 안쪽이 이벤트를 처리하고, 바깥 handle은 무시한다.
 * - pointer capture로 iframe이나 다른 요소 위에서도 이벤트를 계속 받는다.
 */
export function useDragGesture(options: DragGestureOptions) {
  const optionsRef = useRef(options)
  optionsRef.current = options
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanupRef.current?.(), [])

  return useCallback((reactEvent: ReactPointerEvent<HTMLElement>) => {
    const native = reactEvent.nativeEvent as PointerEvent & { [HANDLED]?: boolean }
    if (native[HANDLED]) return
    if (reactEvent.button !== 0 || !reactEvent.isPrimary) return
    native[HANDLED] = true

    const target = reactEvent.currentTarget
    const startX = reactEvent.clientX
    const startY = reactEvent.clientY
    const pointerId = reactEvent.pointerId
    const threshold = optionsRef.current.threshold ?? 0
    let started = false
    let frame = 0
    let last: PointerEvent | null = null

    // 텍스트 선택과 브라우저 기본 드래그를 막는다. 포커스는 직접 옮긴다.
    reactEvent.preventDefault()
    if (target.tabIndex >= 0) target.focus({ preventScroll: true })

    const delta = (event: PointerEvent): DragDelta => ({
      dx: event.clientX - startX,
      dy: event.clientY - startY,
      event,
    })

    const start = (event: PointerEvent) => {
      if (optionsRef.current.onStart?.(event) === false) {
        finish()
        return false
      }
      started = true
      try {
        target.setPointerCapture(pointerId)
      } catch {
        // 이미 해제된 pointer
      }
      return true
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      if (!started) {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) < threshold) return
        if (!start(event)) return
      }
      last = event
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (last) optionsRef.current.onMove(delta(last))
      })
    }

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      const wasStarted = started
      finish()
      if (wasStarted) optionsRef.current.onEnd(delta(event))
    }

    const onCancel = (event?: Event) => {
      if (event instanceof PointerEvent && event.pointerId !== pointerId) return
      const wasStarted = started
      finish()
      if (wasStarted) optionsRef.current.onCancel?.()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !started) return
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    }

    const finish = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKeyDown, true)
      try {
        if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
      } catch {
        // 무시
      }
      cleanupRef.current = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKeyDown, true)
    cleanupRef.current = finish

    if (threshold === 0) start(native)
  }, [])
}
