'use client'

import {
  createContext,
  useCallback,
  Fragment,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { acquireFloatingLayer, releaseFloatingLayer } from '../internal/floating-layer.js'
import { dataAttr } from '../internal/merge-props.js'
import { createStore, shallowEqual, useStoreSelector, type Store } from '../internal/store.js'
import type { PartProps } from '../internal/types.js'
import { useDragGesture } from '../internal/use-drag-gesture.js'
import { useNameCheck } from '../internal/dev-name.js'
import { useIsoLayoutEffect } from '../internal/use-iso-layout-effect.js'
import type { LayoutChangeHandler, LayoutController } from '../internal/controller.js'
import { useLayoutController } from '../internal/use-layout-controller.js'
import { useRender } from '../internal/use-render.js'
import {
  allPaneIds,
  bringToFront as bringToFrontFn,
  clampFloatingRect,
  close as closeFn,
  computeTiledGeometry,
  dock as dockFn,
  emptyLayout,
  evaluate,
  float as floatFn,
  hide as hideFn,
  leafIds,
  minExtent,
  moveFloating,
  moveSeparator,
  neighbor,
  pathKey,
  resizeRect,
  show as showFn,
  split as splitFn,
  swap as swapFn,
  toCss,
  type Direction,
  type FocusDirection,
  type LinRect,
  type PaneId,
  type Placement,
  type Rect,
  type ResizeEdge,
  type RestoreHint,
  type SeparatorGeometry,
  type SplitOptions,
  type TiledGeometry,
  type TileNode,
  type TilingLayout,
} from './model/index.js'
import { PaneHosts } from './pane-host.js'

/* ------------------------------------------------------------------ types */

export type FloatingBounds = 'container' | 'viewport' | RefObject<HTMLElement | null>

export interface FloatingOptions {
  /** floating 창이 움직일 수 있는 범위. 기본값 'container' */
  bounds?: FloatingBounds
  /** 좌, 우, 아래로 bounds 안에 남아야 하는 최소 px. 'full'이면 창 전체. 기본값 100 */
  minVisible?: number | 'full'
  /** 창의 최소 크기. 기본값 160 x 100 */
  minSize?: { width: number; height: number }
  /** floating 레이어를 둘 요소. 기본값 document.body */
  container?: HTMLElement | null
}

interface Options {
  gap: number
  minPaneSize: number
  bounds: FloatingBounds
  minVisible: number | 'full'
  minSize: { width: number; height: number }
  container: HTMLElement | null
  keepHiddenMounted: boolean
}

/** viewport 좌표(fixed 배치) 또는 Root 내부 좌표(container 배치)의 bounds 박스 */
interface BoundsBox {
  left: number
  top: number
  width: number
  height: number
}

interface Runtime {
  focused: PaneId | null
  /** 드래그 중인 대상. separator key 또는 `pane:<id>` */
  dragging: string | null
  bounds: BoundsBox | null
}

interface TilingContextValue {
  layout: LayoutController<TilingLayout>
  options: Store<Options>
  runtime: Store<Runtime>
  hosts: PaneHosts
  rootRef: RefObject<HTMLDivElement | null>
  /** pane host들이 붙는 컨테이너. callback ref로 채운다 */
  panesElement: Store<HTMLDivElement | null>
  setPanesElement: (el: HTMLDivElement | null) => void
  geometry: (root: TileNode | null, gap: number) => TiledGeometry
  domId: (id: PaneId) => string
  getLayer: () => HTMLElement
  releaseLayer: () => void
}

const TilingContext = createContext<TilingContextValue | null>(null)
const PaneIdContext = createContext<PaneId | null>(null)

function useTilingContext(part: string): TilingContextValue {
  const ctx = useContext(TilingContext)
  if (!ctx) throw new Error(`Tiling.${part} must be used inside Tiling.Root`)
  return ctx
}

function usePaneId(part: string): PaneId {
  const id = useContext(PaneIdContext)
  if (id === null) throw new Error(`Tiling.${part} must be used inside Tiling.Panes`)
  return id
}

const usesLayer = (bounds: FloatingBounds) => bounds !== 'container'

function optionsEqual(a: Options, b: Options): boolean {
  return (
    a.gap === b.gap &&
    a.minPaneSize === b.minPaneSize &&
    a.bounds === b.bounds &&
    a.minVisible === b.minVisible &&
    a.minSize.width === b.minSize.width &&
    a.minSize.height === b.minSize.height &&
    a.container === b.container &&
    a.keepHiddenMounted === b.keepHiddenMounted
  )
}

/* ------------------------------------------------------------------ Root */

export type RootProps = PartProps<{
  layout?: TilingLayout
  defaultLayout?: TilingLayout
  /** 변경이 확정될 때(놓을 때, 키 입력, 액션) 한 번 호출된다. */
  onLayoutChange?: LayoutChangeHandler<TilingLayout>
  /** 형제 pane 사이 간격(px). separator가 이 간격의 가운데에 놓인다. 기본값 0 */
  gap?: number
  /** separator를 드래그할 때 pane의 최소 크기(px). 기본값 48 */
  minPaneSize?: number
  floating?: FloatingOptions
  /** 숨긴 pane의 내용을 mount 상태로 둘지. 기본값 true */
  keepHiddenMounted?: boolean
  children?: ReactNode
}>

export function Root(props: RootProps) {
  const {
    layout,
    defaultLayout,
    onLayoutChange,
    gap = 0,
    minPaneSize = 48,
    floating,
    keepHiddenMounted = true,
    render,
    children,
    ...rest
  } = props
  const controller = useLayoutController<TilingLayout>({ layout, defaultLayout, onLayoutChange }, emptyLayout)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const idBase = useId()

  const options: Options = {
    gap,
    minPaneSize,
    bounds: floating?.bounds ?? 'container',
    minVisible: floating?.minVisible ?? 100,
    minSize: floating?.minSize ?? { width: 160, height: 100 },
    container: floating?.container ?? null,
    keepHiddenMounted,
  }

  const [ctx] = useState<TilingContextValue>(() => {
    let cache: { root: TileNode | null; gap: number; value: TiledGeometry } | null = null
    let layer: { element: HTMLElement; container: HTMLElement } | null = null
    const optionStore = createStore<Options>(options)
    const panesElement = createStore<HTMLDivElement | null>(null)
    return {
      layout: controller,
      options: optionStore,
      panesElement,
      setPanesElement: (el) => panesElement.set(el),
      runtime: createStore<Runtime>({ focused: null, dragging: null, bounds: null }),
      hosts: new PaneHosts(),
      rootRef,
      geometry(root, g) {
        if (!cache || cache.root !== root || cache.gap !== g)
          cache = { root, gap: g, value: computeTiledGeometry(root, g) }
        return cache.value
      },
      domId: (id) => `${idBase}pane-${id}`,
      getLayer() {
        const container = optionStore.get().container ?? document.body
        if (layer && layer.container === container) return layer.element
        if (layer) releaseFloatingLayer(layer.container)
        layer = { element: acquireFloatingLayer(container), container }
        return layer.element
      },
      releaseLayer() {
        if (!layer) return
        releaseFloatingLayer(layer.container)
        layer = null
      },
    }
  })
  useIsoLayoutEffect(() => {
    ctx.options.update((prev) => (optionsEqual(prev, options) ? prev : options))
  })
  useEffect(() => () => ctx.releaseLayer(), [ctx])

  // bounds 측정. container는 Root 크기, viewport는 창 크기, 요소 ref는 그 요소의 viewport 좌표.
  // 자식의 layout effect는 부모 요소의 ref가 붙기 전에 실행되므로, ref가 비어 있으면 commit 직후에 다시 잡는다.
  const bounds = options.bounds
  useIsoLayoutEffect(() => {
    let disposed = false
    let teardown = () => {}
    const setup = (): boolean => {
      const target = bounds === 'container' ? rootRef.current : bounds === 'viewport' ? null : (bounds.current ?? null)
      const resolved = bounds === 'viewport' || target !== null
      const measure = () => {
        let box: BoundsBox
        if (bounds === 'container') {
          const el = rootRef.current
          if (!el) return
          box = { left: 0, top: 0, width: el.clientWidth, height: el.clientHeight }
        } else if (target) {
          const r = target.getBoundingClientRect()
          box = { left: r.left, top: r.top, width: r.width, height: r.height }
        } else {
          box = { left: 0, top: 0, width: document.documentElement.clientWidth, height: window.innerHeight }
        }
        ctx.runtime.update((rt) => (rt.bounds && shallowEqual(rt.bounds, box) ? rt : { ...rt, bounds: box }))
      }
      measure()
      const observer = typeof ResizeObserver !== 'undefined' && target ? new ResizeObserver(measure) : null
      if (observer && target) observer.observe(target)
      if (bounds !== 'container') window.addEventListener('resize', measure)
      teardown = () => {
        observer?.disconnect()
        window.removeEventListener('resize', measure)
      }
      return resolved
    }
    if (!setup()) {
      queueMicrotask(() => {
        if (disposed) return
        teardown()
        setup()
      })
    }
    return () => {
      disposed = true
      teardown()
    }
  }, [ctx, bounds])

  const dragging = useStoreSelector(ctx.runtime, (r) => r.dragging !== null)

  const element = useRender(
    'div',
    render,
    {
      ref: rootRef,
      'data-dragging': dataAttr(dragging),
      style: {
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
    { dragging },
  )
  return <TilingContext.Provider value={ctx}>{element}</TilingContext.Provider>
}

/* ------------------------------------------------------------------ Panes */

export interface PaneRenderInfo {
  id: PaneId
}

export interface PanesProps {
  /** pane마다 호출된다. 반환값은 pane host에 portal로 렌더된다. */
  children: (pane: PaneRenderInfo) => ReactNode
}

function arrayEqual<T>(a: readonly T[], b: readonly T[]) {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
}

/** 각 pane의 host가 놓일 곳: 'root' 또는 'layer' */
function hostTargets(layout: TilingLayout, bounds: FloatingBounds): string[] {
  const layer = usesLayer(bounds)
  return allPaneIds(layout).map((id) => {
    const floating = layout.floating.some((f) => f.id === id)
    return `${id}\u0000${floating && layer ? 'layer' : 'root'}`
  })
}

export function Panes({ children }: PanesProps) {
  const ctx = useTilingContext('Panes')
  const hosts = useStoreSelector(ctx.hosts, (h) => h)
  const hiddenIds = useStoreSelector(ctx.layout, (l) => l.hidden.map((h) => h.id), arrayEqual)
  const keepHiddenMounted = useStoreSelector(ctx.options, (o) => o.keepHiddenMounted)
  const bounds = useStoreSelector(ctx.options, (o) => o.bounds)
  const targets = useStoreSelector(ctx.layout, (l) => hostTargets(l, bounds), arrayEqual)

  const panesRef = useCallback((el: HTMLDivElement | null) => ctx.setPanesElement(el), [ctx])

  // host 생성과 이동은 여기서만 한다. 새 host가 생기면 snapshot이 바뀌어 다시 렌더된다 (pane 추가 시 렌더 1회 추가).
  useIsoLayoutEffect(() => {
    const root = ctx.panesElement.get()
    if (!root) return
    ctx.hosts.reconcile(
      targets.map((entry) => {
        const [id, target] = entry.split('\u0000') as [PaneId, string]
        return [id, target === 'layer' ? ctx.getLayer() : root] as const
      }),
    )
  }, [ctx, targets])

  // 언마운트(또는 StrictMode의 effect 재실행) 시 host를 뗀다. 노드는 유지해서 다시 붙인다.
  useEffect(() => () => ctx.hosts.detachAll(), [ctx])

  // 서버와 hydration 첫 렌더에는 host가 없으므로 portal을 렌더하지 않는다.
  // 순서는 host를 만든 순서로 고정된다. layout이 바뀌어도 portal 순서가 바뀌지 않는다.
  const hidden = keepHiddenMounted ? null : new Set(hiddenIds)
  const portals = [...hosts].map(([id, host]) =>
    hidden?.has(id)
      ? null
      : createPortal(<PaneIdContext.Provider value={id}>{children({ id })}</PaneIdContext.Provider>, host, id),
  )
  return (
    <>
      <div ref={panesRef} data-tiling-panes="" style={{ display: 'contents' }} />
      {portals}
    </>
  )
}

/* ------------------------------------------------------------------ Pane */

interface PaneView {
  placement: Placement | null
  tiled: LinRect | null
  rect: Rect | null
  z: number
}

function paneView(ctx: TilingContextValue, layout: TilingLayout, id: PaneId): PaneView {
  const gap = ctx.options.get().gap
  const tiled = ctx.geometry(layout.root, gap).panes.get(id) ?? null
  if (tiled) return { placement: 'tiled', tiled, rect: null, z: 0 }
  const index = layout.floating.findIndex((f) => f.id === id)
  if (index >= 0) return { placement: 'floating', tiled: null, rect: layout.floating[index]!.rect, z: index + 1 }
  if (layout.hidden.some((h) => h.id === id)) return { placement: 'hidden', tiled: null, rect: null, z: 0 }
  return { placement: null, tiled: null, rect: null, z: 0 }
}

/** 화면에 그려지는 floating rect (bounds 박스 기준 좌표). */
function displayedRect(rect: Rect, bounds: BoundsBox | null, options: Options): Rect {
  if (!bounds) return rect
  return clampFloatingRect(rect, bounds, { minVisible: options.minVisible, minSize: options.minSize })
}

export type PaneProps = PartProps<{ children?: ReactNode }>

export function Pane(props: PaneProps) {
  const { render, children, ...rest } = props
  const ctx = useTilingContext('Pane')
  const id = usePaneId('Pane')
  const view = useStoreSelector(ctx.layout, (l) => paneView(ctx, l, id), shallowEqual)
  const floatingView = view.placement === 'floating'
  const bounds = useStoreSelector(ctx.runtime, (r) => (floatingView ? r.bounds : null), shallowEqual)
  const options = useStoreSelector(ctx.options, (o) => o)
  const focused = useStoreSelector(ctx.runtime, (r) => r.focused === id)
  const dragging = useStoreSelector(ctx.runtime, (r) => r.dragging === `pane:${id}`)

  let style: CSSProperties
  if (view.placement === 'tiled' && view.tiled) {
    style = {
      position: 'absolute',
      left: toCss(view.tiled.left),
      top: toCss(view.tiled.top),
      width: toCss(view.tiled.width),
      height: toCss(view.tiled.height),
      boxSizing: 'border-box',
    }
  } else if (view.placement === 'floating' && view.rect) {
    const r = displayedRect(view.rect, bounds, options)
    const layer = usesLayer(options.bounds)
    style = {
      position: layer ? 'fixed' : 'absolute',
      left: (layer ? (bounds?.left ?? 0) : 0) + r.x,
      top: (layer ? (bounds?.top ?? 0) : 0) + r.y,
      width: r.width,
      height: r.height,
      zIndex: layer ? view.z : 10 + view.z,
      pointerEvents: 'auto',
      boxSizing: 'border-box',
    }
  } else {
    style = { display: 'none' }
  }

  const paneNameCheck = useNameCheck(
    `Tiling.Pane (${id})`,
    'Pass aria-label; separators and window handles are labelled by it.',
  )

  const onPointerDownCapture = () => {
    if (!ctx.runtime.get().focused || ctx.runtime.get().focused !== id) {
      ctx.runtime.update((r) => ({ ...r, focused: id }))
    }
    if (view.placement === 'floating') ctx.layout.commit((l) => bringToFrontFn(l, id), { reason: 'action', source: id })
  }
  const onFocusCapture = () => {
    if (ctx.runtime.get().focused !== id) ctx.runtime.update((r) => ({ ...r, focused: id }))
  }

  return useRender(
    'div',
    render,
    {
      checkRef: paneNameCheck,
      id: ctx.domId(id),
      tabIndex: -1,
      // tiled: 이름 붙은 group, floating: 비모달 창(dialog). 표준 APG 패턴은 없어 선례를 따른다 (docs/remediation.md C-3).
      role: view.placement === 'floating' ? 'dialog' : 'group',
      'aria-modal': view.placement === 'floating' ? false : undefined,
      inert: view.placement === 'hidden' ? true : undefined,
      'data-pane-id': id,
      'data-placement': view.placement ?? undefined,
      'data-focused': dataAttr(focused),
      'data-dragging': dataAttr(dragging),
      style,
      onPointerDownCapture,
      onFocusCapture,
      children,
    },
    rest,
    { id, placement: view.placement, focused, dragging },
  )
}

/* ------------------------------------------------------------------ floating handles */

function floatingRectGetter(ctx: TilingContextValue, id: PaneId) {
  return () => {
    const entry = ctx.layout.get().floating.find((f) => f.id === id)
    if (!entry) return null
    return displayedRect(entry.rect, ctx.runtime.get().bounds, ctx.options.get())
  }
}

export type MoveHandleProps = PartProps<{
  /** 키보드 한 단계(px). Shift를 누르면 5배. 기본값 10 */
  step?: number
  children?: ReactNode
}>

/** floating 창 이동 손잡이. floating 상태가 아니면 children만 렌더한다. */
export function MoveHandle(props: MoveHandleProps) {
  const { step = 10, render, children, ...rest } = props
  const ctx = useTilingContext('MoveHandle')
  const id = usePaneId('MoveHandle')
  const floating = useStoreSelector(ctx.layout, (l) => l.floating.some((f) => f.id === id))
  const current = floatingRectGetter(ctx, id)
  const start = useRef<Rect | null>(null)

  const onPointerDown = useDragGesture({
    threshold: 3,
    onStart: () => {
      start.current = current()
      if (!start.current) return false
      ctx.runtime.update((r) => ({ ...r, dragging: `pane:${id}` }))
    },
    onMove: ({ dx, dy }) => {
      const s = start.current
      if (!s) return
      ctx.layout.preview(moveFloating(ctx.layout.getCommitted(), id, { ...s, x: s.x + dx, y: s.y + dy }))
    },
    onEnd: () => {
      ctx.runtime.update((r) => ({ ...r, dragging: null }))
      const shown = current()
      ctx.layout.commit(shown ? moveFloating(ctx.layout.get(), id, shown) : ctx.layout.get(), {
        reason: 'drag',
        source: id,
      })
    },
    onCancel: () => {
      ctx.runtime.update((r) => ({ ...r, dragging: null }))
      ctx.layout.cancel()
    },
  })

  const onKeyDown = (event: KeyboardEvent) => {
    const s = current()
    if (!s) return
    const d = event.shiftKey ? step * 5 : step
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, -d],
      ArrowDown: [0, d],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const next = displayedRect(
      { ...s, x: s.x + move[0], y: s.y + move[1] },
      ctx.runtime.get().bounds,
      ctx.options.get(),
    )
    ctx.layout.commit((l) => moveFloating(l, id, next), { reason: 'keyboard', source: id })
  }

  const moveNameCheck = useNameCheck('Tiling.MoveHandle', 'Pass aria-label (e.g. "Move <pane name>").', true)

  // floating이 아니면 손잡이 동작 없이 children만 감싼다. 같은 요소를 유지해서 remount가 없다.
  return useRender(
    'div',
    render,
    floating
      ? {
          checkRef: moveNameCheck,
          role: 'button',
          tabIndex: 0,
          'data-move-handle': '',
          onPointerDown,
          onKeyDown,
          style: { touchAction: 'none', cursor: 'move' } satisfies CSSProperties,
          children,
        }
      : { children },
    rest,
    { floating },
  )
}

const RESIZE_CURSOR: Record<ResizeEdge, string> = {
  top: 'ns-resize',
  bottom: 'ns-resize',
  left: 'ew-resize',
  right: 'ew-resize',
  'top-left': 'nwse-resize',
  'bottom-right': 'nwse-resize',
  'top-right': 'nesw-resize',
  'bottom-left': 'nesw-resize',
}

function edgeStyle(edge: ResizeEdge): CSSProperties {
  const style: CSSProperties = { position: 'absolute', touchAction: 'none', cursor: RESIZE_CURSOR[edge], zIndex: 1 }
  const vertical = edge.startsWith('top') ? 'top' : edge.startsWith('bottom') ? 'bottom' : null
  const horizontal = edge.endsWith('left') ? 'left' : edge.endsWith('right') ? 'right' : null
  if (vertical) style[vertical] = 0
  if (horizontal) style[horizontal] = 0
  if (!vertical) Object.assign(style, { top: 0, bottom: 0 })
  if (!horizontal) Object.assign(style, { left: 0, right: 0 })
  return style
}

export type ResizeHandleProps = PartProps<{
  /** 끌 가장자리. 기본값 'bottom-right' */
  edge?: ResizeEdge
  step?: number
}>

/** floating 창 크기 손잡이. floating 상태가 아니면 렌더하지 않는다. */
export function ResizeHandle(props: ResizeHandleProps) {
  const { edge = 'bottom-right', step = 10, render, ...rest } = props
  const ctx = useTilingContext('ResizeHandle')
  const id = usePaneId('ResizeHandle')
  const floating = useStoreSelector(ctx.layout, (l) => l.floating.some((f) => f.id === id))
  const current = floatingRectGetter(ctx, id)
  const start = useRef<Rect | null>(null)

  const resizeNameCheck = useNameCheck('Tiling.ResizeHandle', 'Pass aria-label (e.g. "Resize <pane name>").')
  const onPointerDown = useDragGesture({
    onStart: () => {
      start.current = current()
      if (!start.current) return false
      ctx.runtime.update((r) => ({ ...r, dragging: `pane:${id}` }))
    },
    onMove: ({ dx, dy }) => {
      const s = start.current
      if (!s) return
      ctx.layout.preview(
        moveFloating(ctx.layout.getCommitted(), id, resizeRect(s, edge, dx, dy, ctx.options.get().minSize)),
      )
    },
    onEnd: () => {
      ctx.runtime.update((r) => ({ ...r, dragging: null }))
      const shown = current()
      ctx.layout.commit(shown ? moveFloating(ctx.layout.get(), id, shown) : ctx.layout.get(), {
        reason: 'drag',
        source: id,
      })
    },
    onCancel: () => {
      ctx.runtime.update((r) => ({ ...r, dragging: null }))
      ctx.layout.cancel()
    },
  })

  const onKeyDown = (event: KeyboardEvent) => {
    const s = current()
    if (!s) return
    const d = event.shiftKey ? step * 5 : step
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, -d],
      ArrowDown: [0, d],
    }
    const delta = deltas[event.key]
    if (!delta) return
    event.preventDefault()
    const next = resizeRect(s, edge, delta[0], delta[1], ctx.options.get().minSize)
    ctx.layout.commit((l) => moveFloating(l, id, displayedRect(next, ctx.runtime.get().bounds, ctx.options.get())), {
      reason: 'keyboard',
      source: id,
    })
  }

  const element = useRender(
    'div',
    render,
    {
      checkRef: resizeNameCheck,
      role: 'button',
      tabIndex: 0,
      'data-edge': edge,
      onPointerDown,
      onKeyDown,
      style: edgeStyle(edge),
    },
    rest,
    { edge },
  )
  return floating ? element : null
}

/* ------------------------------------------------------------------ Separators */

export interface SeparatorInfo {
  key: string
  path: number[]
  index: number
  direction: Direction
}

export interface SeparatorsProps {
  children: (separator: SeparatorInfo) => ReactNode
}

export function Separators({ children }: SeparatorsProps) {
  const ctx = useTilingContext('Separators')
  const keys = useStoreSelector(
    ctx.layout,
    (l) => ctx.geometry(l.root, ctx.options.get().gap).separators.map((s) => s.key),
    arrayEqual,
  )
  const gap = useStoreSelector(ctx.options, (o) => o.gap)
  const infos = useMemo(() => {
    const geometry = ctx.geometry(ctx.layout.get().root, gap)
    return keys.map((key) => {
      const s = geometry.separators.find((x) => x.key === key)!
      return { key, path: s.path, index: s.index, direction: s.direction }
    })
  }, [ctx, keys, gap])
  return (
    <>
      {infos.map((info) => (
        <Fragment key={info.key}>{children(info)}</Fragment>
      ))}
    </>
  )
}

export type SeparatorProps = PartProps<{
  separator: SeparatorInfo
  /** 키보드 한 단계(px). Shift를 누르면 5배. 기본값 10 */
  step?: number
}>

function splitAt(root: TileNode | null, path: number[]) {
  let node = root
  for (const i of path) node = node && node.type === 'split' ? (node.children[i] ?? null) : null
  return node && node.type === 'split' ? node : null
}

export function Separator(props: SeparatorProps) {
  const { separator, step = 10, render, ...rest } = props
  const ctx = useTilingContext('Separator')
  const gap = useStoreSelector(ctx.options, (o) => o.gap)
  const geometry = useStoreSelector(
    ctx.layout,
    (l) => ctx.geometry(l.root, gap).separators.find((s) => s.key === separator.key) ?? null,
  )
  const ratio = useStoreSelector(ctx.layout, (l) => {
    const node = splitAt(l.root, separator.path)
    const a = node?.sizes[separator.index] ?? 0
    const b = node?.sizes[separator.index + 1] ?? 0
    return a + b > 0 ? Math.round((a / (a + b)) * 100) : 50
  })
  const controls = useStoreSelector(ctx.layout, (l) => {
    const child = splitAt(l.root, separator.path)?.children[separator.index]
    return child ? ctx.domId(leafIds(child)[0]!) : undefined
  })
  const dragging = useStoreSelector(ctx.runtime, (r) => r.dragging === separator.key)
  const drag = useRef<{ startSizes: number[]; available: number; min: [number, number] } | null>(null)
  const row = separator.direction === 'row'

  const measure = () => {
    const layout = ctx.layout.getCommitted()
    const node = splitAt(layout.root, separator.path)
    const split = ctx.geometry(layout.root, gap).splits.get(pathKey(separator.path))
    const rootEl = ctx.rootRef.current
    if (!node || !split || !rootEl) return null
    const W = rootEl.clientWidth
    const H = rootEl.clientHeight
    const extent = row ? evaluate(split.box.width, W) : evaluate(split.box.height, H)
    const available = Math.max(1, extent - gap * (node.children.length - 1))
    const { minPaneSize } = ctx.options.get()
    const axis = row ? 'x' : 'y'
    const min: [number, number] = [
      minExtent(node.children[separator.index]!, axis, minPaneSize, gap) / available,
      minExtent(node.children[separator.index + 1]!, axis, minPaneSize, gap) / available,
    ]
    return { startSizes: node.sizes.slice(), available, min }
  }

  const onPointerDown = useDragGesture({
    onStart: () => {
      drag.current = measure()
      if (!drag.current) return false
      ctx.runtime.update((r) => ({ ...r, dragging: separator.key }))
    },
    onMove: ({ dx, dy }) => {
      const d = drag.current
      if (!d) return
      const delta = (row ? dx : dy) / d.available
      ctx.layout.preview(
        moveSeparator(ctx.layout.getCommitted(), separator.path, separator.index, d.startSizes, delta, d.min),
      )
    },
    onEnd: () => {
      ctx.runtime.update((r) => ({ ...r, dragging: null }))
      ctx.layout.commit(ctx.layout.get(), { reason: 'drag', source: separator.key })
    },
    onCancel: () => {
      ctx.runtime.update((r) => ({ ...r, dragging: null }))
      ctx.layout.cancel()
    },
  })

  const onKeyDown = (event: KeyboardEvent) => {
    const keys = row ? { minus: 'ArrowLeft', plus: 'ArrowRight' } : { minus: 'ArrowUp', plus: 'ArrowDown' }
    let px: number | null = null
    const amount = event.shiftKey ? step * 5 : step
    if (event.key === keys.minus) px = -amount
    else if (event.key === keys.plus) px = amount
    else if (event.key === 'Home') px = Number.NEGATIVE_INFINITY
    else if (event.key === 'End') px = Number.POSITIVE_INFINITY
    if (px === null) return
    event.preventDefault()
    const d = measure()
    if (!d) return
    const delta = Number.isFinite(px) ? px / d.available : px > 0 ? 1 : -1
    ctx.layout.commit(
      moveSeparator(ctx.layout.getCommitted(), separator.path, separator.index, d.startSizes, delta, d.min),
      {
        reason: 'keyboard',
        source: separator.key,
      },
    )
  }

  const style: CSSProperties = geometry
    ? row
      ? {
          position: 'absolute',
          left: toCss(geometry.center),
          top: toCss(geometry.start),
          height: toCss(geometry.length),
          transform: 'translateX(-50%)',
          cursor: 'col-resize',
          touchAction: 'none',
          zIndex: 1,
        }
      : {
          position: 'absolute',
          top: toCss(geometry.center),
          left: toCss(geometry.start),
          width: toCss(geometry.length),
          transform: 'translateY(-50%)',
          cursor: 'row-resize',
          touchAction: 'none',
          zIndex: 1,
        }
    : { display: 'none' }

  return useRender(
    'div',
    render,
    {
      role: 'separator',
      tabIndex: 0,
      'aria-orientation': row ? 'vertical' : 'horizontal',
      'aria-valuenow': ratio,
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-controls': controls,
      // APG: 기본(primary) pane을 이름으로 쓴다
      'aria-labelledby':
        rest['aria-label'] !== undefined || rest['aria-labelledby'] !== undefined ? undefined : controls,
      'data-dragging': dataAttr(dragging),
      onPointerDown,
      onKeyDown,
      style,
    },
    rest,
    { direction: separator.direction, dragging },
  )
}

/* ------------------------------------------------------------------ hooks */

export interface TilingApi {
  layout: TilingLayout
  focused: PaneId | null
  split: (target: PaneId | null, newId: PaneId, direction: Direction, options?: SplitOptions) => void
  close: (id: PaneId) => void
  hide: (id: PaneId) => void
  show: (id: PaneId) => void
  /** rect가 없으면 현재 화면 위치에서 조금 어긋난 자리에 띄운다. */
  float: (id: PaneId, rect?: Rect) => void
  dock: (id: PaneId, target?: RestoreHint) => void
  swap: (a: PaneId, b: PaneId) => void
  bringToFront: (id: PaneId) => void
  focus: (id: PaneId) => void
  focusNeighbor: (direction: FocusDirection) => void
}

function defaultFloatRect(ctx: TilingContextValue, id: PaneId): Rect {
  const el = document.getElementById(ctx.domId(id))
  const { bounds, minSize } = ctx.options.get()
  const rootEl = ctx.rootRef.current
  const boundsRect =
    bounds === 'container'
      ? (rootEl?.getBoundingClientRect() ?? null)
      : bounds === 'viewport'
        ? new DOMRect(0, 0, window.innerWidth, window.innerHeight)
        : (bounds.current?.getBoundingClientRect() ?? null)
  if (!el || !boundsRect)
    return { x: 40, y: 40, width: Math.max(minSize.width, 480), height: Math.max(minSize.height, 320) }
  const r = el.getBoundingClientRect()
  const width = Math.max(minSize.width, Math.min(r.width, boundsRect.width * 0.6))
  const height = Math.max(minSize.height, Math.min(r.height, boundsRect.height * 0.6))
  return { x: r.left - boundsRect.left + 24, y: r.top - boundsRect.top + 24, width, height }
}

function focusPane(ctx: TilingContextValue, id: PaneId) {
  ctx.runtime.update((r) => (r.focused === id ? r : { ...r, focused: id }))
  requestAnimationFrame(() => document.getElementById(ctx.domId(id))?.focus({ preventScroll: true }))
}

type TilingActions = Omit<TilingApi, 'layout' | 'focused'>

function createActions(ctx: TilingContextValue): TilingActions {
  return {
    split: (target, newId, direction, options) =>
      ctx.layout.commit((l) => splitFn(l, target, newId, direction, options), { reason: 'action', source: newId }),
    close: (id) => ctx.layout.commit((l) => closeFn(l, id), { reason: 'action', source: id }),
    hide: (id) => ctx.layout.commit((l) => hideFn(l, id), { reason: 'action', source: id }),
    show: (id) => ctx.layout.commit((l) => showFn(l, id), { reason: 'action', source: id }),
    float: (id, rect) => {
      const r = rect ?? defaultFloatRect(ctx, id)
      ctx.layout.commit((l) => floatFn(l, id, r), { reason: 'action', source: id })
      focusPane(ctx, id)
    },
    dock: (id, target) => {
      ctx.layout.commit((l) => dockFn(l, id, target), { reason: 'action', source: id })
      focusPane(ctx, id)
    },
    swap: (a, b) => ctx.layout.commit((l) => swapFn(l, a, b), { reason: 'action', source: a }),
    bringToFront: (id) => ctx.layout.commit((l) => bringToFrontFn(l, id), { reason: 'action', source: id }),
    focus: (id) => focusPane(ctx, id),
    focusNeighbor: (direction) => {
      const from = ctx.runtime.get().focused
      if (!from) return
      const l = ctx.layout.get()
      const next = neighbor(ctx.geometry(l.root, ctx.options.get().gap), from, direction)
      if (next) focusPane(ctx, next)
    },
  }
}

const actionsCache = new WeakMap<TilingContextValue, TilingActions>()
function actionsFor(ctx: TilingContextValue): TilingActions {
  let actions = actionsCache.get(ctx)
  if (!actions) {
    actions = createActions(ctx)
    actionsCache.set(ctx, actions)
  }
  return actions
}

/** layout 전체를 구독한다. layout이 바뀔 때마다 리렌더된다. */
export function useTiling(): TilingApi {
  const ctx = useTilingContext('useTiling')
  const layout = useStoreSelector(ctx.layout, (l) => l)
  const focused = useStoreSelector(ctx.runtime, (r) => r.focused)
  return useMemo<TilingApi>(() => ({ layout, focused, ...actionsFor(ctx) }), [ctx, layout, focused])
}

export interface PaneApi {
  id: PaneId
  placement: Placement | null
  focused: boolean
  float: (rect?: Rect) => void
  dock: (target?: RestoreHint) => void
  hide: () => void
  close: () => void
  split: (newId: PaneId, direction: Direction, options?: SplitOptions) => void
  bringToFront: () => void
}

/** 현재 pane의 placement와 포커스만 구독한다. separator 드래그 중에는 리렌더되지 않는다. */
export function usePane(): PaneApi {
  const ctx = useTilingContext('usePane')
  const id = usePaneId('usePane')
  const placement = useStoreSelector(ctx.layout, (l) => paneView(ctx, l, id).placement)
  const focused = useStoreSelector(ctx.runtime, (r) => r.focused === id)
  return useMemo<PaneApi>(() => {
    const a = actionsFor(ctx)
    return {
      id,
      placement,
      focused,
      float: (rect) => a.float(id, rect),
      dock: (target) => a.dock(id, target),
      hide: () => a.hide(id),
      close: () => a.close(id),
      split: (newId, direction, options) => a.split(id, newId, direction, options),
      bringToFront: () => a.bringToFront(id),
    }
  }, [ctx, id, placement, focused])
}
