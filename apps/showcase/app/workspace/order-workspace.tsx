'use client'

import {
  Tiling,
  createLayout,
  pane,
  show,
  splitNode,
  usePane,
  useTiling,
  type FocusDirection,
  type TilingLayout,
} from '@justwonder/layout/tiling'
import { useEffect, useMemo, useState } from 'react'
import { ORDERS, won, type Order } from '@/components/orders'
import { usePersistedState } from '@/components/persisted-state'
import { useInspector, useShell } from '@/components/shell-context'

const TITLES: Record<string, string> = {
  orders: '주문 목록',
  detail: '주문 상세',
  activity: '활동 로그',
  memo: '메모',
  preview: '명세서 미리보기',
}

const INITIAL: TilingLayout = createLayout(
  splitNode(
    'row',
    [
      splitNode('column', [pane('orders'), pane('activity')], [0.7, 0.3]),
      splitNode('column', [pane('detail'), pane('preview')], [0.45, 0.55]),
    ],
    [0.55, 0.45],
  ),
  { hidden: [{ id: 'memo' }] },
)

export function OrderWorkspace() {
  const { workspaceRef } = useShell()
  const [layout, setLayout, reset] = usePersistedState('showcase:workspace', INITIAL)
  const [selected, setSelected] = useState<Order>(ORDERS[0]!)

  const inspector = useMemo(
    () => (
      <>
        <h2>Tiling layout</h2>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          floating 창의 경계는 GNB 아래 작업 영역(셸의 SidePanels Root)이다. 창을 사이드 패널 위로 옮겨 보라.
        </p>
        <pre>{JSON.stringify(layout, null, 2)}</pre>
      </>
    ),
    [layout],
  )
  useInspector(inspector)

  return (
    <div className="fill">
      <div className="toolbar">
        <span className="label">주문 관리</span>
        {layout.hidden.map((h) => (
          <button key={h.id} className="btn" onClick={() => setLayout((l) => show(l, h.id))}>
            + {TITLES[h.id] ?? h.id}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>Alt + 방향키: pane 이동</span>
        <button className="btn" onClick={reset}>
          레이아웃 초기화
        </button>
      </div>
      <div className="fill-body">
        <Tiling.Root
          className="tiling"
          layout={layout}
          onLayoutChange={setLayout}
          gap={8}
          minPaneSize={120}
          floating={{ bounds: workspaceRef, minSize: { width: 280, height: 160 } }}
          style={{ padding: 0 }}
        >
          <FocusShortcuts />
          <Tiling.Panes>
            {({ id }) => (
              <Tiling.Pane className="pane" aria-label={TITLES[id]}>
                <PaneHead title={TITLES[id] ?? id} />
                <div className="pane-body">
                  <PaneContent id={id} selected={selected} onSelect={setSelected} />
                </div>
                <Tiling.ResizeHandle edge="bottom-right" className="grip" aria-label={`${TITLES[id]} 창 크기`} />
              </Tiling.Pane>
            )}
          </Tiling.Panes>
          <Tiling.Separators>
            {(separator) => <Tiling.Separator separator={separator} className="split-bar" aria-label="pane 경계" />}
          </Tiling.Separators>
        </Tiling.Root>
      </div>
    </div>
  )
}

/** Alt + 방향키로 인접 pane에 포커스를 옮긴다. 키 바인딩은 사용하는 쪽이 정한다. */
function FocusShortcuts() {
  const { focusNeighbor } = useTiling()
  useEffect(() => {
    const keys: Record<string, FocusDirection> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    }
    const onKey = (e: KeyboardEvent) => {
      const direction = keys[e.key]
      if (!e.altKey || !direction) return
      e.preventDefault()
      focusNeighbor(direction)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusNeighbor])
  return null
}

function PaneHead({ title }: { title: string }) {
  const pane = usePane()
  const floating = pane.placement === 'floating'
  return (
    <div className="pane-head">
      <Tiling.MoveHandle className="pane-title" aria-label={`${title} 창 이동`}>
        {title}
      </Tiling.MoveHandle>
      <button
        className="pane-act"
        title={floating ? '제자리로' : '창으로 띄우기'}
        onClick={() => (floating ? pane.dock() : pane.float())}
      >
        {floating ? '⇲' : '⧉'}
      </button>
      <button className="pane-act" title="숨기기" onClick={pane.hide}>
        –
      </button>
    </div>
  )
}

function PaneContent({ id, selected, onSelect }: { id: string; selected: Order; onSelect: (o: Order) => void }) {
  switch (id) {
    case 'orders':
      return (
        <table className="data">
          <thead>
            <tr>
              <th>주문번호</th>
              <th>고객</th>
              <th>품목</th>
              <th>금액</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {ORDERS.map((o) => (
              <tr key={o.id} aria-selected={o.id === selected.id} onClick={() => onSelect(o)}>
                <td>{o.id}</td>
                <td>{o.customer}</td>
                <td>{o.item}</td>
                <td>{won(o.amount)}</td>
                <td>
                  <span className="badge">{o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'detail':
      return (
        <form className="form" key={selected.id} onSubmit={(e) => e.preventDefault()}>
          <label>
            주문번호
            <input defaultValue={selected.id} readOnly />
          </label>
          <label>
            고객
            <input defaultValue={selected.customer} />
          </label>
          <label>
            상태
            <select defaultValue={selected.status}>
              <option>접수</option>
              <option>배송 중</option>
              <option>완료</option>
              <option>취소</option>
            </select>
          </label>
          <label>
            요청 사항
            <textarea rows={3} placeholder="창으로 띄워도 입력 내용이 유지된다" />
          </label>
        </form>
      )
    case 'activity':
      return (
        <pre className="log">
          {`[09:12] ${selected.id} 주문 접수\n[09:40] 재고 확인\n[10:05] 출고 지시\n[13:22] 택배사 인계\n[15:47] 고객 문의 응대`}
        </pre>
      )
    case 'memo':
      return (
        <div className="form">
          <textarea rows={8} placeholder="숨겼다가 다시 열어도 내용이 유지된다" />
        </div>
      )
    case 'preview':
      return (
        <iframe
          title="명세서 미리보기"
          style={{ border: 0, width: '100%', height: '100%', background: '#fff' }}
          srcDoc={`<body style="font:13px system-ui;margin:20px;color:#222"><h3 style="margin:0 0 12px">거래명세서</h3><p>${selected.id} · ${selected.customer}</p><p>${selected.item} — ${won(selected.amount)}</p></body>`}
        />
      )
    default:
      return null
  }
}
