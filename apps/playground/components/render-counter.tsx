'use client'

import { useEffect, useState } from 'react'

declare global {
  interface Window {
    __renders?: Record<string, number>
    __instances?: Record<string, string[]>
  }
}

let seq = 0

/** commit된 렌더 횟수와 컴포넌트 인스턴스를 window에 기록한다. e2e가 리렌더와 remount를 확인한다. */
export function RenderCounter({ id }: { id: string }) {
  const [instance] = useState(() => `i${++seq}`)
  useEffect(() => {
    const all = (window.__renders ??= {})
    all[id] = (all[id] ?? 0) + 1
  })
  useEffect(() => {
    const instances = (window.__instances ??= {})
    const list = (instances[id] ??= [])
    if (!list.includes(instance)) list.push(instance)
  }, [id, instance])
  return <span hidden data-render-counter={id} />
}
