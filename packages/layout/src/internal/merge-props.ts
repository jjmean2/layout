import { Children, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react'

type AnyProps = Record<string, unknown>

/** 사용자가 덮어쓸 수 있는 라이브러리 style 키. 나머지 라이브러리 style 키는 배치에 필요하므로 라이브러리 값이 이긴다. */
const USER_OVERRIDABLE_STYLE = new Set<string>(['cursor', 'boxSizing'])

/**
 * 라이브러리 props(internal)와 사용자 props(external)를 합친다. ref는 합치지 않는다 (useRender가 합친다).
 * - className: 이어 붙인다.
 * - style: 사용자 값이 이긴다. 단 라이브러리가 정한 배치 키(position, 크기, 위치, transform 등)는 라이브러리 값을 유지한다.
 * - 이벤트 핸들러: 사용자 것을 먼저 호출하고, 사용자가 preventDefault하면 라이브러리 것은 건너뛴다.
 * - 그 밖의 속성: 사용자 값이 이긴다.
 */
export function mergeProps(internal: AnyProps, external: AnyProps): AnyProps {
  const result: AnyProps = { ...internal }
  for (const [key, ext] of Object.entries(external)) {
    if (ext === undefined) continue
    const value = internal[key]
    if (key === 'className') {
      result[key] = [value, ext].filter(Boolean).join(' ') || undefined
    } else if (key === 'style') {
      const own = (value ?? {}) as Record<string, unknown>
      const merged: Record<string, unknown> = { ...own, ...(ext as CSSProperties) }
      for (const k of Object.keys(own)) if (!USER_OVERRIDABLE_STYLE.has(k)) merged[k] = own[k]
      result[key] = merged
    } else if (/^on[A-Z]/.test(key) && typeof value === 'function' && typeof ext === 'function') {
      result[key] = (event: { defaultPrevented?: boolean }, ...rest: unknown[]) => {
        ;(ext as (...args: unknown[]) => void)(event, ...rest)
        if (!event?.defaultPrevented) (value as (...args: unknown[]) => void)(event, ...rest)
      }
    } else {
      result[key] = ext
    }
  }
  return result
}

const REACT_LAZY = Symbol.for('react.lazy')

/**
 * Server Component가 만든 요소는 dev 모드에서 lazy 래퍼로 온다 (React 이슈 #32392).
 * 래퍼에는 props가 없어서 복제할 수 없으므로, 공개 API인 Children.toArray로 푼다 (Base UI와 같은 방식).
 * `$$typeof` 비교 외에 React 내부 필드는 쓰지 않는다.
 */
export function unwrapLazy<T>(node: T): T {
  if ((node as { $$typeof?: symbol } | undefined)?.$$typeof !== REACT_LAZY) return node
  const unwrapped = Children.toArray(node as ReactNode)[0]
  return isValidElement(unwrapped) ? (unwrapped as T) : node
}

export function isElement(node: unknown): node is ReactElement<AnyProps> {
  return isValidElement(node)
}

export function dataAttr(condition: boolean | undefined): '' | undefined {
  return condition ? '' : undefined
}
