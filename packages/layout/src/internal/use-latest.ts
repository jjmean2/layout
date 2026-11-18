import { useRef, type RefObject } from 'react'
import { useIsoLayoutEffect } from './use-iso-layout-effect.js'

/**
 * 이벤트 핸들러에서 읽을 최신 값. 렌더 중이 아니라 layout effect에서 갱신한다.
 * Effect 안에서만 쓰는 콜백이라면 React의 useEffectEvent를 쓴다.
 * (useEffectEvent는 이벤트 핸들러나 외부 리스너에서 호출할 수 없다.)
 */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useIsoLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
