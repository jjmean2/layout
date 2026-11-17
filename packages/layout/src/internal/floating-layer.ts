/**
 * 문서당(컨테이너당) 하나의 floating 레이어. viewport 범위의 floating 창이 여기에 놓인다.
 * 레이어 자체는 포인터 이벤트를 받지 않고, 창(pane)만 받는다.
 */
const layers = new Map<HTMLElement, { element: HTMLElement; refs: number }>()

export function acquireFloatingLayer(container: HTMLElement = document.body): HTMLElement {
  const existing = layers.get(container)
  if (existing) {
    existing.refs++
    return existing.element
  }
  const element = document.createElement('div')
  element.setAttribute('data-layout-floating-layer', '')
  Object.assign(element.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: 'var(--layout-floating-z, 40)',
  } satisfies Partial<CSSStyleDeclaration>)
  container.appendChild(element)
  layers.set(container, { element, refs: 1 })
  return element
}

export function releaseFloatingLayer(container: HTMLElement = document.body): void {
  const entry = layers.get(container)
  if (!entry) return
  entry.refs--
  if (entry.refs > 0) return
  // 다른 창이 아직 남아 있으면 지우지 않는다 (StrictMode의 effect 재실행 등).
  if (entry.element.childNodes.length > 0) {
    entry.refs = 0
    return
  }
  entry.element.remove()
  layers.delete(container)
}
