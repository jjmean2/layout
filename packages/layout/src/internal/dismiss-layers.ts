/**
 * 닫을 수 있는 레이어(hover overlay 등)의 문서 수준 stack. Escape는 맨 위 레이어 하나만 닫는다.
 *
 * 다른 라이브러리와의 공존:
 * - 이 stack은 문서 keydown을 bubble 단계에서 듣는다. Radix의 DismissableLayer처럼 capture 단계에서 Escape를
 *   처리하고 preventDefault하는 레이어(대개 나중에 열린 dialog, popover)가 먼저 처리한다.
 * - 이미 처리된 이벤트(defaultPrevented)와 IME 조합 중의 Escape는 무시한다.
 * - 처리하면 preventDefault로 다른 쪽에 알린다.
 */
interface Layer {
  dismiss: () => void
}

const stack: Layer[] = []
let listening = false

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  if (event.isComposing || event.keyCode === 229) return
  const top = stack[stack.length - 1]
  if (!top) return
  event.preventDefault()
  top.dismiss()
}

/** 레이어를 맨 위에 올린다. 돌려받은 함수로 내린다. */
export function pushDismissLayer(dismiss: () => void): () => void {
  const layer: Layer = { dismiss }
  stack.push(layer)
  if (!listening) {
    document.addEventListener('keydown', onKeyDown)
    listening = true
  }
  return () => {
    const index = stack.indexOf(layer)
    if (index >= 0) stack.splice(index, 1)
    if (stack.length === 0 && listening) {
      document.removeEventListener('keydown', onKeyDown)
      listening = false
    }
  }
}
