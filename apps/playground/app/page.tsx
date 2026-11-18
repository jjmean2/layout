import Link from 'next/link'

const demos = [
  ['/rsc', 'Server Component에서 SidePanels 사용'],
  ['/side-panels', 'SidePanels (GNB에서 제어)'],
  ['/tiling', '대표 구조: GNB + SidePanels > Main > Tiling'],
  ['/grid', 'Grid 위젯 대시보드'],
  ['/containment', '임의 영역(transform, overflow) 안에 넣은 레이아웃'],
  ['/nested', '중첩: SidePanels > Tiling > Grid'],
] as const

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Layout playground</h1>
      <ul>
        {demos.map(([href, label]) => (
          <li key={href}>
            <Link href={href}>{label}</Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
