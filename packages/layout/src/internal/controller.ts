import { deepEqual, type Listener } from './store.js'

/** 변경이 일어난 원인 */
export type ChangeReason = 'drag' | 'keyboard' | 'action'

export interface ChangeDetails {
  reason: ChangeReason
  /** 변경을 일으킨 part. 예: separator key, pane id, side */
  source?: string
}

export type LayoutChangeHandler<L> = (layout: L, details: ChangeDetails) => void

export interface ControllerProps<L> {
  /** controlled 값. undefined면 uncontrolled */
  layout: L | undefined
  onLayoutChange: LayoutChangeHandler<L> | undefined
}

/**
 * Root 하나의 layout 상태를 소유한다. React에 의존하지 않는다.
 *
 * - 액션은 `getCommitted()`에서 출발하고 committed를 즉시 갱신한다. 같은 tick의 여러 commit이 이어서 적용된다.
 * - controlled 모드에서 commit은 낙관적이다. 다음 `syncProps`에서 부모의 결정을 반영한다.
 *   - prop이 바뀌었으면 (수락, 또는 다른 값으로 변경) prop을 채택한다.
 *   - prop이 그대로이고 낙관적 commit이 있었으면 (거절, 무시) 마지막 prop으로 되돌린다.
 * - draft는 드래그 중 미리보기다. 화면 값은 draft ?? committed.
 */
export class LayoutController<L> {
  private committed: L
  private draft: L | null = null
  private controlled: boolean
  private lastProp: L | undefined
  private pending = false
  private onLayoutChange: LayoutChangeHandler<L> | undefined
  private listeners = new Set<Listener>()
  private requestRender: () => void = () => {}

  constructor(initial: L, props: ControllerProps<L>) {
    this.controlled = props.layout !== undefined
    this.committed = props.layout ?? initial
    this.lastProp = props.layout
    this.onLayoutChange = props.onLayoutChange
  }

  /** 화면에 보이는 값 */
  get = (): L => this.draft ?? this.committed

  getCommitted = (): L => this.committed

  isDrafting = (): boolean => this.draft !== null

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** controlled 모드에서 부모가 응답하지 않을 때 Root를 다시 렌더하게 하는 함수를 등록한다. */
  setRenderRequest(fn: () => void): void {
    this.requestRender = fn
  }

  /** Root가 렌더될 때마다 (layout effect에서) 호출한다. */
  syncProps(props: ControllerProps<L>): void {
    this.onLayoutChange = props.onLayoutChange
    const before = this.get()
    if (props.layout !== undefined) {
      if (!this.controlled || !Object.is(props.layout, this.lastProp)) {
        // 처음 controlled가 되었거나 부모가 새 값을 줬다 (수락 또는 변경)
        this.committed = props.layout
      } else if (this.pending) {
        // 부모가 낙관적 commit을 받아들이지 않았다
        this.committed = props.layout
      }
      this.controlled = true
      this.lastProp = props.layout
      this.pending = false
    } else {
      this.controlled = false
      this.lastProp = undefined
      this.pending = false
    }
    if (!Object.is(before, this.get())) this.emit()
  }

  preview(next: L): void {
    if (Object.is(next, this.draft)) return
    this.draft = next
    this.emit()
  }

  cancel(): void {
    if (this.draft === null) return
    this.draft = null
    this.emit()
  }

  commit(update: L | ((prev: L) => L), details: ChangeDetails): void {
    const base = this.committed
    const next = typeof update === 'function' ? (update as (prev: L) => L)(base) : update
    const hadDraft = this.draft !== null
    this.draft = null
    if (deepEqual(next, base)) {
      if (hadDraft) this.emit()
      return
    }
    this.committed = next
    if (this.controlled) {
      this.pending = true
      this.requestRender()
    }
    this.emit()
    this.onLayoutChange?.(next, details)
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }
}
