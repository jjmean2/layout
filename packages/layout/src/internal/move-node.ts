type MoveBefore = (node: Node, child: Node | null) => void

export function supportsMoveBefore(parent: Node): boolean {
  return typeof (parent as Node & { moveBefore?: MoveBefore }).moveBefore === 'function'
}

/**
 * node를 parent의 끝으로 옮긴다.
 * moveBefore가 있으면 iframe, 포커스, 애니메이션 상태가 유지된다.
 * 없으면 appendChild를 쓰고, 포커스와 스크롤 위치를 직접 복원한다 (iframe은 재로드된다).
 */
export function moveNode(node: HTMLElement, parent: HTMLElement): void {
  if (node.parentNode === parent) return
  const p = parent as HTMLElement & { moveBefore?: MoveBefore }
  if (supportsMoveBefore(parent) && node.isConnected && parent.isConnected) {
    try {
      p.moveBefore!(node, null)
      return
    } catch {
      // 다른 document 등. 아래 경로로 진행
    }
  }
  const active = document.activeElement
  const focused = active instanceof HTMLElement && node.contains(active) ? active : null
  const scrolls: Array<[Element, number, number]> = []
  if (node.isConnected) {
    for (const el of node.querySelectorAll('*')) {
      if (el.scrollTop !== 0 || el.scrollLeft !== 0) scrolls.push([el, el.scrollTop, el.scrollLeft])
    }
  }
  parent.appendChild(node)
  for (const [el, top, left] of scrolls) {
    el.scrollTop = top
    el.scrollLeft = left
  }
  focused?.focus({ preventScroll: true })
}
