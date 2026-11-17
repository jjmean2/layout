import { useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/** 서버 렌더와 hydration 중에는 false, 그 이후에는 true. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}
