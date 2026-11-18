import { cloneElement, createElement, isValidElement, type ReactElement, type Ref } from 'react'
import { mergeProps, resolveLazy, type RenderProp } from './merge-props.js'
import { useMergedRefs } from './use-merged-refs.js'

type AnyProps = Record<string, unknown>

function withoutRef(props: AnyProps): AnyProps {
  if (!('ref' in props)) return props
  const { ref: _ref, ...rest } = props
  return rest
}

/**
 * part 컴포넌트의 렌더 공통 처리. 렌더마다 조건 없이 한 번 호출한다.
 * - internal: 라이브러리가 정하는 props (style, data-*, aria-*, 이벤트, ref)
 * - external: 사용자가 part에 넘긴 props
 * - render: 기본 태그 대신 렌더할 요소
 * ref는 internal, external, render 요소의 ref를 합친다 (입력이 바뀔 때만 새로 만든다).
 */
export function useRender(
  defaultTag: string,
  render: RenderProp,
  internal: AnyProps,
  external: AnyProps,
): ReactElement {
  const element = resolveLazy(render)
  const renderElement = element && isValidElement(element) ? (element as ReactElement<AnyProps>) : undefined
  const ref = useMergedRefs(
    internal.ref as Ref<unknown> | undefined,
    external.ref as Ref<unknown> | undefined,
    renderElement?.props.ref as Ref<unknown> | undefined,
  )
  const props = mergeProps(withoutRef(internal), withoutRef(external))
  if (renderElement) return cloneElement(renderElement, { ...mergeProps(props, withoutRef(renderElement.props)), ref })
  return createElement(defaultTag, { ...props, ref })
}
