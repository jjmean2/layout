import { cloneElement, createElement, type CSSProperties, type ReactElement, type Ref } from 'react'
import { isElement, mergeProps, unwrapLazy } from './merge-props.js'
import type { RenderFn, RenderFnProps } from './types.js'
import { useMergedRefs } from './use-merged-refs.js'

type AnyProps = Record<string, unknown>

export type RenderProp<State> = ReactElement<AnyProps> | RenderFn<State> | undefined

function withoutRef(props: AnyProps): AnyProps {
  if (!('ref' in props)) return props
  const { ref: _ref, ...rest } = props
  return rest
}

/** className, style이 state를 받는 함수면 값으로 바꾼다. */
function resolveExternal<State>(external: AnyProps, state: State): AnyProps {
  const { className, style } = external
  if (typeof className !== 'function' && typeof style !== 'function') return external
  return {
    ...external,
    className: typeof className === 'function' ? (className as (s: State) => string | undefined)(state) : className,
    style: typeof style === 'function' ? (style as (s: State) => CSSProperties | undefined)(state) : style,
  }
}

/**
 * part 컴포넌트의 렌더 공통 처리. 렌더마다 조건 없이 한 번 호출한다.
 * - internal: 라이브러리가 정하는 props (style, data-*, aria-*, 이벤트, ref)
 * - external: 사용자가 part에 넘긴 props (className, style은 state 함수일 수 있다)
 * - render: 기본 태그 대신 렌더할 요소, 또는 `(props, state) => 요소` 함수
 * - state: render 함수와 className/style 함수가 받는 part 상태
 */
export function useRender<State>(
  defaultTag: string,
  render: RenderProp<State>,
  internal: AnyProps,
  external: AnyProps,
  state: State = {} as State,
): ReactElement {
  const resolved = unwrapLazy(render)
  const renderElement = isElement(resolved) ? resolved : undefined
  const ref = useMergedRefs(
    internal.ref as Ref<unknown> | undefined,
    external.ref as Ref<unknown> | undefined,
    renderElement?.props.ref as Ref<unknown> | undefined,
  )
  const props = { ...mergeProps(withoutRef(internal), withoutRef(resolveExternal(external, state))), ref }
  if (typeof resolved === 'function') return (resolved as RenderFn<State>)(props as RenderFnProps, state)
  if (renderElement) return cloneElement(renderElement, { ...mergeProps(props, withoutRef(renderElement.props)), ref })
  return createElement(defaultTag, props)
}
