import { moveNode } from '../internal/move-node.js'
import type { PaneId } from './model/index.js'

/**
 * pane마다 라이브러리가 소유하는 DOM 노드(host). pane 내용은 이 노드에 portal로 렌더된다.
 * portal 대상이 바뀌지 않으므로 pane이 어디로 옮겨져도 React는 remount하지 않는다.
 * StrictMode의 effect 재실행에서도 같은 노드를 계속 쓴다.
 */
export class PaneHosts {
  private hosts = new Map<PaneId, HTMLElement>()

  get(id: PaneId, initialParent: HTMLElement | null): HTMLElement {
    let host = this.hosts.get(id)
    if (!host) {
      host = document.createElement('div')
      host.style.display = 'contents'
      host.setAttribute('data-tiling-host', id)
      this.hosts.set(id, host)
      if (initialParent) initialParent.appendChild(host)
    }
    return host
  }

  /** host를 parent로 옮긴다. 이미 거기 있으면 아무것도 하지 않는다. */
  place(id: PaneId, parent: HTMLElement): void {
    const host = this.hosts.get(id)
    if (host && host.parentNode !== parent) moveNode(host, parent)
  }

  /** 더 이상 없는 pane의 host를 지운다. */
  prune(alive: Set<PaneId>): void {
    for (const [id, host] of this.hosts) {
      if (alive.has(id)) continue
      host.remove()
      this.hosts.delete(id)
    }
  }

  /** 모든 host를 문서에서 뗀다. 노드는 유지한다 (다시 붙일 수 있도록). */
  detachAll(): void {
    for (const host of this.hosts.values()) host.remove()
  }
}
