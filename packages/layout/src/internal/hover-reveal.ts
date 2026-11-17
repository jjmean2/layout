export interface HoverRevealOptions {
  openDelay: number
  closeDelay: number
  onChange: (open: boolean) => void
}

/**
 * hover로 여는 영역의 타이머 관리. 트리거와 패널을 하나의 hover 영역으로 다룬다.
 * 포인터가 트리거에서 패널로 옮겨 가는 동안 closeDelay 안에 들어오면 닫히지 않는다.
 */
export function createHoverReveal(getOptions: () => HoverRevealOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let open = false

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  const set = (next: boolean) => {
    clear()
    if (open === next) return
    open = next
    getOptions().onChange(next)
  }

  return {
    isOpen: () => open,
    /** 포인터가 트리거나 패널에 들어옴 */
    enter() {
      clear()
      if (open) return
      timer = setTimeout(() => set(true), getOptions().openDelay)
    },
    /** 포인터가 트리거나 패널을 벗어남 */
    leave() {
      clear()
      if (!open) return
      timer = setTimeout(() => set(false), getOptions().closeDelay)
    },
    openNow: () => set(true),
    closeNow: () => set(false),
    /** 외부 상태와 맞춘다 (onChange를 호출하지 않음) */
    sync(next: boolean) {
      clear()
      open = next
    },
    dispose: clear,
  }
}

export type HoverReveal = ReturnType<typeof createHoverReveal>
