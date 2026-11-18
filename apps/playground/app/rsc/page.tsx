// Server Component. wrapper 없이 라이브러리 part를 점 표기로 쓴다.
import { SidePanels } from '@justwonder/layout/side-panels'

export default function RscPage() {
  return (
    <div className="app">
      <header className="gnb">RSC</header>
      <SidePanels.Root className="workspace" defaultLayout={{ left: { size: 220, collapsed: false } }}>
        <SidePanels.Panel side="left" className="side" render={<aside />}>
          <div className="side-inner" data-testid="rsc-left">서버에서 렌더한 왼쪽 패널</div>
          <SidePanels.ResizeHandle className="sash" />
        </SidePanels.Panel>
        <SidePanels.Main className="main">
          <div style={{ padding: 16 }} data-testid="rsc-main">
            Main
          </div>
        </SidePanels.Main>
      </SidePanels.Root>
    </div>
  )
}
