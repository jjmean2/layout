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
import { dataAttr } from '../internal/merge-props.js'
import { createStore, shallowEqual, useStoreSelector, type Store } from '../internal/store.js'
import type { PartProps } from '../internal/types.js'
import { useDragGesture } from '../internal/use-drag-gesture.js'
import { pushDismissLayer } from '../internal/dismiss-layers.js'
import { useNameCheck } from '../internal/dev-name.js'
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
  separatorRefs: Record<Side, RefObject<HTMLElement | null>>
  /** 측정한 side별 가용 최대 너비(px). Separator의 aria-valuemax에 쓴다 */
  available: Store<Record<Side, number | null>>
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
  const { layout, defaultLayout, onLayoutChange, render, children, ...rest } = props
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
      separatorRefs: { left: { current: null }, right: { current: null } },
      available: createStore<Record<Side, number | null>>({ left: null, right: null }),
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

  // Separator의 aria-valuemax에 쓸 가용 너비를 측정한다. 렌더 없이 store만 갱신한다.
  useIsoLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      const width = el.clientWidth
      const layoutNow = ctx.layout.get()
      const configs = ctx.configs.get()
      const widthOf = (side: Side) => {
        const s = sideFromLayout(layoutNow, side, configs[side])
        return s.collapsed ? 0 : s.size
      }
      const next = {
        left: Math.max(0, Math.min(configs.left.maxSize, width - ctx.mainMinSize.get() - widthOf('right'))),
        right: Math.max(0, Math.min(configs.right.maxSize, width - ctx.mainMinSize.get() - widthOf('left'))),
      }
      ctx.available.update((prev) => (shallowEqual(prev, next) ? prev : next))
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(el)
    const unsubscribe = [
      ctx.layout.subscribe(measure),
      ctx.mainMinSize.subscribe(measure),
      ctx.configs.subscribe(measure),
    ]
    return () => {
      observer?.disconnect()
      for (const u of unsubscribe) u()
    }
  }, [ctx])

  const dragging = useStoreSelector(ctx.dragging, (d) => d)

  const element = useRender(
    'div',
    render,
    {
      ref: rootRef,
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
    { dragging: dragging !== null },
  )
  return <RootContext.Provider value={ctx}>{element}</RootContext.Provider>
}

/* ------------------------------------------------------------------ Panel */

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
  const nameCheck = useNameCheck(
    `SidePanels.Panel (${side})`,
    'Give the panel an aria-label; its Separator is labelled by it.',
  )

  // 열린 overlay는 dismiss layer stack에 올라간다. Escape는 맨 위 레이어만 닫는다 (WCAG 1.4.13 dismissible).
  useEffect(() => {
    if (vstate !== 'overlay') return
    return pushDismissLayer(() => {
      const panel = ctx.panelRefs[side].current
      const hadFocus = !!panel && panel.contains(document.activeElement)
      revealer.closeNow()
      if (hadFocus) (ctx.triggerRefs[side].current ?? ctx.separatorRefs[side].current)?.focus()
    })
  }, [vstate, ctx, side, revealer])

  const onPointerEnter = vstate === 'overlay' ? () => revealer.enter() : undefined
  const onPointerLeave = vstate === 'overlay' ? () => revealer.leave() : undefined
  const onBlur =
    vstate === 'overlay'
      ? (event: FocusEvent<HTMLElement>) => {
          const next = event.relatedTarget as Node | null
          if (
            next &&
            (event.currentTarget.contains(next) ||
              ctx.triggerRefs[side].current?.contains(next) ||
              ctx.separatorRefs[side].current?.contains(next))
          )
            return
          if (next) revealer.closeNow()
        }
      : undefined

  const element = useRender(
    'div',
    render,
    {
      ref: ctx.panelRefs[side],
      checkRef: nameCheck,
      id: ctx.panelIds[side],
      tabIndex: -1,
      inert: vstate === 'collapsed' ? true : undefined,
      'data-side': side,
      'data-state': vstate,
      'data-dragging': dataAttr(isDragging),
      style,
      onPointerEnter,
      onPointerLeave,
      onBlur,
      children,
    },
    rest,
    { side, state: vstate, dragging: isDragging },
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
    {},
  )
}

/* ------------------------------------------------------------------ Separator */

export type SeparatorProps = PartProps<{
  side: Side
  /** 키보드 한 단계(px). Shift를 누르면 5배. 기본값 10 */
  step?: number
}>

/**
 * 패널과 Main 사이의 window splitter (WAI-ARIA APG). Root의 직계 자식으로 둔다.
 * 패널이 접혀도 Root 가장자리에 남아 포커스를 유지하고, Enter로 다시 펼 수 있다.
 * - 드래그: 최소 너비의 절반보다 좁히면 접히고, 접힌 상태에서 끌면 펼쳐진다.
 * - 키보드: 방향키, Home(최소), End(최대), Enter(접기 전환).
 * - 이름: 기본으로 패널을 aria-labelledby로 가리킨다. 패널에 aria-label을 준다.
 */
export function Separator(props: SeparatorProps) {
  const { side, step = 10, render, ...rest } = props
  const ctx = useRootContext('Separator')
  const dir = side === 'left' ? 1 : -1
  const config = useStoreSelector(ctx.configs, (c) => c[side])
  const sideLayout = useStoreSelector(ctx.layout, (l) => sideFromLayout(l, side, config), shallowEqual)
  const isDragging = useStoreSelector(ctx.dragging, (d) => d === side)
  const mainMin = useStoreSelector(ctx.mainMinSize, (n) => n)
  const available = useStoreSelector(ctx.available, (a) => a[side])
  const size = clamp(sideLayout.size, config.minSize, config.maxSize)
  const collapsed = sideLayout.collapsed
  const start = useRef(0)
  const nameCheck = useNameCheck(
    `SidePanels.Separator (${side})`,
    'Give its panel an aria-label, or pass aria-label to the Separator.',
  )

  const maxAllowed = useCallback(() => {
    const rootWidth = ctx.rootRef.current?.clientWidth ?? Number.POSITIVE_INFINITY
    const other: Side = side === 'left' ? 'right' : 'left'
    const otherLayout = sideFromLayout(ctx.layout.get(), other, ctx.configs.get()[other])
    const otherWidth = otherLayout.collapsed ? 0 : otherLayout.size
    return Math.min(config.maxSize, rootWidth - ctx.mainMinSize.get() - otherWidth)
  }, [ctx, side, config.maxSize])

  /** 끌어서 정한 너비. 최소 너비의 절반보다 좁으면 접는다. */
  const fromWidth = (width: number): SidePanelsLayout => {
    const base = ctx.layout.getCommitted()
    if (width < config.minSize / 2) return setCollapsedFn(base, side, true)
    return setCollapsedFn(setSizeFn(base, side, clamp(width, config.minSize, maxAllowed())), side, false)
  }

  const onPointerDown = useDragGesture({
    onStart: () => {
      start.current = collapsed ? 0 : size
      ctx.dragging.set(side)
    },
    onMove: ({ dx }) => ctx.layout.preview(fromWidth(start.current + dx * dir)),
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
    const current = collapsed ? 0 : size
    let next: SidePanelsLayout | null = null
    if (event.key === 'ArrowLeft') next = fromWidth(Math.max(config.minSize, current - amount * dir))
    else if (event.key === 'ArrowRight') next = fromWidth(Math.max(config.minSize, current + amount * dir))
    else if (event.key === 'Home') next = fromWidth(config.minSize)
    else if (event.key === 'End') next = fromWidth(maxAllowed())
    else if (event.key === 'Enter') next = toggleCollapsedFn(ctx.layout.getCommitted(), side)
    if (!next) return
    event.preventDefault()
    ctx.layout.commit(next, { reason: 'keyboard', source: side })
  }

  // 값은 패널 너비(px). 최대값은 maxSize, 없으면 측정한 가용 너비. 측정 전(서버, 첫 렌더)에는 현재 너비로 둔다.
  const valueMax = Number.isFinite(config.maxSize) ? config.maxSize : Math.max(available ?? 0, size)
  const hoverable = collapsed && config.hoverOverlay !== false
  const hasOwnName = rest['aria-label'] !== undefined || rest['aria-labelledby'] !== undefined
  const offset = collapsed ? '0px' : `min(${size}px, max(${config.minSize}px, calc(100% - ${mainMin}px)))`

  return useRender(
    'div',
    render,
    {
      ref: ctx.separatorRefs[side],
      checkRef: nameCheck,
      role: 'separator',
      tabIndex: 0,
      'aria-orientation': 'vertical',
      'aria-controls': ctx.panelIds[side],
      'aria-labelledby': hasOwnName ? undefined : ctx.panelIds[side],
      'aria-valuemin': 0,
      'aria-valuemax': valueMax,
      'aria-valuenow': collapsed ? 0 : size,
      'aria-valuetext': collapsed ? undefined : `${size}px`,
      'data-side': side,
      'data-state': collapsed ? 'collapsed' : 'expanded',
      'data-dragging': dataAttr(isDragging),
      onPointerDown,
      onKeyDown,
      // 접힌 상태의 Separator는 가장자리를 덮으므로 HoverTrigger와 같은 hover 영역으로 다룬다.
      onPointerEnter: hoverable ? () => ctx.revealers[side].enter() : undefined,
      onPointerLeave: hoverable ? () => ctx.revealers[side].leave() : undefined,
      style: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: offset,
        // 펼친 상태에서는 경계선 가운데에, 접힌 상태에서는 Root 가장자리 안쪽에 붙는다 (Root 밖은 잘린다).
        transform: collapsed ? 'none' : side === 'left' ? 'translateX(-50%)' : 'translateX(50%)',
        zIndex: 3,
        touchAction: 'none',
        cursor: 'col-resize',
      } satisfies CSSProperties,
    },
    rest,
    { side, size, collapsed, dragging: isDragging },
  )
}

/* ------------------------------------------------------------------ HoverTrigger */

export type HoverTriggerProps = PartProps<{ side: Side }>

/**
 * 접힌 패널을 overlay로 여는 버튼. 포인터를 올리면 지연 후 열리고, 클릭(탭, 스크린 리더 활성화)하면 바로 열고 닫는다.
 * 키보드 사용자는 Separator의 Enter로 패널을 펴므로 tab 순서에서는 빠진다.
 */
export function HoverTrigger(props: HoverTriggerProps) {
  const { side, render, ...rest } = props
  const ctx = useRootContext('HoverTrigger')
  const config = useStoreSelector(ctx.configs, (c) => c[side])
  const collapsed = useStoreSelector(ctx.layout, (l) => sideFromLayout(l, side, config).collapsed)
  const open = useStoreSelector(ctx.reveal, (r) => r[side])
  const enabled = collapsed && config.hoverOverlay !== false
  const revealer = ctx.revealers[side]
  const nameCheck = useNameCheck(`SidePanels.HoverTrigger (${side})`, 'Pass aria-label (e.g. "Show navigation").', true)

  const element = useRender(
    'button',
    render,
    {
      ref: ctx.triggerRefs[side],
      checkRef: nameCheck,
      type: 'button',
      tabIndex: -1,
      'aria-expanded': open,
      'aria-controls': ctx.panelIds[side],
      'data-side': side,
      'data-state': open ? 'open' : 'closed',
      onPointerEnter: () => revealer.enter(),
      onPointerLeave: () => revealer.leave(),
      onClick: () => (revealer.isOpen() ? revealer.closeNow() : revealer.openNow()),
      style: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: 0,
        zIndex: 1,
        padding: 0,
        border: 0,
        background: 'transparent',
      } satisfies CSSProperties,
    },
    rest,
    { side, open },
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
