# layout

업무 화면용 headless React 레이아웃 컴포넌트. 영역의 크기, 위치, 인터랙션만 맡고 화면에 보이는 것은 사용하는 쪽이 그린다.

| 패키지 경로 | 내용 |
|---|---|
| `@justwonder/layout/side-panels` | 좌/우 사이드 패널 + main. resize, 접기, 접힌 상태의 hover overlay |
| `@justwonder/layout/tiling` | nvim/tmux식 분할, 숨기기, floating 창 (`bounds`: 영역 안 / 화면 전체 / 지정 요소) |
| `@justwonder/layout/grid` | 홈 화면 위젯식 셀 그리드. 이동, 크기 조정, 밀어내기 |

설계와 구현 결과: [docs/design.md](docs/design.md)

| 앱 | 용도 |
|---|---|
| `apps/showcase` | 이 레이아웃으로 만든 예제 업무 앱. 셸(GNB + SidePanels)은 `app/layout.tsx`, 예제는 주문 관리(Tiling), 대시보드(Grid), 메일(SidePanels 중첩) |
| `apps/storybook` | 컴포넌트별 story와 옵션(Controls), 접근성 검사(addon-a11y) |
| `apps/playground` | e2e 검증용 fixture (SSR, StrictMode, 컨테이너 탈출, 중첩) |

## 개발

```sh
pnpm install
pnpm --filter playground exec playwright install chromium webkit   # 브라우저 테스트와 e2e에 필요
pnpm lint          # ESLint (react-hooks 규칙)
pnpm format:check  # Prettier
pnpm test          # 모델 단위 테스트(Node) + 컴포넌트 테스트(Chromium)
pnpm typecheck     # 라이브러리 검사 → 빌드(dist) → playground 검사. playground는 dist의 타입을 쓴다
pnpm build         # 라이브러리 빌드 + playground next build
pnpm showcase      # showcase (http://localhost:3200)
pnpm storybook     # storybook (http://localhost:6006)
pnpm dev           # playground (http://localhost:3100)

pnpm e2e                                          # build 후 playground, showcase, storybook e2e
pnpm build && E2E_MODE=dev pnpm --filter playground e2e   # next dev 대상 (StrictMode)
```

## 사용 예

```tsx
'use client'
import { SidePanels } from '@justwonder/layout/side-panels'
import { Tiling } from '@justwonder/layout/tiling'

<SidePanels.Root ref={workspaceRef} defaultLayout={{ left: { size: 260, collapsed: false } }}>
  {/* 패널의 이름이 Separator의 이름이 된다. 라이브러리는 문구를 갖지 않는다 */}
  <SidePanels.Panel side="left" render={<aside aria-label="탐색" />}>
    <Nav />
  </SidePanels.Panel>
  <SidePanels.Separator side="left" className="sash" />
  <SidePanels.HoverTrigger side="left" className="edge-zone" aria-label="탐색 보기" />
  <SidePanels.Main>
    <Tiling.Root defaultLayout={layout} gap={4} floating={{ bounds: workspaceRef }}>
      <Tiling.Panes>
        {(pane) => (
          <Tiling.Pane className="pane" aria-label={titleOf(pane.id)}>
            <Tiling.MoveHandle className="title">{titleOf(pane.id)}</Tiling.MoveHandle>
            <PaneBody id={pane.id} />
            <Tiling.ResizeHandle edge="bottom-right" aria-label={`${titleOf(pane.id)} 크기`} />
          </Tiling.Pane>
        )}
      </Tiling.Panes>
      <Tiling.Separators>{(s) => <Tiling.Separator separator={s} className="bar" />}</Tiling.Separators>
    </Tiling.Root>
  </SidePanels.Main>
</SidePanels.Root>
```

전체 예시는 `apps/showcase`(실제 앱 구성)와 `apps/storybook`(part별 옵션)에 있다.

접근성 이름: 라이브러리는 기본 문구를 갖지 않는다. 패널과 pane에 `aria-label`을 주면 Separator는 그것을 이름으로 쓴다. 손잡이와 HoverTrigger에는 `aria-label`을 준다. 빠뜨리면 개발 모드에서 경고가 한 번 나온다.
