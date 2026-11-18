import Link from 'next/link'

const EXAMPLES = [
  {
    href: '/workspace',
    title: '주문 관리',
    body: 'Tiling. 목록, 상세, 로그, 미리보기를 분할하고 숨기고, 창으로 띄워 사이드 패널 위로 옮긴다.',
  },
  { href: '/dashboard', title: '대시보드', body: 'Grid. 위젯을 끌어 옮기고 허용된 크기로 조정한다. 레이아웃은 저장된다.' },
  { href: '/mail', title: '메일', body: '셸의 SidePanels 안에 또 다른 SidePanels를 중첩한다.' },
]

/** Server Component. 셸(app/layout.tsx)의 SidePanels.Main 안에 렌더된다. */
export default function Home() {
  return (
    <div className="page">
      <h1>@justwonder/layout</h1>
      <p className="lead">
        업무 화면용 headless 레이아웃. 이 사이트의 셸(GNB 아래 좌/우 패널)도 SidePanels로 만들었다. 왼쪽 패널을 접은 뒤
        화면 왼쪽 가장자리에 마우스를 올려 보라.
      </p>
      <div className="cards">
        {EXAMPLES.map((e) => (
          <Link key={e.href} href={e.href} className="card">
            <strong>{e.title}</strong>
            <span>{e.body}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
