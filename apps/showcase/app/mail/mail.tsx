'use client'

import { SidePanels } from '@justwonder/layout/side-panels'
import { useState } from 'react'
import { useInspector } from '@/components/shell-context'

const MAILS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  from: ['구매팀', '재무팀', '물류센터', '영업 1팀'][i % 4]!,
  subject: ['발주서 확인 요청', '11월 정산 일정', '입고 지연 안내', '견적 회신'][i % 4]!,
  date: `11.${String(18 - (i % 10)).padStart(2, '0')}`,
}))

const inspector = (
  <>
    <h2>같은 종류의 중첩</h2>
    <p style={{ margin: 0, color: 'var(--muted)' }}>
      셸의 SidePanels.Main 안에 또 하나의 SidePanels가 있다. 안쪽 손잡이를 끌어도 바깥 패널은 그대로이고, 각 part는 가장
      가까운 Root의 상태를 쓴다.
    </p>
  </>
)

/** uncontrolled(defaultLayout) 사용 예 */
export function Mail() {
  const [selected, setSelected] = useState(0)
  useInspector(inspector)
  const mail = MAILS[selected]!
  return (
    <SidePanels.Root defaultLayout={{ left: { size: 300, collapsed: false }, right: { size: 260, collapsed: true } }}>
      <SidePanels.Panel side="left" className="side" minSize={220} maxSize={480} data-testid="mail-list">
        <ul className="side-inner mail-list" role="listbox" aria-label="받은 메일">
          {MAILS.map((m) => (
            <li key={m.id} role="option" aria-selected={m.id === selected} onClick={() => setSelected(m.id)}>
              {m.subject}
              <small>
                {m.from} · {m.date}
              </small>
            </li>
          ))}
        </ul>
        <SidePanels.ResizeHandle className="sash" aria-label="메일 목록 너비" data-testid="mail-handle" />
      </SidePanels.Panel>
      <SidePanels.Main className="main" minSize={320}>
        <article className="reader">
          <h1 style={{ marginTop: 0 }}>{mail.subject}</h1>
          <p style={{ color: 'var(--muted)' }}>
            {mail.from} · {mail.date}
          </p>
          <p>오른쪽 가장자리에 마우스를 올리면 첨부 파일 패널이 overlay로 나타난다.</p>
        </article>
      </SidePanels.Main>
      <SidePanels.Panel side="right" className="side" minSize={200}>
        <div className="side-inner inspector">
          <h2>첨부 파일</h2>
          <p>발주서_2411.xlsx</p>
          <p>견적서.pdf</p>
        </div>
        <SidePanels.ResizeHandle className="sash" aria-label="첨부 패널 너비" />
      </SidePanels.Panel>
      <SidePanels.HoverTrigger side="right" className="edge-zone" aria-label="첨부 파일 열기" />
    </SidePanels.Root>
  )
}
