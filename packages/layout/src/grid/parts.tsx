'use client'

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { dataAttr } from '../internal/merge-props.js'
import { createStore, shallowEqual, useStoreSelector, type Store } from '../internal/store.js'
import type { PartProps } from '../internal/types.js'
import { useDragGesture } from '../internal/use-drag-gesture.js'
import { useIsoLayoutEffect } from '../internal/use-iso-layout-effect.js'
import type { LayoutChangeHandler, LayoutController } from '../internal/controller.js'
import { useLayoutController } from '../internal/use-layout-controller.js'
import { useRender } from '../internal/use-render.js'
import {
  addItem as addItemFn,
  moveItem as moveItemFn,
  removeItem as removeItemFn,
  resizeItem as resizeItemFn,
  snapSize,
  stepSize,
  type Collision,
  type GridItemLayout,
  type GridLayout,
  type GridOptions,
  type SizeConstraints,
} from './model/index.js'

interface Drag {
  id: string
  kind: 'move' | 'resize'
  start: GridItemLayout
  dx: number
  dy: number
}

interface GridRootOptions extends GridOptions {
  gap: number
  rowHeight: number | 'square'
}

interface GridContextValue {
  layout: LayoutController<GridLayout>
  options: Store<GridRootOptions>
  drag: Store<Drag | null>
  /** 측정한 셀 너비(px). 측정 전에는 0 */
  cellWidth: RefObject<number>
  constraints: Map<string, SizeConstraints>
}

const GridContext = createContext<GridContextValue | null>(null)
const ItemContext = createContext<string | null>(null)

function useGridContext(part: string) {
  const ctx = useContext(GridContext)
  if (!ctx) throw new Error(`Grid.${part} must be used inside Grid.Root`)
  return ctx
}

function useItemId(part: string) {
  const id = useContext(ItemContext)
  if (id === null) throw new Error(`Grid.${part} must be used inside Grid.Item`)
  return id
}

/* ------------------------------------------------------------------ Root */

export type RootProps = PartProps<{
  layout?: GridLayout
  defaultLayout?: GridLayout
  /** 변경이 확정될 때(놓을 때, 키 입력, 액션) 한 번 호출된다. */
  onLayoutChange?: LayoutChangeHandler<GridLayout>
  /** 열 수 */
  cols: number
  /** 행 높이(px) 또는 'square'(셀 너비와 같게). 기본값 'square' */
  rowHeight?: number | 'square'
  /** 셀 간격(px). 기본값 0 */
  gap?: number
  /** 기본값 'push' */
  collision?: Collision
  /** 위쪽 빈칸을 자동으로 메울지. 기본값 false */
  compact?: boolean
  children?: ReactNode
}>

export function Root(props: RootProps) {
  const {
    layout,
    defaultLayout,
    onLayoutChange,
    cols,
    rowHeight = 'square',
    gap = 0,
    collision = 'push',
    compact = false,
    render,
    children,
    style: userStyle,
    ...rest
  } = props
  const controller = useLayoutController<GridLayout>({ layout, defaultLayout, onLayoutChange }, [])
  const rootRef = useRef<HTMLDivElement | null>(null)
  const cellWidth = useRef(0)
  const [measured, setMeasured] = useState(false)

  const [ctx] = useState<GridContextValue>(() => ({
    layout: controller,
    options: createStore<GridRootOptions>({ cols, gap, rowHeight, collision, compact }),
    drag: createStore<Drag | null>(null),
    cellWidth,
    constraints: new Map(),
  }))
  // 옵션은 렌더 중이 아니라 layout effect에서 store에 반영한다.
  useIsoLayoutEffect(() => {
    const next = { cols, gap, rowHeight, collision, compact }
    ctx.options.update((prev) => (shallowEqual(prev, next) ? prev : next))
  }, [ctx, cols, gap, rowHeight, collision, compact])

  // 셀 너비를 CSS 변수 하나로만 갱신한다. 컨테이너 resize 중에는 React 렌더가 없다.
  useIsoLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let first = true
    const measure = () => {
      const { cols: c, gap: g } = ctx.options.get()
      const width = el.clientWidth
      const cell = Math.max(0, (width - g * (c - 1)) / c)
      if (cell === cellWidth.current) return
      cellWidth.current = cell
      el.style.setProperty('--grid-cell-w', `${cell}px`)
      // 첫 측정도 크기 변화로 표시한다. 사용자의 transition이 0에서 실제 위치로 움직이지 않게 한다.
      el.setAttribute('data-resizing', '')
      if (first) {
        first = false
        setMeasured(true)
      }
      clearTimeout(timer)
      timer = setTimeout(() => el.removeAttribute('data-resizing'), 150)
    }
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(el)
    return () => {
      observer?.disconnect()
      clearTimeout(timer)
    }
  }, [cols, gap])

  const dragging = useStoreSelector(ctx.drag, (d) => d !== null)

  const style: CSSProperties & Record<`--${string}`, string> = {
    ...(userStyle as CSSProperties),
    '--grid-cols': String(cols),
    '--grid-gap': `${gap}px`,
    '--grid-row-h': rowHeight === 'square' ? 'var(--grid-cell-w)' : `${rowHeight}px`,
    position: 'relative',
    isolation: 'isolate',
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    overflow: 'auto',
    scrollbarGutter: 'stable',
    padding: 0,
    visibility: measured ? undefined : 'hidden',
  }

  const element = useRender(
    'div',
    render,
    {
      ref: rootRef,
      'data-dragging': dataAttr(dragging),
      style,
      children,
    },
    rest,
    { dragging },
  )
  return <GridContext.Provider value={ctx}>{element}</GridContext.Provider>
}

/* ------------------------------------------------------------------ geometry */

const cellX = (n: number) => `calc((var(--grid-cell-w) + var(--grid-gap)) * ${n})`
const cellY = (n: number) => `calc((var(--grid-row-h) + var(--grid-gap)) * ${n})`
const spanW = (w: number, extra = 0) => `calc(var(--grid-cell-w) * ${w} + var(--grid-gap) * ${w - 1} + ${extra}px)`
const spanH = (h: number, extra = 0) => `calc(var(--grid-row-h) * ${h} + var(--grid-gap) * ${h - 1} + ${extra}px)`

function boxStyle(item: Pick<GridItemLayout, 'x' | 'y' | 'w' | 'h'>, dx = 0, dy = 0, dw = 0, dh = 0): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    boxSizing: 'border-box',
    width: spanW(item.w, dw),
    height: spanH(item.h, dh),
    transform: `translate(calc(${cellX(item.x)} + ${dx}px), calc(${cellY(item.y)} + ${dy}px))`,
  }
}

function cellSize(ctx: GridContextValue) {
  const { rowHeight, gap } = ctx.options.get()
  const w = ctx.cellWidth.current
  const h = rowHeight === 'square' ? w : rowHeight
  return { stepX: w + gap, stepY: h + gap }
}

/* ------------------------------------------------------------------ Item */

export type ItemProps = PartProps<
  {
    id: string
    children?: ReactNode
  } & SizeConstraints
>

export function Item(props: ItemProps) {
  const { id, minW, maxW, minH, maxH, sizes, render, children, ...rest } = props
  const ctx = useGridContext('Item')
  const entry = useStoreSelector(ctx.layout, (l) => l.find((i) => i.id === id) ?? null, shallowEqual)
  const drag = useStoreSelector(ctx.drag, (d) => (d && d.id === id ? d : null), shallowEqual)

  const constraints = useMemo<SizeConstraints>(
    () => ({ minW, maxW, minH, maxH, sizes }),
    [minW, maxW, minH, maxH, sizes],
  )
  useIsoLayoutEffect(() => {
    ctx.constraints.set(id, constraints)
    return () => {
      ctx.constraints.delete(id)
    }
  }, [ctx, id, constraints])

  let style: CSSProperties
  if (!entry) style = { display: 'none' }
  else if (drag?.kind === 'move') style = { ...boxStyle(drag.start, drag.dx, drag.dy), zIndex: 2 }
  else if (drag?.kind === 'resize') style = { ...boxStyle(drag.start, 0, 0, drag.dx, drag.dy), zIndex: 2 }
  else style = boxStyle(entry)

  return useRender(
    'div',
    render,
    {
      'data-grid-item': id,
      'data-dragging': dataAttr(drag !== null),
      'data-drag-kind': drag?.kind,
      'data-static': dataAttr(entry?.static),
      style,
      children: <ItemContext.Provider value={id}>{children}</ItemContext.Provider>,
    },
    rest,
    { id, dragging: drag !== null, dragKind: drag?.kind ?? null, static: !!entry?.static },
  )
}

/* ------------------------------------------------------------------ handles */

function useItemDrag(ctx: GridContextValue, id: string, kind: Drag['kind']) {
  const last = useRef<string>('')
  return useDragGesture({
    threshold: kind === 'move' ? 3 : 0,
    onStart: () => {
      const start = ctx.layout.getCommitted().find((i) => i.id === id)
      if (!start || start.static || ctx.cellWidth.current <= 0) return false
      last.current = ''
      ctx.drag.set({ id, kind, start, dx: 0, dy: 0 })
    },
    onMove: ({ dx, dy }) => {
      const d = ctx.drag.get()
      if (!d) return
      ctx.drag.set({ ...d, dx, dy })
      const { stepX, stepY } = cellSize(ctx)
      const opts = ctx.options.get()
      const committed = ctx.layout.getCommitted()
      let next: GridLayout
      let key: string
      if (kind === 'move') {
        const x = Math.round(d.start.x + dx / stepX)
        const y = Math.round(d.start.y + dy / stepY)
        key = `${x},${y}`
        if (key === last.current) return
        next = moveItemFn(committed, id, x, y, opts)
      } else {
        const [w, h] = snapSize(
          d.start.w + dx / stepX,
          d.start.h + dy / stepY,
          ctx.constraints.get(id) ?? {},
          opts.cols,
        )
        key = `${w}x${h}`
        if (key === last.current) return
        next = resizeItemFn(committed, id, w, h, opts)
      }
      last.current = key
      ctx.layout.preview(next)
    },
    onEnd: () => {
      ctx.drag.set(null)
      ctx.layout.commit(ctx.layout.get(), { reason: 'drag', source: id })
    },
    onCancel: () => {
      ctx.drag.set(null)
      ctx.layout.cancel()
    },
  })
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

export type MoveHandleProps = PartProps<{ children?: ReactNode }>

export function MoveHandle(props: MoveHandleProps) {
  const { render, children, ...rest } = props
  const ctx = useGridContext('MoveHandle')
  const id = useItemId('MoveHandle')
  const onPointerDown = useItemDrag(ctx, id, 'move')
  const onKeyDown = (event: KeyboardEvent) => {
    const arrow = ARROWS[event.key]
    if (!arrow) return
    event.preventDefault()
    ctx.layout.commit(
      (l) => {
        const item = l.find((i) => i.id === id)
        return item ? moveItemFn(l, id, item.x + arrow[0], item.y + arrow[1], ctx.options.get()) : l
      },
      { reason: 'keyboard', source: id },
    )
  }
  return useRender(
    'div',
    render,
    {
      tabIndex: 0,
      'aria-label': 'Move item',
      'aria-roledescription': 'move handle',
      onPointerDown,
      onKeyDown,
      style: { touchAction: 'none', cursor: 'grab' } satisfies CSSProperties,
      children,
    },
    rest,
    {},
  )
}

export type ResizeHandleProps = PartProps<{ children?: ReactNode }>

/** 아이템 오른쪽 아래 모서리에 놓이는 크기 손잡이 */
export function ResizeHandle(props: ResizeHandleProps) {
  const { render, children, ...rest } = props
  const ctx = useGridContext('ResizeHandle')
  const id = useItemId('ResizeHandle')
  const onPointerDown = useItemDrag(ctx, id, 'resize')
  const onKeyDown = (event: KeyboardEvent) => {
    const arrow = ARROWS[event.key]
    if (!arrow) return
    event.preventDefault()
    ctx.layout.commit(
      (l) => {
        const item = l.find((i) => i.id === id)
        if (!item) return l
        const opts = ctx.options.get()
        const [w, h] = stepSize(item.w, item.h, ctx.constraints.get(id) ?? {}, opts.cols, arrow[0], arrow[1])
        return resizeItemFn(l, id, w, h, opts)
      },
      { reason: 'keyboard', source: id },
    )
  }
  return useRender(
    'div',
    render,
    {
      tabIndex: 0,
      'aria-label': 'Resize item',
      onPointerDown,
      onKeyDown,
      style: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        touchAction: 'none',
        cursor: 'nwse-resize',
        zIndex: 1,
      } satisfies CSSProperties,
      children,
    },
    rest,
    {},
  )
}

/* ------------------------------------------------------------------ Placeholder */

export type PlaceholderProps = PartProps<{ children?: ReactNode }>

/** 드래그 중에 놓일 자리를 표시한다. 드래그 중이 아니면 렌더하지 않는다. */
export function Placeholder(props: PlaceholderProps) {
  const { render, children, ...rest } = props
  const ctx = useGridContext('Placeholder')
  const id = useStoreSelector(ctx.drag, (d) => d?.id ?? null)
  const kind = useStoreSelector(ctx.drag, (d) => d?.kind ?? null)
  const target = useStoreSelector(ctx.layout, (l) => (id ? (l.find((i) => i.id === id) ?? null) : null), shallowEqual)
  const element = useRender(
    'div',
    render,
    {
      'aria-hidden': true,
      'data-drag-kind': kind ?? undefined,
      style: target ? { ...boxStyle(target), zIndex: 1, pointerEvents: 'none' } : undefined,
      children,
    },
    rest,
    { dragKind: kind },
  )
  return target ? element : null
}

/* ------------------------------------------------------------------ hooks */

export interface GridApi {
  layout: GridLayout
  moveItem: (id: string, x: number, y: number) => void
  resizeItem: (id: string, w: number, h: number) => void
  addItem: (item: Omit<GridItemLayout, 'x' | 'y'> & Partial<Pick<GridItemLayout, 'x' | 'y'>>) => void
  removeItem: (id: string) => void
}

export function useGrid(): GridApi {
  const ctx = useGridContext('useGrid')
  const layout = useStoreSelector(ctx.layout, (l) => l)
  return useMemo<GridApi>(
    () => ({
      layout,
      moveItem: (id, x, y) =>
        ctx.layout.commit((l) => moveItemFn(l, id, x, y, ctx.options.get()), { reason: 'action', source: id }),
      resizeItem: (id, w, h) =>
        ctx.layout.commit((l) => resizeItemFn(l, id, w, h, ctx.options.get()), { reason: 'action', source: id }),
      addItem: (item) =>
        ctx.layout.commit((l) => addItemFn(l, item, ctx.options.get().cols), { reason: 'action', source: item.id }),
      removeItem: (id) => ctx.layout.commit((l) => removeItemFn(l, id), { reason: 'action', source: id }),
    }),
    [ctx, layout],
  )
}
