'use client'

import { Grid, addItem, removeItem, type GridLayout } from '@justwonder/layout/grid'
import { useMemo } from 'react'
import { usePersistedState } from '@/components/persisted-state'
import { useInspector } from '@/components/shell-context'

type Kind = 'kpi' | 'chart' | 'notice' | 'todo'

const SIZES: Record<Kind, Array<[number, number]>> = {
  kpi: [
    [2, 1],
    [2, 2],
  ],
  chart: [
    [4, 2],
    [4, 3],
    [6, 3],
  ],
  notice: [
    [2, 2],
    [4, 2],
  ],
  todo: [
    [2, 2],
    [2, 3],
    [4, 3],
  ],
}

const COLS = 8

const INITIAL: GridLayout = [
  { id: 'kpi:sales', x: 0, y: 0, w: 2, h: 1 },
  { id: 'kpi:orders', x: 2, y: 0, w: 2, h: 1 },
  { id: 'notice:main', x: 4, y: 0, w: 4, h: 2, static: true },
  { id: 'chart:weekly', x: 0, y: 1, w: 4, h: 3 },
  { id: 'todo:me', x: 4, y: 2, w: 2, h: 3 },
  { id: 'kpi:returns', x: 6, y: 2, w: 2, h: 1 },
]

const kindOf = (id: string) => id.split(':')[0] as Kind

export function Dashboard() {
  const [items, setItems, reset] = usePersistedState('showcase:dashboard', INITIAL)

  const inspector = useMemo(
    () => (
      <>
        <h2>Grid layout</h2>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          공지 위젯은 static이라 밀리지 않는다. 위젯은 종류별로 허용된 크기로만 조정된다.
        </p>
        <pre>{JSON.stringify(items, null, 1)}</pre>
      </>
    ),
    [items],
  )
  useInspector(inspector)

  const add = (kind: Kind) => {
    const [w, h] = SIZES[kind][0]!
    setItems((l) => addItem(l, { id: `${kind}:${Date.now().toString(36)}`, w, h }, COLS))
  }

  return (
    <div className="fill">
      <div className="toolbar">
        <span className="label">대시보드</span>
        <button className="btn" onClick={() => add('kpi')}>
          + 지표
        </button>
        <button className="btn" onClick={() => add('chart')}>
          + 차트
        </button>
        <button className="btn" onClick={() => add('todo')}>
          + 할 일
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={reset}>
          레이아웃 초기화
        </button>
      </div>
      <div className="fill-body">
        <Grid.Root className="grid-root" layout={items} onLayoutChange={setItems} cols={COLS} gap={14}>
          {items.map((item) => (
            <Grid.Item
              key={item.id}
              id={item.id}
              sizes={SIZES[kindOf(item.id)]}
              className="widget"
              aria-label={item.id}
            >
              <div className="widget-head">
                {item.static ? (
                  <span>{title(item.id)} · 고정</span>
                ) : (
                  <Grid.MoveHandle className="widget-grip" aria-label={`${title(item.id)} 이동`}>
                    {title(item.id)}
                  </Grid.MoveHandle>
                )}
                {item.static ? null : (
                  <button className="pane-act" title="삭제" onClick={() => setItems((l) => removeItem(l, item.id))}>
                    ×
                  </button>
                )}
              </div>
              <div className="widget-body">
                <WidgetBody id={item.id} />
              </div>
              {item.static ? null : <Grid.ResizeHandle className="corner" aria-label={`${title(item.id)} 크기`} />}
            </Grid.Item>
          ))}
          <Grid.Placeholder className="drop-target" />
        </Grid.Root>
      </div>
    </div>
  )
}

function title(id: string) {
  const [kind, name] = id.split(':')
  const names: Record<string, string> = {
    sales: '매출',
    orders: '주문 수',
    returns: '반품률',
    weekly: '주간 매출',
    me: '내 할 일',
    main: '공지',
  }
  const kinds: Record<string, string> = { kpi: '지표', chart: '차트', notice: '공지', todo: '할 일' }
  return names[name ?? ''] ?? kinds[kind ?? ''] ?? id
}

function WidgetBody({ id }: { id: string }) {
  const kind = kindOf(id)
  if (kind === 'kpi') {
    const values: Record<string, string> = { 'kpi:sales': '₩48.2M', 'kpi:orders': '1,284', 'kpi:returns': '2.1%' }
    return <div className="kpi">{values[id] ?? '—'}</div>
  }
  if (kind === 'chart') {
    const data = [42, 58, 51, 66, 73, 61, 80]
    return (
      <div className="bars" role="img" aria-label="주간 매출 막대 차트">
        {data.map((v, i) => (
          <span key={i} style={{ height: `${v}%` }} />
        ))}
      </div>
    )
  }
  if (kind === 'notice') return <p style={{ margin: 0 }}>11월 정기 점검은 22일 02:00–04:00에 진행됩니다.</p>
  return (
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      <li>반품 요청 3건 확인</li>
      <li>거래처 단가 갱신</li>
      <li>월말 정산 자료</li>
    </ul>
  )
}
