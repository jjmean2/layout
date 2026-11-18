'use client'

import { createContext, useContext, useEffect, type ReactNode, type RefObject } from 'react'

export interface ShellContextValue {
  /** floating 창의 경계로 쓸 작업 영역 (GNB 아래의 SidePanels Root) */
  workspaceRef: RefObject<HTMLDivElement | null>
  /** 오른쪽 inspector에 표시할 내용을 등록한다 */
  setInspector: (content: ReactNode) => void
}

export const ShellContext = createContext<ShellContextValue | null>(null)

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShell must be used inside AppShell')
  return ctx
}

/** 페이지가 inspector 내용을 등록하고, 페이지를 떠나면 지운다. */
export function useInspector(content: ReactNode) {
  const { setInspector } = useShell()
  useEffect(() => {
    setInspector(content)
  }, [setInspector, content])
  useEffect(() => () => setInspector(null), [setInspector])
}
