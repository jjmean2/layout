import { type CSSProperties, type ReactElement } from 'react'

type AnyProps = Record<string, unknown>

/**
 * 라이브러리 props(internal)와 사용자 props(external)를 합친다.
 * className은 이어 붙이고, style은 합치되 라이브러리 배치 값이 우선한다.
 * ref는 합치지 않는다 (useRender가 useMergedRefs로 합친다).
 * 이벤트 핸들러는 사용자 것을 먼저 호출하고, 사용자가 preventDefault하면 라이브러리 것은 건너뛴다.
 */
export function mergeProps(internal: AnyProps, external: AnyProps): AnyProps {
  const result: AnyProps = { ...external }
  for (const [key, value] of Object.entries(internal)) {
    const ext = external[key]
    if (key === 'className') {
      result[key] = [ext, value].filter(Boolean).join(' ') || undefined
    } else if (key === 'style') {
      result[key] = { ...(ext as CSSProperties), ...(value as CSSProperties) }
    } else if (/^on[A-Z]/.test(key) && typeof value === 'function' && typeof ext === 'function') {
      result[key] = (event: { defaultPrevented?: boolean }, ...rest: unknown[]) => {
        ;(ext as (...args: unknown[]) => void)(event, ...rest)
        if (!event?.defaultPrevented) (value as (...args: unknown[]) => void)(event, ...rest)
      }
    } else if (ext === undefined) {
      result[key] = value
    } else if (key.startsWith('data-') || key.startsWith('aria-') || key === 'role' || key === 'tabIndex') {
      // 사용자 지정 값을 우선한다.
      result[key] = ext
    } else {
      result[key] = value
    }
  }
  return result
}

export type RenderProp = ReactElement<AnyProps> | undefined

const REACT_LAZY = Symbol.for('react.lazy')

/**
 * Server Component가 넘긴 요소는 dev 모드에서 lazy 노드로 올 수 있다.
 * lazy를 풀어 요소로 만든다. 아직 준비되지 않았으면 Suspense로 던진다.
 */
export function resolveLazy(node: unknown): RenderProp {
  let current = node as { $$typeof?: symbol; _init?: (p: unknown) => unknown; _payload?: unknown } | undefined
  while (current && typeof current === 'object' && current.$$typeof === REACT_LAZY && current._init) {
    current = current._init(current._payload) as typeof current
  }
  return current as RenderProp
}

export function dataAttr(condition: boolean | undefined): '' | undefined {
  return condition ? '' : undefined
}
