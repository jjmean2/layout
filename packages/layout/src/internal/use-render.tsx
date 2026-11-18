import { createElement, type ReactElement } from 'react'
import { mergeProps, renderElement, type RenderProp } from './merge-props.js'

type AnyProps = Record<string, unknown>

/**
 * part 컴포넌트의 렌더 공통 처리.
 * internal: 라이브러리가 정하는 props(style, data-*, aria-*, 이벤트), external: 사용자가 넘긴 props.
 */
export function useRender(
  defaultTag: string,
  render: RenderProp,
  internal: AnyProps,
  external: AnyProps,
): ReactElement {
  const props = mergeProps(internal, external)
  return renderElement(defaultTag, render, props, (tag, p) => createElement(tag, p))
}
