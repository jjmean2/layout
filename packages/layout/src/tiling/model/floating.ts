import type { Rect } from './types'

export interface BoundsSize {
  width: number
  height: number
}

export interface ClampOptions {
  /** 좌, 우, 아래로 bounds 안에 남아야 하는 최소 px. 'full'이면 창 전체가 안에 있어야 한다. */
  minVisible: number | 'full'
  minSize: { width: number; height: number }
}

/**
 * 그릴 때 쓸 rect. 저장된 rect는 바꾸지 않는다.
 * 위쪽 가장자리는 bounds 위로 나가지 않는다 (이동 handle이 보통 위에 있으므로).
 */
export function clampFloatingRect(rect: Rect, bounds: BoundsSize, options: ClampOptions): Rect {
  let width = Math.max(options.minSize.width, rect.width)
  let height = Math.max(options.minSize.height, rect.height)
  const { width: W, height: H } = bounds
  if (options.minVisible === 'full') {
    width = Math.min(width, W)
    height = Math.min(height, H)
    return {
      x: clampNum(rect.x, 0, W - width),
      y: clampNum(rect.y, 0, H - height),
      width,
      height,
    }
  }
  const m = options.minVisible
  return {
    x: clampNum(rect.x, Math.min(0, m - width), Math.max(0, W - m)),
    y: clampNum(rect.y, 0, Math.max(0, H - m)),
    width,
    height,
  }
}

function clampNum(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), Math.max(min, max))
}

export type ResizeEdge = 'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** edge를 dx, dy만큼 끌었을 때의 rect. 최소 크기를 지킨다. */
export function resizeRect(
  start: Rect,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  minSize: { width: number; height: number },
): Rect {
  let { x, y, width, height } = start
  if (edge.includes('right')) width = Math.max(minSize.width, start.width + dx)
  if (edge.includes('left')) {
    width = Math.max(minSize.width, start.width - dx)
    x = start.x + start.width - width
  }
  if (edge.includes('bottom')) height = Math.max(minSize.height, start.height + dy)
  if (edge.includes('top')) {
    height = Math.max(minSize.height, start.height - dy)
    y = start.y + start.height - height
  }
  return { x, y, width, height }
}
