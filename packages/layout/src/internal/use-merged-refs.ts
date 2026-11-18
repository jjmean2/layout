import { useCallback, type Ref, type RefCallback } from 'react'

type Cleanup = () => void

/** ref 하나에 값을 넣고, 떼어낼 때 할 일을 돌려준다. */
function attach<T>(ref: Ref<T> | undefined, value: T): Cleanup | undefined {
  if (typeof ref === 'function') {
    const cleanup = ref(value)
    // React 19: callback ref가 cleanup을 돌려주면 null 호출 대신 cleanup을 부른다.
    return typeof cleanup === 'function' ? cleanup : () => ref(null)
  }
  if (ref) {
    ref.current = value
    return () => {
      ref.current = null
    }
  }
  return undefined
}

/**
 * ref 여러 개를 하나의 callback ref로 합친다. 입력 ref가 바뀔 때만 새 함수를 만든다.
 * 떼어낼 때 모든 ref를 정리한다 (함수 ref의 cleanup 실행, object ref는 null).
 */
export function useMergedRefs<T>(a: Ref<T> | undefined, b: Ref<T> | undefined, c?: Ref<T>, d?: Ref<T>): RefCallback<T> {
  return useCallback(
    (value: T) => {
      const cleanups = [attach(a, value), attach(b, value), attach(c, value), attach(d, value)]
      return () => {
        for (const cleanup of cleanups) cleanup?.()
      }
    },
    [a, b, c, d],
  )
}
