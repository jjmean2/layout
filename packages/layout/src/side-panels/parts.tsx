'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createHoverReveal, type HoverReveal } from '../internal/hover-reveal.js'
import { dataAttr, mergeRefs } from '../internal/merge-props.js'
import { createStore, shallowEqual, useStoreSelector, type Store } from '../internal/store.js'
import type { PartProps } from '../internal/types.js'
import { useDragGesture } from '../internal/use-drag-gesture.js'
import { useIsoLayoutEffect } from '../internal/use-iso-layout-effect.js'
import type { LayoutController, LayoutChangeHandler } from '../internal/controller.js'
import { useLayoutController } from '../internal/use-layout-controller.js'
import { useRender } from '../internal/use-render.js'
import {
  clamp,
  getSide,
  setCollapsed as setCollapsedFn,
  setSize as setSizeFn,
  toggleCollapsed as toggleCollapsedFn,
  type Side,
  type SideLayout,
  type SidePanelsLayout,
} from './model.js'

export interface HoverOverlayOptions {
  /** hover 후 열릴 때까지 지연(ms). 기본값 150 */
  openDelay?: number
  /** 포인터가 벗어난 뒤 닫힐 때까지 지연(ms). 기본값 300 */
  closeDelay?: number
}

interface PanelConfig {
  minSize: number
  maxSize: number
  defaultSize: number
  hoverOverlay: Required<HoverOverlayOptions> | false
}

const DEFAULT_CONFIG: PanelConfig = {
  minSize: 120,
  maxSize: Number.POSITIVE_INFINITY,
  defaultSize: 240,
  hoverOverlay: { openDelay: 150, closeDelay: 300 },
}

type Reveal = Record<Side, boolean>
type Configs = Record<Side, PanelConfig>

interface RootContextValue {
  layout: LayoutController<SidePanelsLayout>
  reveal: Store<Reveal>
  configs: Store<Configs>
  dragging: Store<Side | null>
  revealers: Record<Side, HoverReveal>
  /** Main이 등록한 최소 너비(px) */
  mainMinSize: Store<number>
  rootRef: RefObject<HTMLDivElement | null>
  panelIds: Record<Side, string>
  triggerRefs: Record<Side, RefObject<HTMLElement | null>>
  panelRefs: Record<Side, RefObject<HTMLElement | null>>
}

const RootContext = createContext<RootContextValue | null>(null)

function useRootContext(part: string): RootContextValue {
  const ctx = useContext(RootContext)
  if (!ctx) throw new Error(`SidePanels.${part} must be used inside SidePanels.Root`)
  return ctx
}

function sideFromLayout(layout: SidePanelsLayout, side: Side, config: PanelConfig): SideLayout {
  return getSide(layout, side, { size: config.defaultSize, collapsed: false })
}

type VisualState = 'expanded' | 'collapsed' | 'overlay'

function visualState(side: SideLayout, revealOpen: boolean, config: PanelConfig): VisualState {
  if (!side.collapsed) return 'expanded'
  return revealOpen && config.hoverOverlay ? 'overlay' : 'collapsed'
}

/* ------------------------------------------------------------------ Root */

export type RootProps = PartProps<{
  layout?: SidePanelsLayout
  defaultLayout?: SidePanelsLayout
  /** 변경이 확정될 때(놓을 때, 키 입력, 액션) 한 번 호출된다. */
  onLayoutChange?: LayoutChangeHandler<SidePanelsLayout>
  children?: ReactNode
}>

export function Root(props: RootProps) {
  const { layout, defaultLayout, onLayoutChange, render, ref, children, ...rest } = props
  const controller = useLayoutController<SidePanelsLayout>({ layout, defaultLayout, onLayoutChange }, {})
  const rootRef = useRef<HTMLDivElement | null>(null)
  const idBase = useId()

  const [ctx] = useState<RootContextValue>(() => {
    const reveal = createStore<Reveal>({ left: false, right: false })
    const configs = createStore<Configs>({ left: DEFAULT_CONFIG, right: DEFAULT_CONFIG })
    const makeRevealer = (side: Side) =>
      createHoverReveal(() => {
        const hover = configs.get()[side].hoverOverlay
        return {
          openDelay: hover ? hover.openDelay : 0,
          closeDelay: hover ? hover.closeDelay : 0,
          onChange: (open) => reveal.update((r) => ({ ...r, [side]: open })),
        }
      })
    return {
      layout: controller,
      reveal,
      configs,
      dragging: createStore<Side | null>(null),
      revealers: { left: makeRevealer('left'), right: makeRevealer('right') },
      mainMinSize: createStore(0),
      rootRef,
      panelIds: { left: `${idBase}-left`, right: `${idBase}-right` },
      triggerRefs: { left: { current: null }, right: { current: null } },
      panelRefs: { left: { current: null }, right: { current: null } },
    }
  })
  useEffect(
    () => () => {
      ctx.revealers.left.dispose()
      ctx.revealers.right.dispose()
    },
    [ctx],
  )

  // 펼쳐지면 overlay 상태를 정리한다.
  const layoutValue = useStoreSelector(ctx.layout, (l) => l)
  useIsoLayoutEffect(() => {
    for (const side of ['left', 'right'] as const) {
      if (!getSide(layoutValue, side).collapsed && ctx.reveal.get()[side]) {
        ctx.revealers[side].sync(false)
        ctx.reveal.update((r) => ({ ...r, [side]: false }))
      }
    }
  }, [layoutValue, ctx])

  const dragging = useStoreSelector(ctx.dragging, (d) => d)

  const element = useRender(
    'div',
    render,
    {
      ref: mergeRefs(rootRef, ref),
      'data-dragging': dataAttr(dragging !== null),
      style: {
        display: 'flex',
        position: 'relative',
        isolation: 'isolate',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      } satisfies CSSProperties,
      children,
    },
    rest,
  )
  return <RootContext.Provider value={ctx}>{element}</RootContext.Provider>
}

/* ------------------------------------------------------------------ Panel */

interface PanelContextValue {
  side: Side
}
const PanelContext = createContext<PanelContextValue | null>(null)

export type PanelProps = PartProps<{
  side: Side
  /** 최소 너비(px). 기본값 120 */
  minSize?: number
  /** 최대 너비(px). 기본값 제한 없음 */
  maxSize?: number
  /** layout에 이 side가 없을 때의 너비(px). 기본값 240 */
  defaultSize?: number
  /** 접힌 상태에서 hover로 여는 overlay. false면 끈다. */
  hoverOverlay?: HoverOverlayOptions | false
  children?: ReactNode
}>

export function Panel(props: PanelProps) {
  const {
    side,
    minSize = DEFAULT_CONFIG.minSize,
    maxSize = DEFAULT_CONFIG.maxSize,
    defaultSize = DEFAULT_CONFIG.defaultSize,
    hoverOverlay = {},
    render,
    ref,
    children,
    ...rest
  } = props
  const ctx = useRootContext('Panel')
  const openDelay = hoverOverlay ? (hoverOverlay.openDelay ?? 150) : 0
  const closeDelay = hoverOverlay ? (hoverOverlay.closeDelay ?? 300) : 0
  const hoverEnabled = hoverOverlay !== false

  const config = useMemo<PanelConfig>(
    () => ({
      minSize,
      maxSize,
      defaultSize,
      hoverOverlay: hoverEnabled ? { openDelay, closeDelay } : false,
    }),
    [minSize, maxSize, defaultSize, hoverEnabled, openDelay, closeDelay],
  )
  useIsoLayoutEffect(() => {
    ctx.configs.update((c) => (shallowEqual(c[side], config) ? c : { ...c, [side]: config }))
  }, [ctx, side, config])

  const sideLayout = useStoreSelector(ctx.layout, (l) => sideFromLayout(l, side, config), shallowEqual)
  const revealOpen = useStoreSelector(ctx.reveal, (r) => r[side])
  const isDragging = useStoreSelector(ctx.dragging, (d) => d === side)
  const vstate = visualState(sideLayout, revealOpen, config)
  const size = clamp(sideLayout.size, minSize, maxSize)
  const mainMin = useStoreSelector(ctx.mainMinSize, (n) => n)

  const style: CSSProperties & Record<`--${string}`, string> = {
    '--side-panel-size': `${size}px`,
    order: side === 'left' ? -1 : 1,
    flex: '0 0 auto',
    minWidth: 0,
    boxSizing: 'border-box',
  }
  if (vstate === 'expanded') {
    Object.assign(style, {
      position: 'relative',
      width: `min(${size}px, max(${minSize}px, calc(100% - ${mainMin}px)))`,
    })
  } else if (vstate === 'collapsed') {
    // 접힌 패널은 공간을 차지하지 않는다. 사용자 테두리와 padding도 0으로 둔다.
    Object.assign(style, { position: 'relative', width: 0, padding: 0, borderWidth: 0, overflow: 'hidden' })
  } else {
    Object.assign(style, {
      position: 'absolute',
      top: 0,
      bottom: 0,
      [side]: 0,
      width: `min(${size}px, 100%)`,
      zIndex: 2,
    })
  }

  const revealer = ctx.revealers[side]

  // hover로 연 overlay도 포커스 위치와 관계없이 Esc로 닫는다 (WCAG 1.4.13 dismissible).
  useEffect(() => {
    if (vstate !== 'overlay') return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const panel = ctx.panelRefs[side].current
      const hadFocus = !!panel && panel.contains(document.activeElement)
      revealer.closeNow()
      if (hadFocus) ctx.triggerRefs[side].current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [vstate, ctx, side, revealer])

  const onPointerEnter = vstate === 'overlay' ? () => revealer.enter() : undefined
  const onPointerLeave = vstate === 'overlay' ? () => revealer.leave() : undefined
  const onKeyDown =
    vstate === 'overlay'
      ? (event: KeyboardEvent) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          revealer.closeNow()
          ctx.triggerRefs[side].current?.focus()
        }
      : undefined
  const onBlur =
    vstate === 'overlay'
      ? (event: FocusEvent<HTMLElement>) => {
          const next = event.relatedTarget as Node | null
          if (next && (event.currentTarget.contains(next) || ctx.triggerRefs[side].current?.contains(next))) return
          if (next) revealer.closeNow()
        }
      : undefined

  const element = useRender(
    'div',
    render,
    {
      ref: mergeRefs(ctx.panelRefs[side], ref),
      id: ctx.panelIds[side],
      tabIndex: -1,
      inert: vstate === 'collapsed' ? true : undefined,
      'data-side': side,
      'data-state': vstate,
      'data-dragging': dataAttr(isDragging),
      style,
      onPointerEnter,
      onPointerLeave,
      onKeyDown,
      onBlur,
      children: <PanelContext.Provider value={{ side }}>{children}</PanelContext.Provider>,
    },
    rest,
  )
  return element
}

/* ------------------------------------------------------------------ Main */

export type MainProps = PartProps<{
  /** 사이드 패널을 늘릴 때 main에 남길 최소 너비(px). 기본값 0 */
  minSize?: number
  children?: ReactNode
}>

export function Main(props: MainProps) {
  const { minSize = 0, render, children, ...rest } = props
  const ctx = useRootContext('Main')
  useIsoLayoutEffect(() => {
    ctx.mainMinSize.set(minSize)
    return () => ctx.mainMinSize.set(0)
  }, [ctx, minSize])
  return useRender(
    'div',
    render,
    {
      'data-main': '',
      style: {
        position: 'relative',
        order: 0,
        flex: '1 1 0',
        minWidth: minSize,
        minHeight: 0,
      } satisfies CSSProperties,
      children,
    },
    rest,
  )
}

/* ------------------------------------------------------------------ ResizeHandle */

export type ResizeHandleProps = PartProps<{
  /** 키보드 한 단계(px). Shift를 누르면 5배. 기본값 10 */
  step?: number
}>

export function ResizeHandle(props: ResizeHandleProps) {
  const { step = 10, render, ...rest } = props
  const ctx = useRootContext('ResizeHandle')
  const panel = useContext(PanelContext)
  if (!panel) throw new Error('SidePanels.ResizeHandle must be used inside SidePanels.Panel')
  const { side } = panel
  const dir = side === 'left' ? 1 : -1
  const config = useStoreSelector(ctx.configs, (c) => c[side])
  const sideLayout = useStoreSelector(ctx.layout, (l) => sideFromLayout(l, side, config), shallowEqual)
  const size = clamp(sideLayout.size, config.minSize, config.maxSize)
  const start = useRef(0)

  const maxAllowed = useCallback(() => {
    const rootWidth = ctx.rootRef.current?.clientWidth ?? Number.POSITIVE_INFINITY
    const other: Side = side === 'left' ? 'right' : 'left'
    const otherLayout = sideFromLayout(ctx.layout.get(), other, ctx.configs.get()[other])
    const otherWidth = otherLayout.collapsed ? 0 : otherLayout.size
    return Math.min(config.maxSize, rootWidth - ctx.mainMinSize.get() - otherWidth)
  }, [ctx, side, config.maxSize])

  const apply = (next: number) => setSizeFn(ctx.layout.getCommitted(), side, clamp(next, config.minSize, maxAllowed()))

  const onPointerDown = useDragGesture({
    onStart: () => {
      start.current = size
      ctx.dragging.set(side)
    },
    onMove: ({ dx }) => ctx.layout.preview(apply(start.current + dx * dir)),
    onEnd: () => {
      ctx.dragging.set(null)
      ctx.layout.commit(ctx.layout.get(), { reason: 'drag', source: side })
    },
    onCancel: () => {
      ctx.dragging.set(null)
      ctx.layout.cancel()
    },
  })

  const onKeyDown = (event: KeyboardEvent) => {
    const amount = event.shiftKey ? step * 5 : step
    let next: SidePanelsLayout | null = null
    if (event.key === 'ArrowLeft') next = apply(size - amount * dir)
    else if (event.key === 'ArrowRight') next = apply(size + amount * dir)
    else if (event.key === 'Home') next = apply(config.minSize)
    else if (event.key === 'End') next = apply(maxAllowed())
    else if (event.key === 'Enter') next = toggleCollapsedFn(ctx.layout.getCommitted(), side)
    if (!next) return
    event.preventDefault()
    ctx.layout.commit(next, { reason: 'keyboard', source: side })
  }

  return useRender(
    'div',
    render,
    {
      role: 'separator',
      tabIndex: 0,
      'aria-orientation': 'vertical',
      'aria-controls': ctx.panelIds[side],
      'aria-valuenow': size,
      'aria-valuemin': config.minSize,
      'aria-valuemax': Number.isFinite(config.maxSize) ? config.maxSize : undefined,
      'aria-label': side === 'left' ? 'Resize left panel' : 'Resize right panel',
      'data-side': side,
      onPointerDown,
      onKeyDown,
      style: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side === 'left' ? 'right' : 'left']: 0,
        zIndex: 1,
        touchAction: 'none',
        cursor: 'col-resize',
      } satisfies CSSProperties,
    },
    rest,
  )
}

/* ------------------------------------------------------------------ HoverTrigger */

export type HoverTriggerProps = PartProps<{ side: Side }>

export function HoverTrigger(props: HoverTriggerProps) {
  const { side, render, ref, ...rest } = props
  const ctx = useRootContext('HoverTrigger')
  const config = useStoreSelector(ctx.configs, (c) => c[side])
  const collapsed = useStoreSelector(ctx.layout, (l) => sideFromLayout(l, side, config).collapsed)
  const open = useStoreSelector(ctx.reveal, (r) => r[side])
  const enabled = collapsed && config.hoverOverlay !== false
  const revealer = ctx.revealers[side]

  const element = useRender(
    'div',
    render,
    {
      ref: mergeRefs(ctx.triggerRefs[side], ref),
      role: 'button',
      tabIndex: 0,
      'aria-expanded': open,
      'aria-controls': ctx.panelIds[side],
      'aria-label': side === 'left' ? 'Show left panel' : 'Show right panel',
      'data-side': side,
      'data-state': open ? 'open' : 'closed',
      onPointerEnter: () => revealer.enter(),
      onPointerLeave: () => revealer.leave(),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          revealer.openNow()
          requestAnimationFrame(() => ctx.panelRefs[side].current?.focus())
        } else if (event.key === 'Escape' && open) {
          revealer.closeNow()
        }
      },
      style: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: 0,
        zIndex: 1,
      } satisfies CSSProperties,
    },
    rest,
  )
  return enabled ? element : null
}

/* ------------------------------------------------------------------ hooks */

export interface SidePanelsApi {
  layout: SidePanelsLayout
  toggle: (side: Side) => void
  setCollapsed: (side: Side, collapsed: boolean) => void
  setSize: (side: Side, size: number) => void
  openOverlay: (side: Side) => void
  closeOverlay: (side: Side) => void
}

export function useSidePanels(): SidePanelsApi {
  const ctx = useRootContext('useSidePanels')
  const layout = useStoreSelector(ctx.layout, (l) => l)
  return useMemo(
    () => ({
      layout,
      toggle: (side) => ctx.layout.commit((l) => toggleCollapsedFn(l, side), { reason: 'action', source: side }),
      setCollapsed: (side, collapsed) =>
        ctx.layout.commit((l) => setCollapsedFn(l, side, collapsed), { reason: 'action', source: side }),
      setSize: (side, size) => ctx.layout.commit((l) => setSizeFn(l, side, size), { reason: 'action', source: side }),
      openOverlay: (side) => ctx.revealers[side].openNow(),
      closeOverlay: (side) => ctx.revealers[side].closeNow(),
    }),
    [ctx, layout],
  )
}
