import { moveNode } from '../internal/move-node.js'
import type { Listener, Readable } from '../internal/store.js'
import type { PaneId } from './model/index.js'

export type HostMap = ReadonlyMap<PaneId, HTMLElement>

/**
 * pane마다 라이브러리가 소유하는 DOM 노드(host). pane 내용은 이 노드에 portal로 렌더된다.
 * portal 대상이 바뀌지 않으므로 pane이 어디로 옮겨져도 React는 remount하지 않는다.
 *
 * DOM 작업(생성, 이동, 제거)은 layout effect에서 `reconcile`로만 한다.
 * React는 렌더 중에 불변 snapshot(`get()`)만 읽는다. snapshot의 순서는 host를 만든 순서다.
 */
export class PaneHosts implements Readable<HostMap> {
  private hosts = new Map<PaneId, HTMLElement>()
  private snapshot: HostMap = new Map()
  private listeners = new Set<Listener>()

  get = (): HostMap => this.snapshot

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 각 pane의 host가 정해진 부모 아래에 있게 한다. 없는 host는 만들고, 사라진 pane의 host는 지운다.
   * host 집합이 바뀌었을 때만 snapshot을 새로 만든다.
   */
  reconcile(entries: ReadonlyArray<readonly [PaneId, HTMLElement]>): void {
    let changed = false
    const alive = new Set<PaneId>()
    for (const [id, parent] of entries) {
      alive.add(id)
      let host = this.hosts.get(id)
      if (!host) {
        host = document.createElement('div')
        host.style.display = 'contents'
        host.setAttribute('data-tiling-host', id)
        this.hosts.set(id, host)
        changed = true
      }
      if (host.parentNode !== parent) moveNode(host, parent)
    }
    for (const [id, host] of this.hosts) {
      if (alive.has(id)) continue
      host.remove()
      this.hosts.delete(id)
      changed = true
    }
    if (changed) {
      this.snapshot = new Map(this.hosts)
      for (const listener of this.listeners) listener()
    }
  }

  /** 모든 host를 문서에서 뗀다. 노드와 snapshot은 유지해서 다시 붙일 수 있게 한다. */
  detachAll(): void {
    for (const host of this.hosts.values()) host.remove()
  }
}
