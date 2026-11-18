import { useReducer, useState } from 'react'
import { LayoutController, type LayoutChangeHandler } from './controller.js'
import { useIsoLayoutEffect } from './use-iso-layout-effect.js'

export interface LayoutProps<L> {
  layout: L | undefined
  defaultLayout: L | undefined
  onLayoutChange: LayoutChangeHandler<L> | undefined
}

/**
 * Root가 소유하는 controller를 만들고 props와 맞춘다.
 * controller는 한 번만 만든다. props 동기화는 렌더가 아니라 layout effect에서 한다.
 */
export function useLayoutController<L>(props: LayoutProps<L>, fallback: L): LayoutController<L> {
  const { layout, defaultLayout, onLayoutChange } = props
  const [controller] = useState(() => new LayoutController<L>(defaultLayout ?? fallback, { layout, onLayoutChange }))
  const [, forceRender] = useReducer((n: number) => n + 1, 0)
  useIsoLayoutEffect(() => {
    controller.setRenderRequest(forceRender)
    controller.syncProps({ layout, onLayoutChange })
  })
  return controller
}
