import { useCallback, type RefCallback } from 'react'

// React 라이브러리 관례: 번들러가 `process.env.NODE_ENV`를 문자열로 치환한다 (Next, Vite, webpack 모두).
declare const process: { env: { NODE_ENV?: string } }
const isDev = process.env.NODE_ENV !== 'production'
const warned = new Set<string>()

function labelOf(el: Element): string {
  return (el.getAttribute('aria-label') ?? '').trim()
}

/** aria-labelledby가 가리키는 요소가 자기 이름(aria-label)을 가졌는지 */
function labelledByHasName(el: Element): boolean | null {
  const ids = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)
  if (ids.length === 0) return null
  return ids.some((id) => {
    const target = el.ownerDocument.getElementById(id)
    if (!target) return false
    // 참조된 요소의 aria-label이 이름이 된다. 없으면 그 요소의 모든 텍스트가 이름이 되므로 이름이 없는 것으로 본다.
    return labelOf(target) !== '' || (target.getAttribute('aria-labelledby') ?? '') !== '' || target.tagName === 'LABEL'
  })
}

export function hasAccessibleName(el: Element, nameFromContent: boolean): boolean {
  if (labelOf(el) !== '') return true
  const byRef = labelledByHasName(el)
  if (byRef !== null) return byRef
  if ((el.getAttribute('title') ?? '').trim() !== '') return true
  return nameFromContent && (el.textContent ?? '').trim() !== ''
}

/**
 * 개발 모드에서 part 요소에 접근성 이름이 없으면 한 번 경고한다. 라이브러리는 문구를 갖지 않으므로
 * 이름은 사용하는 쪽이 aria-label 또는 aria-labelledby로 준다 (docs/remediation.md C-4).
 * 요소가 붙을 때(commit) 검사한다. 렌더 중에는 아무것도 하지 않는다.
 */
export function useNameCheck(part: string, hint: string, nameFromContent = false): RefCallback<Element> {
  return useCallback(
    (el: Element | null) => {
      if (!isDev || !el) return
      // 같은 commit에서 붙는 aria-labelledby 대상이 아직 없을 수 있으므로 한 프레임 뒤에 검사한다.
      const id = requestAnimationFrame(() => {
        if (!el.isConnected || hasAccessibleName(el, nameFromContent)) return
        const key = `${part}:${hint}`
        if (warned.has(key)) return
        warned.add(key)
        console.warn(`[@justwonder/layout] ${part} has no accessible name. ${hint}`)
      })
      return () => cancelAnimationFrame(id)
    },
    [part, hint, nameFromContent],
  )
}
