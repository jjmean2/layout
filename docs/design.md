# 레이아웃 컴포넌트 설계 및 구현 계획

- 상태: v1 구현 완료 (2026-11-18). 구현 결과와 설계에서 달라진 점은 13장
- 대상: `packages/layout` (가칭 `@layout/react`), `apps/playground`

## 1. 목표

업무 화면을 구성하는 headless React 레이아웃 컴포넌트 세 가지를 만든다. 컴포넌트는 영역의 크기, 위치, 인터랙션만 맡고, 화면에 보이는 것은 모두 사용하는 쪽이 그린다.

| 컴포넌트 | 요구사항 |
|---|---|
| SidePanels | 좌/우 사이드 패널과 중앙 main. 패널을 resize하고 접을 수 있다. 접힌 상태에서 지정한 영역에 hover하면 overlay로 나타난다(끌 수 있음) |
| Tiling | nvim/tmux식 분할, resize, 숨기기. pane을 floating 창으로 띄워 이동하고 resize한다. floating 창은 화면 어디로든 갈 수 있어야 한다 |
| Grid | 홈 화면 위젯처럼 셀 그리드에 요소를 배치하고 크기를 조정한다 |

공통 조건:

- 세 컴포넌트는 서로 중첩할 수 있다. 대표 구조는 `root > GNB + SidePanels > Main > Tiling 또는 Grid`이지만, 임의의 영역 안에 넣는 것도 막지 않는다.
- Next.js에서 쓴다. 서버 렌더에서 오류가 나면 안 된다. 서버 HTML과 클라이언트 화면이 달라서 생기는 layout shift는 허용한다.

### v1에서 하지 않는 것

| 항목 | 나중에 추가할 때 필요한 것 |
|---|---|
| floating 창을 가장자리에 overlay로 부착 | 모델의 `floating[]` 항목에 `dock?: { edge, size, reveal }` 필드 추가. hover 동작은 SidePanels가 쓰는 `useHoverReveal`을, 기준 영역은 `bounds`를 그대로 쓴다. 구조 변경 없음 |
| pane을 드래그해 다른 위치에 도킹 (drop 영역 표시) | 계산된 rect 위에 hit-test와 미리보기 추가. v1은 `dock()` 액션만 제공 |
| pane 안의 탭, 브라우저 팝업 창으로 분리 | 별도 설계 |
| pane 내용의 서버 렌더 | 5.3 참조 |
| Tiling의 pane별 min/max 크기 | v1은 Root 단위 `minPaneSize`만 |
| Grid 반응형 브레이크포인트, 최대 행 수, 그리드 간 이동 | 측정값은 이미 있으므로 `cols`를 맵으로 확장 |
| 영속화 어댑터 | `onLayoutChange`로 받은 JSON을 사용자가 저장 |
| 애니메이션 엔진, RTL, 터치 전용 제스처 | 애니메이션은 사용자의 CSS transition으로 처리 |

## 2. 핵심 결정

| # | 결정 | 이유 |
|---|---|---|
| 1 | 컴포넌트 3개를 분리하고 내부 공용 모듈을 공유한다 | 상태 모델이 서로 다르다(고정 슬롯 / 트리 / 셀 좌표). 중첩은 3.6의 계약으로 해결한다 |
| 2 | 패키지는 1개, subpath export로 나눈다 | 빌드와 버전이 하나다. 공용 모듈을 공개 API로 만들지 않아도 된다 |
| 3 | 공개 API는 unstyled compound parts + `data-*` 상태 속성 + hooks 한 가지 형태다 | Base UI와 같은 형태다(parts, `render` prop, `data-*`). 사용자가 prop을 직접 펼치다 빠뜨릴 일이 없다 |
| 4 | 상태는 컴포넌트마다 직렬화 가능한 `layout` 객체 하나다. 변경 로직은 순수 함수다 | controlled/uncontrolled, 저장, 테스트가 단순해진다 |
| 5 | 드래그 중에는 내부 draft만 바뀌고, `onLayoutChange`는 놓을 때 한 번 호출된다 | 부모 state가 프레임마다 바뀌지 않는다 |
| 6 | 크기와 위치는 CSS가 계산한다. SidePanels는 flex, Tiling은 `calc(% + px)`, Grid는 CSS 변수 1개 | 컨테이너가 resize될 때 React 렌더가 없다. 중첩 시 연쇄 비용이 없다 |
| 7 | Tiling의 pane 내용은 라이브러리가 소유한 host 노드에 portal로 렌더한다 | 분할, 숨김, floating 전환에서 remount가 없다. 임의의 조상 구조를 벗어날 수 있다 |
| 8 | floating 창의 범위는 `bounds` 옵션으로 정한다 (`'container'`, `'viewport'`, 요소 ref) | 범용 사용과 "화면 어디든"을 한 구조로 지원한다 |
| 9 | 각 Root는 `isolation: isolate`를 쓰고, 페이지 수준 floating 레이어는 하나다 | 내부 z-index가 밖으로 새지 않고, floating 창은 일반 z-index 체계에 놓인다 |
| 10 | SSR 보장 수준은 "오류와 hydration mismatch 없음"이다 | 요구사항 그대로다. 첫 렌더는 state만으로 하고 측정은 mount 후에 한다 |

## 3. 공통 설계

### 3.1 패키지 구조

```
layout/
├─ packages/
│  └─ layout/                 가칭 @layout/react
│     ├─ src/
│     │  ├─ internal/         비공개 공용 프리미티브 (3.8)
│     │  ├─ side-panels/      model.ts · store.ts · parts.tsx · index.ts
│     │  ├─ tiling/           model/ · store.ts · pane-host.ts · parts.tsx · index.ts
│     │  └─ grid/             model/ · store.ts · parts.tsx · index.ts
│     └─ package.json         exports: ./side-panels, ./tiling, ./grid
└─ apps/
   └─ playground/             Next.js App Router. 데모, SSR 검증, e2e 대상을 겸한다
```

각 레이아웃 폴더는 같은 세 층으로 나눈다.

| 층 | 내용 | React 의존 |
|---|---|---|
| `model` | 타입, 레이아웃 변환 함수, 기하 계산, 제약 계산 | 없음 |
| `store` | 확정된 layout과 드래그 중 draft를 보관하고 구독을 제공 | 없음 |
| `parts` | Root(Provider)와 part 컴포넌트, hooks | 있음 |

### 3.2 공개 API 규약

세 컴포넌트가 같은 규칙을 따른다.

- **Parts.** `Xxx.Root`가 상태를 소유하고, 나머지 part는 각각 DOM 요소 하나를 렌더한다. 기본 요소는 `div`이고 `render` prop으로 바꾼다(`render={<aside />}`). `className`, `style`, `ref`, 나머지 DOM props는 그대로 전달한다.
- **상태 props.** `defaultLayout`(uncontrolled) 또는 `layout` + `onLayoutChange`(controlled). `onLayoutChange`는 변경이 확정될 때만 호출된다.
- **Hooks.** `useSidePanels()`, `useTiling()`, `usePane()`, `useGrid()`가 현재 layout과 액션을 준다. Root 아래 어디서든 쓸 수 있다.
- **순수 함수.** `toggleCollapsed(layout, 'left')`, `split(layout, …)`처럼 layout을 받아 새 layout을 돌려주는 함수를 export한다. Root 바깥(예: GNB의 버튼)에서는 controlled 상태에 이 함수를 적용한다.

### 3.3 스타일 계약

- 라이브러리는 배치에 필요한 inline style(`position`, 크기, 위치, `touch-action`)과 CSS 변수만 쓴다. CSS 파일은 없다.
- 상태는 `data-*` 속성으로 노출한다. 예: `data-state`, `data-side`, `data-placement`, `data-focused`, `data-dragging`, `data-resizing`.
- 애니메이션은 사용자가 CSS transition으로 건다. 드래그 중이거나 컨테이너 크기가 바뀌는 중에는 transition이 걸리면 화면이 밀려 보이므로, 그때 붙는 `data-dragging`과 `data-resizing`으로 끈다.

```css
.widget { transition: transform 200ms, width 200ms, height 200ms; }
[data-resizing] .widget,
.widget[data-dragging] { transition: none; }
```

### 3.4 상태 흐름과 성능

```
pointer 이동 → (rAF로 묶음) → model 함수로 draft 계산 → store 갱신
            → 해당 값을 구독한 part만 리렌더 (style만 바뀜)
pointer 놓음 → draft를 확정 → onLayoutChange(next) 한 번
```

성능 규칙:

1. **레이아웃 변경이 사용자 콘텐츠를 리렌더하지 않는다.** part는 `useSyncExternalStore`로 자기 값만 구독한다. 목록을 렌더하는 컴포넌트(`Tiling.Panes`)는 pane id 집합이 바뀔 때만 리렌더한다.
2. **컨테이너 resize는 CSS가 처리한다.** SidePanels와 Tiling은 React 렌더가 없다. Grid는 ResizeObserver가 CSS 변수 하나만 갱신한다.
3. **DOM 순서를 바꾸지 않는다.** 형제 순서를 바꾸면 브라우저가 노드를 다시 붙이면서 iframe이 재로드된다. pane은 추가된 순서대로 유지한다.
4. controlled 모드에서는 확정될 때마다 부모가 리렌더된다. 드래그 한 번에 한 번이다.
5. 결과가 이전 layout과 같으면 확정하지 않는다. 예를 들어 이미 맨 앞에 있는 floating 창을 눌러도 `onLayoutChange`가 호출되지 않는다.

### 3.5 SSR 규칙

| 규칙 | 내용 |
|---|---|
| `"use client"` | 각 레이아웃의 `parts` 모듈 맨 위에 둔다. entry(`index`)는 서버 모듈로 두고 `export * as X from './parts'`로 다시 내보낸다. entry가 client 모듈이면 Server Component에서 `<X.Root>` 점 표기가 동작하지 않는다(13장). 빌드 산출물에도 남아 있어야 한다 |
| 브라우저 API | render 중에 `window`, `document`, `ResizeObserver`를 쓰지 않는다. effect 안에서만 쓴다 |
| 첫 렌더 | state만으로 렌더한다. 서버와 클라이언트 첫 렌더가 같다 |
| store | `useSyncExternalStore`에 `getServerSnapshot`을 준다 |
| portal, floating 레이어, hover overlay | 서버에서는 렌더하지 않는다. mount 후에 만든다 |
| 저장된 layout | localStorage 값은 hydration 이후에 적용한다(shift 발생, 허용). shift를 없애려면 사용자가 cookie나 서버에서 `defaultLayout`을 넘긴다 |

레이아웃별 서버 HTML:

| | 서버 HTML에 포함되는 것 |
|---|---|
| SidePanels | 전부. 크기도 맞다 |
| Tiling | Root와 separator. **pane 내용은 포함되지 않는다** (5.3) |
| Grid | 아이템과 내용이 포함되지만, 셀 크기를 측정하기 전까지 `visibility: hidden`이다 |

대표 구조(GNB + SidePanels > Main > Tiling)의 서버 HTML은 GNB, 사이드 패널, 빈 Tiling 틀이다.

### 3.6 중첩 계약

1. Root는 부모 박스를 채운다(`width: 100%; height: 100%; min-width: 0; min-height: 0`). 부모가 크기를 정해 줘야 한다.
2. 측정은 자기 요소만 한다. viewport 크기를 가정하지 않는다.
3. Root는 `isolation: isolate`로 stacking context를 만든다. 내부 z-index는 그 안에서만 의미가 있다.
4. 제스처는 handle part에서만 시작한다. 중첩된 경우 가장 안쪽 handle이 이벤트를 처리했다고 표시하고, 바깥 handle은 그 이벤트를 무시한다.
5. 상태는 인스턴스마다 독립이다. part는 가장 가까운 Root의 context를 쓴다.

### 3.7 접근성 기준

handle 프리미티브에 처음부터 넣는다. 단계별 완료 기준에 포함한다(8장).

| 대상 | 기준 |
|---|---|
| resize handle, separator | WAI-ARIA APG의 Window Splitter 패턴. 포커스 가능한 `role="separator"`, 방향키로 조정, End로 최대 크기. 여기에 `aria-orientation`, `aria-valuenow/min/max`, `aria-controls`, Home(최소 크기), Enter(접기 전환)를 더한다 |
| 이동/크기 handle (floating 창, Grid 아이템) | 포커스 가능. 방향키로 한 단계씩 이동, 조정. Esc로 드래그 취소 |
| hover overlay | WCAG 1.4.13. 트리거는 포커스 가능하고 Enter로도 열린다. 포인터가 패널 위로 옮겨 가도 닫히지 않는다. Esc로 닫고 포커스를 트리거로 되돌린다 |
| 접힌 패널, 숨긴 pane | `inert`를 적용해 포커스가 들어가지 않게 한다 |
| 드래그 대안 | 모든 조작은 액션 함수로도 가능하다. 사용자가 버튼으로 연결할 수 있다(WCAG 2.5.7) |

### 3.8 내부 프리미티브 (`internal/`)

| 모듈 | 역할 |
|---|---|
| `createStore`, `useStoreSelector` | 구독 store와 선택 구독 |
| `useLayoutState` | controlled/uncontrolled 통합, draft와 확정 구분 |
| `useDragGesture` | pointer capture, 임계값, rAF 묶음, Esc 취소, 키보드 단계 조작, 안쪽 handle 우선 표시 |
| `useHoverReveal` | 열기/닫기 지연, Esc, focus-within 유지 |
| `useElementSize` | ResizeObserver |
| `useRender` | `render` prop 처리, props와 ref 병합 |
| `floatingLayer` | 문서당 하나의 floating 레이어와 z 카운터 |

## 4. SidePanels

### 4.1 상태

```ts
type SideLayout = { size: number; collapsed: boolean }   // size는 px. 접어도 유지된다
type SidePanelsLayout = { left?: SideLayout; right?: SideLayout }
```

overlay로 열려 있는지는 저장하지 않는 일시 상태다. 화면 상태는 `data-state`로 나타난다.

```
expanded ──collapse──▶ collapsed ──트리거 hover 또는 포커스 (openDelay)──▶ overlay
    ▲                      ▲                                              │
    └───────expand─────────┴────── 포인터 이탈 (closeDelay), Esc ──────────┘
```

### 4.2 Parts

| Part | 역할 | 주요 props |
|---|---|---|
| `Root` | flex 컨테이너, 상태 소유 | `layout`, `defaultLayout`, `onLayoutChange` |
| `Panel` | 사이드 영역 | `side`, `minSize`, `maxSize`, `hoverOverlay`(`false` 또는 `{ openDelay, closeDelay }`) |
| `Main` | 중앙 영역 | `minSize` |
| `ResizeHandle` | 패널 경계 손잡이. `Panel`의 자식으로 둔다 | |
| `HoverTrigger` | 접힌 상태에서 overlay를 여는 영역. 위치와 모양은 사용자가 정한다 | `side` |

### 4.3 배치

| 상태 | Panel의 배치 | Main |
|---|---|---|
| expanded | flex 항목. 너비는 `clamp(minSize, size, 100% - main 최소 너비)` | 남는 공간 (`flex: 1`) |
| collapsed | 너비 0, `inert`. mount는 유지한다 | 전체 |
| overlay | Root 기준 `position: absolute`, 너비는 `size` | **변하지 않는다** |

- 모두 CSS로 표현되므로 측정이 필요 없다.
- 접힘을 `display: none`이 아니라 너비 0으로 표현한다. 사용자가 `transition: width`를 걸 수 있다.
- `ResizeHandle`이 Panel 안에 있어서 접히면 함께 사라지고 overlay 상태에서도 따라온다.
- overlay는 SidePanels Root 안에 그려진다. GNB가 Root 밖에 있으면 GNB를 덮지 않는다.

## 5. Tiling

### 5.1 모델

```ts
type PaneId = string

type TileNode =
  | { type: 'split'; direction: 'row' | 'column'; children: TileNode[]; sizes: number[] }
  | { type: 'pane'; id: PaneId }

type Rect = { x: number; y: number; width: number; height: number }   // px, bounds 원점 기준
type RestoreHint = { anchor: PaneId; edge: 'left' | 'right' | 'top' | 'bottom'; ratio: number }

type TilingLayout = {
  root: TileNode | null
  floating: Array<{ id: PaneId; rect: Rect; restore?: RestoreHint }>   // 배열 순서가 z-order
  hidden: Array<{ id: PaneId; restore?: RestoreHint; rect?: Rect }>
}
```

- `sizes`는 합이 1인 비율이다. split은 자식이 2개 이상이다. 같은 방향의 중첩 split은 합친다. 변환 함수가 이 규칙을 항상 유지한다.
- pane id는 세 컬렉션 중 정확히 한 곳에만 있다.
- `restore`는 숨기거나 띄운 pane을 되돌릴 자리다. 기준 pane이 사라졌으면 Root 가장자리에 붙인다.
- 포커스된 pane은 저장하지 않는 실행 중 상태다.
- pane의 제목이나 종류 같은 정보는 모델에 넣지 않는다. 사용자가 id로 관리한다.

변환 함수: `split`, `close`, `resize`, `swap`, `hide`, `show`, `float`, `dock`, `moveFloating`, `bringToFront`.

### 5.2 DOM 구조

```
Tiling.Root                position: relative; isolation: isolate
├─ panes 컨테이너           display: contents. React 자식 없음
│  └─ host (pane A)        display: contents. 라이브러리 소유 노드
│     └─ Tiling.Pane       position: absolute; 위치와 크기는 calc(% + px)
└─ Tiling.Separator …      position: absolute

floating 레이어             기본값: body 아래 자동 생성
│                          position: fixed; inset: 0; pointer-events: none;
│                          z-index: var(--layout-floating-z, 40)
└─ host (pane B)           display: contents
   └─ Tiling.Pane          position: fixed; 위치와 크기는 px; pointer-events: auto
```

`Tiling.Pane`은 tiled, floating, hidden 상태 모두에서 같은 요소다. style과 `data-placement`만 바뀐다.

`bounds: 'container'`인 floating 창은 Root 안에 남는다. 이때는 Root 안에서 z-index를 받아 tiled pane과 separator 위에 그려진다.

### 5.3 pane host

**문제.** pane을 트리 모양대로 중첩 렌더하면 분할이나 floating 전환 때 부모가 바뀌어 React가 pane을 remount한다. 입력 중인 폼, 스크롤 위치, iframe이 초기화된다. 평평하게 렌더해도 floating 창이 임의의 조상(`overflow`, `transform`, stacking context)을 벗어나려면 DOM 위치를 옮겨야 하고, React의 portal 대상을 바꾸면 내용이 다시 만들어진다.

**방식.** pane마다 DOM 노드(host)를 하나 만들고, pane 내용을 그 노드에 `createPortal`로 렌더한다. portal 대상은 바뀌지 않는다. 위치를 옮길 때는 host 노드 자체를 Root와 floating 레이어 사이로 옮긴다.

- host는 store가 pane id별로 만들고 보관한다. 서버와 hydration 중에는 host가 없으므로 portal을 렌더하지 않는다.
- 옮길 때는 `Element.moveBefore()`가 있으면 그것을 쓴다(기능 감지). 없으면 `appendChild`를 쓴다.

| 전환 | DOM 이동 | 사용자 상태 |
|---|---|---|
| split, close, resize, swap, hide, show | 없음 | 유지 |
| float, dock (`bounds: 'container'`) | 없음 | 유지 |
| float, dock (그 외 `bounds`) | host를 Root ↔ 레이어로 이동 | `moveBefore`가 있으면 유지. 없으면 iframe이 재로드되고 CSS 애니메이션이 다시 시작된다. 포커스와 스크롤 위치는 라이브러리가 복원한다 |

**비용.**

- pane 내용은 클라이언트에서만 렌더된다. 서버 HTML에는 없다. pane 안에 중첩한 Grid도 마찬가지다.
- 서버 렌더를 되살리려면 `bounds: 'container'` 전용으로 host 없는 렌더 경로를 하나 더 만들어야 한다. 렌더 경로와 테스트 조합이 두 배가 된다. 요구 수준이 "오류 없음"이므로 v1에서는 하지 않는다.
- viewport 범위로 띄운 pane은 DOM상 원래 조상을 떠난다. 조상 선택자와 조상에 범위가 지정된 CSS 변수가 적용되지 않고, tab 순서가 페이지 끝으로 간다. React context와 이벤트 버블링은 유지된다.

### 5.4 tiled 배치

`computeTiledGeometry(root, gap)`이 pane과 separator마다 `left`, `top`, `width`, `height`를 `{ pct, px }` 쌍으로 계산한다. CSS에는 `calc(pct% + px)`로 쓴다. 중첩 split과 gap이 모두 이 1차식 안에서 합성된다.

- 컨테이너가 resize되면 브라우저가 다시 계산한다. React 렌더가 없다.
- `minPaneSize`는 separator를 드래그할 때 적용한다. 컨테이너가 줄어들 때는 비율을 유지하고 state를 바꾸지 않는다.
- separator는 경계 위치에 놓인 형제 요소다. 두께와 모양은 사용자의 CSS다.
- separator를 드래그하는 동안 Root와 해당 Separator에 `data-dragging`이 붙는다. pane에 transition을 건 경우 Root의 이 속성으로 끈다.

### 5.5 floating

```ts
floating?: {
  bounds?: 'container' | 'viewport' | RefObject<HTMLElement | null>   // 기본값 'container'
  minVisible?: number | 'full'      // 좌, 우, 아래로 경계 안에 남아야 하는 최소 px. 기본값 100
  minSize?: { width: number; height: number }   // 창의 최소 크기
  container?: HTMLElement | null    // floating 레이어를 둘 요소. 기본값은 자동 생성
}
```

| `bounds` | 창이 사는 곳 | 움직일 수 있는 범위 |
|---|---|---|
| `'container'` | Tiling Root 안 (`absolute`) | Root 영역. 어떤 구조에서든 같고, Root가 스크롤되면 같이 움직인다 |
| `'viewport'` | floating 레이어 (`fixed`) | 화면 전체 |
| 요소 ref | floating 레이어 (`fixed`) | 그 요소의 영역. 예: GNB 아래의 SidePanels Root를 주면 사이드 패널 위로는 가지만 위쪽의 GNB는 덮지 않는다 |

- **좌표.** `rect`는 항상 bounds 박스의 왼쪽 위를 원점으로 한다. GNB 높이가 바뀌면 창도 같이 움직인다.
- **경계 규칙.** 창의 위쪽 가장자리는 bounds 위로 나가지 않는다. 좌, 우, 아래로는 `minVisible` px만 남기고 나갈 수 있다. 제목 표시줄이 보통 위에 있으므로 이동 handle이 항상 닿는 곳에 남는다. `'full'`이면 창 전체가 bounds 안에 있어야 하고, 창이 bounds보다 크면 크기를 줄여 그린다.
- **경계 처리.** 저장된 rect는 그대로 두고, 그릴 때 위 규칙에 맞춘 값을 쓴다. 브라우저 창을 줄였다 늘려도 원래 위치로 돌아온다. bounds 요소는 ResizeObserver로 관찰한다.
- **스크롤.** `'viewport'`와 요소 ref는 문서가 스크롤되지 않는 app shell을 전제한다. bounds 요소가 크기 변화 없이 스크롤로 움직이면 창은 따라가지 않는다. 스크롤되는 페이지 안에 넣는 경우(showcase 등)에는 `'container'`를 쓴다.
- **z-order.** `floating` 배열 순서가 순서다. 창을 누르면 맨 뒤로 옮긴다. 한 페이지에 Tiling이 여러 개면 레이어의 카운터로 전체 순서를 정한다.
- **다른 UI와의 관계.** 레이어의 z-index 기본값은 40이고 `--layout-floating-z`로 바꾼다. 앱의 dialog, toast, dropdown은 그보다 높은 z-index가 있어야 창 위에 뜬다. body로 portal되는 popup에 z-index가 없으면 창 뒤에 그려진다. 창 안에서 연 dropdown도 마찬가지다. 이 경우 popup에 z-index를 주거나 `--layout-floating-z: auto`로 DOM 순서를 따르게 한다.
- **`container`.** 테마 class나 CSS 변수를 특정 요소에 범위 지정해 쓰는 앱은 그 안에 레이어를 두도록 지정한다.
- **이동과 resize.** `Tiling.MoveHandle`과 `Tiling.ResizeHandle`을 Pane 안에 둔다. floating 상태가 아니면 렌더되지 않는다.

### 5.6 Parts와 hooks

| Part | 역할 | 주요 props |
|---|---|---|
| `Root` | 컨테이너, 상태 소유 | `layout` 계열, `gap`, `minPaneSize`, `floating`, `keepHiddenMounted`(기본 `true`) |
| `Panes` | pane마다 children 함수를 호출하고 host에 렌더 | `children: (pane) => ReactNode` |
| `Pane` | pane의 박스 | |
| `MoveHandle`, `ResizeHandle` | floating 창 이동, 크기 조정 | `edge` |
| `Separators`, `Separator` | 분할 경계 | |

- `useTiling()`: layout, 변환 액션, `focusNeighbor(direction)`.
- `usePane()`: 현재 pane의 id, placement, 포커스 여부, 그 pane에 대한 액션.
- 단축키는 제공하지 않는다. 사용자가 액션에 연결한다.
- 숨긴 pane은 기본적으로 mount를 유지한다.

## 6. Grid

### 6.1 모델

```ts
type GridItemLayout = { id: string; x: number; y: number; w: number; h: number; static?: boolean }
type GridLayout = GridItemLayout[]
```

- 단위는 셀이다. `static`은 다른 아이템에 밀리지 않는 고정 아이템이다.
- 크기 제약은 저장 대상이 아니므로 `Grid.Item`의 props로 준다: `minW`, `maxW`, `minH`, `maxH` 또는 허용 크기 목록 `sizes`(예: `[[2, 2], [4, 2], [4, 4]]`).

변환 함수: `moveItem`, `resizeItem`, `compact`, `findFreeSlot`.

### 6.2 Root props

| prop | 값 | 기본값 |
|---|---|---|
| `cols` | 열 수 | 필수 |
| `rowHeight` | px 또는 `'square'`(셀 너비와 같게) | `'square'` |
| `gap` | px | 0 |
| `collision` | `'push'`(다른 아이템을 밀어냄) 또는 `'block'`(겹치면 이동 불가) | `'push'` |
| `compact` | 위쪽 빈칸을 자동으로 메울지 | `false` |

### 6.3 배치

- Root는 부모를 채우는 스크롤 영역이다(`overflow: auto; scrollbar-gutter: stable`). 내용 높이는 행 수에 따라 늘어난다.
- ResizeObserver가 Root 너비로 셀 너비를 계산해 `--grid-cell-w` 하나만 갱신한다. React 렌더가 없다.
- 아이템은 `position: absolute`이고 위치는 그 변수로 계산한 `transform: translate(...)`, 크기는 `calc(...)`다.

| 문제 | 처리 |
|---|---|
| 측정 전 상태 (서버 HTML, 첫 페인트) | 아이템을 `visibility: hidden`으로 둔다. 클라이언트 이동 시에는 layout effect에서 측정하므로 깜빡임이 없다 |
| 컨테이너 resize 중 transition | Root에 `data-resizing`을 붙인다. 사용자는 그 상태에서 transition을 끈다 (3.3) |
| 정사각 셀과 스크롤바의 순환 (너비 → 높이 → 스크롤바 → 너비) | Root가 스크롤을 소유하고 `scrollbar-gutter: stable`로 스크롤바 자리를 항상 확보한다 |

### 6.4 드래그

1. `Grid.MoveHandle`에서 시작한다. 이때 셀 크기를 한 번 읽는다.
2. 끌리는 아이템은 `data-dragging` 상태로 포인터를 따라간다.
3. 대상 셀이 바뀔 때만 `moveItem`으로 미리보기 layout을 계산한다. 영향받는 아이템만 새 위치로 간다.
4. `Grid.Placeholder`가 놓일 자리를 표시한다.
5. 놓으면 확정하고 `onLayoutChange`를 호출한다.

Parts: `Root`, `Item`, `MoveHandle`, `ResizeHandle`, `Placeholder`.

## 7. 조합 예시

```tsx
'use client'

function AppShell() {
  const [side, setSide] = useState<SidePanelsLayout>({
    left: { size: 280, collapsed: false },
    right: { size: 320, collapsed: true },
  })
  const workspaceRef = useRef<HTMLDivElement>(null)

  return (
    <div className="app">   {/* height: 100dvh; display: flex; flex-direction: column */}
      {/* GNB는 Root 밖에 있으므로 controlled 상태와 순수 함수로 제어한다 */}
      <Gnb onToggleNav={() => setSide((l) => toggleCollapsed(l, 'left'))} />

      <SidePanels.Root ref={workspaceRef} layout={side} onLayoutChange={setSide}
                       className="workspace">   {/* flex: 1; min-height: 0 */}
        <SidePanels.Panel side="left" minSize={200} maxSize={480} render={<aside />}>
          <Nav />
          <SidePanels.ResizeHandle className="sash" />
        </SidePanels.Panel>
        <SidePanels.HoverTrigger side="left" className="edge-zone" />

        <SidePanels.Main>
          <Workspace floatingBounds={workspaceRef} />
        </SidePanels.Main>

        <SidePanels.Panel side="right" hoverOverlay={false}>
          <Inspector />
          <SidePanels.ResizeHandle className="sash" />
        </SidePanels.Panel>
      </SidePanels.Root>
    </div>
  )
}

function Workspace({ floatingBounds }: { floatingBounds: RefObject<HTMLElement | null> }) {
  const [layout, setLayout] = useState<TilingLayout>(initialLayout)

  return (
    <Tiling.Root layout={layout} onLayoutChange={setLayout} gap={4}
                 floating={{ bounds: floatingBounds }}>
      <Tiling.Panes>
        {(pane) => (
          <Tiling.Pane className="pane">
            <PaneHeader />   {/* usePane()으로 float, dock, hide, close 호출. Tiling.MoveHandle 포함 */}
            {pane.id === 'dashboard' ? <Dashboard /> : <PaneBody id={pane.id} />}
            <Tiling.ResizeHandle edge="bottom-right" className="grip" />
          </Tiling.Pane>
        )}
      </Tiling.Panes>
      <Tiling.Separators>
        {(separator) => <Tiling.Separator separator={separator} className="split-bar" />}
      </Tiling.Separators>
    </Tiling.Root>
  )
}

function Dashboard() {
  const [items, setItems] = useState<GridLayout>(initialItems)

  return (
    <Grid.Root layout={items} onLayoutChange={setItems} cols={8} gap={12}>
      {items.map((item) => (
        <Grid.Item key={item.id} id={item.id} sizes={[[2, 2], [4, 2], [4, 4]]} className="widget">
          <Grid.MoveHandle className="grip" />
          <Widget id={item.id} />
          <Grid.ResizeHandle className="corner" />
        </Grid.Item>
      ))}
      <Grid.Placeholder className="drop-target" />
    </Grid.Root>
  )
}
```

## 8. 구현 계획

위험이 큰 것부터 검증한다. pane host가 설계 전체에서 유일하게 React와 브라우저의 경계 동작에 의존하므로 Phase 0에서 먼저 확인한다.

### Phase 0. 기반과 위험 검증

작업:

- `packages/layout`, `apps/playground`(Next.js App Router, StrictMode 켬), TypeScript strict, lint, Vitest, Playwright, 루트 스크립트(`typecheck`, `test`, `build`, `e2e`).
- 빌드: ESM, 타입 선언, subpath exports. 빌드 도구는 `"use client"` 유지 여부로 고른다.
- spike: pane host 최소 구현(host 생성, portal, Root ↔ 레이어 이동).

완료 기준:

- playground의 Server Component에서 wrapper 없이 import하고 `next build`가 통과한다.
- 브라우저 콘솔에 hydration 경고가 없다.
- spike 체크리스트:
  1. StrictMode에서 pane 내용이 한 번 mount된 상태로 유지된다.
  2. Root ↔ 레이어 이동 후 React state, context, 이벤트가 유지된다.
  3. `transform`이 걸린 조상 안에서도 창이 viewport 좌표에 표시된다.
  4. `moveBefore` 지원 브라우저에서 iframe이 유지된다. 미지원 경로에서 포커스와 스크롤이 복원된다.
  5. pointer capture 드래그가 iframe 위에서 끊기지 않는다.

**판정.** 1~3이 통과하면 5.3의 방식으로 진행한다. 통과하지 못하면 plan B로 간다: host 없이 pane을 Root 안에 형제로 직접 렌더하고(서버 렌더 가능), v1의 floating은 `bounds: 'container'`만 제공한다. viewport 범위는 이후에 제자리 `position: fixed` 방식으로 추가하되, 조상에 `transform` 등이 없어야 한다는 제약을 문서화하고 Root의 `isolation`을 뺀다.

### Phase 1. 내부 프리미티브와 SidePanels

작업: `internal/` 전체, SidePanels 모델, parts, hooks, playground 데모.

완료 기준:

- resize, 접기, 펼치기, hover overlay, overlay 끄기가 동작한다.
- separator ARIA 속성과 키보드 조작(방향키, Home/End, Enter)이 동작한다.
- hover overlay가 키보드로 열리고 Esc로 닫힌다. 접힌 패널에 포커스가 들어가지 않는다.
- 드래그 중 Main 안의 사용자 컴포넌트 리렌더가 0회다(React Profiler).
- GNB가 Root 밖에 있는 데모에서 controlled 토글이 동작한다.
- SSR 페이지에 오류와 hydration 경고가 없다.

### Phase 2. Tiling 모델과 tiled 렌더

작업: 변환 함수와 `computeTiledGeometry`, pane host, `Panes`, `Pane`, `Separators`, hide/show, `focusNeighbor`.

완료 기준:

- 모델 단위 테스트: 모든 변환 후 불변 조건(비율 합 1, id 유일, split 자식 2개 이상)이 유지된다.
- split, close, swap, hide, show 후에 pane 안의 입력값, 스크롤, iframe이 유지된다(e2e).
- separator 드래그 중 pane 내용 리렌더가 0회다. 컨테이너 resize 중 React 렌더가 0회다.
- separator의 ARIA와 키보드 조작이 동작한다. 숨긴 pane에 포커스가 들어가지 않는다.

### Phase 3. Tiling floating

작업: `float`, `dock`, 이동과 resize handle, `bounds` 세 종류, 경계 처리, z-order, floating 레이어, `moveBefore` fallback.

완료 기준:

- 대표 구조(GNB + SidePanels > Main > Tiling)에서 창이 사이드 패널 위로 이동한다. bounds가 SidePanels Root일 때 창의 위쪽 가장자리가 GNB 아래에 머문다.
- `minVisible`의 숫자 값과 `'full'`이 각각 경계 규칙대로 동작한다. 이동 handle이 항상 닿는 곳에 남는다.
- 창 안에서 연 dropdown(body portal)이 창 위에 보인다. z-index가 있는 popup과 없는 popup 각각의 설정을 데모로 확인한다.
- `transform`과 `overflow: hidden`이 걸린 영역 안의 Tiling에서 `'container'`와 `'viewport'`가 각각 의도대로 동작한다.
- float/dock 전환 후 React state가 유지된다. fallback 경로에서 포커스와 스크롤이 복원된다.
- 브라우저 창을 줄였다 늘리면 창이 원래 위치로 돌아온다.
- 이동과 resize handle이 키보드로 동작한다. 창을 띄우면 포커스가 그 창으로 간다.

### Phase 4. Grid

작업: 모델(충돌, compaction, 빈자리 찾기), CSS 변수 배치, 이동과 resize, 크기 목록, Placeholder.

완료 기준:

- 모델 단위 테스트: `push`와 `block`, `static` 아이템, 크기 제약.
- 컨테이너 resize 중 React 렌더가 0회다. `data-resizing` 동안 transition이 걸리지 않는다.
- 정사각 셀과 스크롤 조합에서 크기가 진동하지 않는다.
- 이동과 resize handle이 키보드로 한 셀씩 동작한다.
- SSR 페이지에 오류가 없다. 측정 전에 아이템이 보이지 않는다.
- 후순위: 스크롤 영역 가장자리로 끌 때 자동 스크롤.

### Phase 5. 통합과 문서

- 7장의 조합 데모, 임의 영역 안에 넣은 showcase 데모.
- 중첩 e2e: 안쪽 handle 드래그가 바깥 레이아웃을 움직이지 않는다.
- 사용 문서: 스타일 계약, CSS 레시피, floating 창의 DOM 이동에 따른 제약.

## 9. 테스트 전략

| 대상 | 도구 | 내용 |
|---|---|---|
| model | Vitest | 변환 함수, 기하 계산, 불변 조건 |
| 인터랙션 | Playwright (playground 대상) | 드래그, 키보드, 상태 보존, 중첩. 실제 레이아웃 엔진이 필요해서 jsdom은 쓰지 않는다 |
| SSR | `next build` + Playwright | 각 데모 페이지의 콘솔 오류와 hydration 경고 0건 |
| 성능 | React Profiler | 드래그와 resize 중 사용자 콘텐츠 리렌더 횟수 |

## 10. 이전 논의에서 바뀐 것

| 이전 | 최종 | 이유 |
|---|---|---|
| prop getter와 render-prop children | compound parts + hooks | API 형태를 하나로 |
| 패키지 4개 (core, side-panels, tiling, grid) | 패키지 1개 + subpath exports | 빌드와 버전 관리 단순화 |
| reducer와 액션 객체 | layout을 받아 layout을 돌려주는 순수 함수 | 개념 수 축소 |
| `mode: expanded / collapsed / overlay`를 저장 | `{ size, collapsed }`만 저장, overlay는 일시 상태 | 저장할 필요가 없는 상태 분리 |
| `Placement` union | `root` / `floating[]` / `hidden[]` 세 컬렉션 | 직렬화와 불변 조건이 단순 |
| split 노드의 id | 트리 경로로 식별 | 저장 모델 축소 |
| `LayerManager`, 깊이별 z-index 범위 | Root마다 `isolation: isolate` + floating 레이어 하나 | 창이 Root 밖 레이어로 나가므로 "조상이 stacking context를 만들면 안 된다"는 규칙이 필요 없어짐 |
| `surfaceId` registry, `LayoutRoot` | `bounds`에 ref 전달, 레이어 위치는 `floating.container` | 개념 2개 제거 |
| `portal: true` 옵션, 제자리 `fixed` 기본값 | host 노드 이동 | remount와 조상 제약 제거 |
| tiled pane과 `container` 모드는 서버 렌더 가능 | pane 내용은 항상 클라이언트 렌더 | 렌더 경로를 하나로 |
| Grid를 CSS Grid로 배치 → 측정 + transform | 측정값을 CSS 변수 1개로 전달 + transform | 재배치 애니메이션 가능, resize 시 React 렌더 없음 |
| Grid 반응형 `cols`, `collision: 'free'` | v1 제외 | 요구사항에 없음 |
| 영속화 key namespace | 제거 | 영속화를 라이브러리가 하지 않음 |
| 드래그 중 iframe shield | pointer capture만 사용 | Phase 0에서 iframe 위 드래그가 끊기면 그때 추가 |
| `snapCollapseBelow` (드래그로 자동 접기) | v1 제외 | 요구사항에 없음. Enter 키와 액션으로 접는다 |
| `focused`를 layout에 저장 | 실행 중 상태 | 저장할 필요가 없음 |
| floating 창이 bounds 밖으로 100px만 남기고 나감 | 위쪽 가장자리는 bounds 안에 고정 | GNB를 덮지 않고 이동 handle이 닿는 곳에 남도록 |
| 접근성은 마지막 단계 | 단계별 완료 기준 | handle 프리미티브의 형태를 결정하므로 |

## 11. 확인한 사실과 확인하지 않은 것

문서로 확인한 것:

- Next.js는 client component도 서버에서 HTML로 렌더한다. 라이브러리는 entry에 `"use client"`를 두라고 권고하며, 번들러가 이를 제거할 수 있다고 경고한다.
- `useSyncExternalStore`는 `getServerSnapshot`으로 서버 렌더와 hydration을 지원한다.
- `createPortal`은 대상 DOM 노드가 이미 있어야 하고, 대상을 바꾸면 내용이 다시 만들어진다.
- `Element.moveBefore()`는 iframe 로딩 상태, 포커스, 애니메이션 상태를 유지한 채 노드를 옮긴다. Chromium은 133부터, Firefox는 2025년 10월부터 지원한다.
- iframe을 DOM에서 다시 붙이면 재로드된다. DOM에서 떼면 스크롤 위치를 잃는다.
- Base UI의 모든 part는 `render` prop으로 요소를 바꾸고, 상태를 `data-*` 속성으로 노출한다.
- W3C APG의 Window Splitter 패턴: 포커스 가능한 요소가 `role="separator"`를 갖고, 방향키로 움직이며, End(선택)와 F6(선택)을 정의한다.
- WCAG 1.4.13(AA): hover나 포커스로 나타나는 콘텐츠는 닫을 수 있고, 포인터를 올릴 수 있고, 유지되어야 한다. WCAG 2.5.7(AA, 2.2에서 추가): 드래그로 하는 기능은 드래그 없이 단일 포인터로도 가능해야 한다.

확인하지 않아 구현 중 검증할 것:

- separator의 Home, Enter 키와 `aria-valuenow`. W3C 문서에서 직접 확인하지 못했다. Phase 1에서 APG와 ARIA 명세를 대조한다.
- WCAG 2.5.7 충족 여부. 라이브러리는 액션 함수만 제공하므로, 충족은 사용자가 버튼을 붙였는지에 달려 있다.

- Safari의 `moveBefore` 지원 여부. 검색에서 지원 근거를 찾지 못했고 가장 최근 자료가 2025년 10월이다. 기능 감지로 처리하므로 설계는 영향받지 않는다.
- pane host의 StrictMode, Next.js hydration 동작 (Phase 0).
- `createPortal`의 서버 동작. 설계상 서버에서는 렌더하지 않는다.
- pointer capture가 cross-origin iframe 위에서 유지되는지 (Phase 0).
- `scrollbar-gutter: stable`, `inert`의 대상 브라우저 지원 범위 (Phase 1, 4).

## 12. 가정

- React 19 이상, Next.js App Router.
- 패키지 이름은 미정이다(가칭 `@layout/react`).
- 실제 앱은 문서 자체가 스크롤되지 않는 app shell 구조다. viewport 범위의 floating 창은 이 전제에서 동작한다(5.5).
- 대상 브라우저에 Safari가 포함되면 fallback 경로(iframe 재로드)가 실사용 경로가 된다. pane에 iframe을 쓰는지에 따라 중요도가 달라진다.
- Grid 기본값은 홈 화면 방식이다(정사각 셀, 자동 메우기 없음).

## 참고

- [Element.moveBefore() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore)
- [Preserve state during DOM mutations with moveBefore() — Chrome for Developers](https://developer.chrome.com/blog/movebefore-api)
- [New to the web platform in October 2025 — web.dev](https://web.dev/blog/web-platform-10-2025)
- [Element API: moveBefore — Can I use](https://caniuse.com/mdn-api_element_movebefore)
- [Window Splitter Pattern — WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter)
- [Understanding SC 1.4.13: Content on Hover or Focus — W3C](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus)
- [What's New in WCAG 2.2 — W3C](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)

## 13. 구현 결과 (2026-11-18)

브랜치 `feat/layout-v1`. 커밋은 SidePanels(기반 포함), Tiling, Grid(중첩 검증 포함), 마무리 순서다.

### 실행한 검증

| 항목 | 결과 |
|---|---|
| 단위 테스트 (Vitest) | 38개 통과. Tiling 무작위 연산 500회, Grid 무작위 이동 400회의 불변 조건, 기하 계산을 px 재귀 배치와 3가지 크기에서 대조 |
| e2e, `next build` + `next start` | Chromium, WebKit 각각 실행. 2회 반복에서 130개 통과, 2개 skip(WebKit의 `moveBefore` 경로 테스트) |
| e2e, `next dev` (StrictMode) | Chromium, WebKit에서 65개 통과, 1개 skip |
| 클린 checkout | 새로 clone한 뒤 README 순서(`install` → `test` → `typecheck` → `build`)로 실행 |
| 모든 e2e에 공통 | 콘솔 오류, hydration 경고, 페이지 예외 0건을 자동 검사 |
| `"use client"` 유지 | 빌드 후 스크립트(`scripts/check-directives.mjs`)가 parts는 client, entry는 서버 모듈인지 검사 |
| Server Component import | `/rsc` 페이지가 wrapper 없이 `<SidePanels.Root>`를 렌더 (prod, dev) |

Phase 0 spike 판정:

| 항목 | 결과 |
|---|---|
| 1. StrictMode에서 pane이 한 번만 mount | 통과. split, hide, show, float, dock 전후로 컴포넌트 인스턴스가 같다 |
| 2. Root ↔ 레이어 이동 후 React state 유지 | 통과 |
| 3. `transform` 조상 안에서 viewport 좌표 표시 | 통과 (`/showcase`) |
| 4. `moveBefore` 경로에서 iframe 유지, fallback 경로에서 포커스와 스크롤 복원 | 통과. fallback은 Chromium에서 `moveBefore`를 지운 경우와 WebKit(미지원) 양쪽에서 확인. 두 경우 모두 iframe은 재로드된다 |
| 5. iframe 위 드래그 | 통과. separator를 iframe pane 안으로 끌어도 끝까지 따라간다(Chromium, WebKit, 오차 1px). iframe shield는 추가하지 않았다 |

→ plan B 없이 5.3의 방식으로 진행했다.

단계별 완료 기준 중 실행하지 않은 것:

- Firefox에서의 e2e. 설치하지 않았다.
- 접근성은 ARIA 속성과 키보드 조작만 e2e로 확인했다. 스크린 리더 확인은 하지 않았다.
- `minVisible: 'full'`은 단위 테스트로만 확인했다. 브라우저 e2e는 기본값(100px)만 다룬다.
- Grid 자동 스크롤(드래그 중 가장자리)은 구현하지 않았다 (후순위 항목).
- Grid 반응형 브레이크포인트 등 1장의 v1 제외 항목.

### 설계에서 달라진 점

| 설계 | 구현 | 이유 |
|---|---|---|
| entry 파일에 `"use client"` | parts 모듈에 `"use client"`, entry는 서버 모듈 | client 모듈의 namespace export는 Server Component에서 점 표기로 쓸 수 없었다(prerender 오류). 덕분에 순수 함수(`toggleCollapsed` 등)는 서버에서도 쓸 수 있다 |
| `render` prop은 요소 | lazy 노드도 받는다 | dev 모드에서 Server Component가 넘긴 요소가 lazy 노드로 와서 hydration mismatch가 났다 |
| bounds 요소는 layout effect에서 측정 | ref가 비어 있으면 commit 직후(microtask)에 다시 측정 | 자식(Tiling)의 layout effect가 부모(SidePanels Root)의 ref가 붙기 전에 실행되어 viewport로 잘못 측정했다 |
| Grid의 `data-resizing`은 컨테이너 resize 중에만 | 첫 측정에도 붙인다 | 셀 너비가 0에서 실제 값으로 바뀌면서 사용자 transition으로 아이템이 왼쪽 위에서 날아왔다 |
| Grid `ResizeHandle` 방향 지정 | 오른쪽 아래 하나 | 홈 화면 위젯 방식에 충분. 필요하면 Tiling의 `edge`처럼 확장 |
| `useTiling()`, `usePane()` | `usePane()`은 자기 pane의 placement와 포커스만 구독 | `useTiling()`은 layout 전체를 구독하므로, pane 헤더가 쓰면 separator 드래그 중 매 프레임 리렌더된다 |
| `Tiling.MoveHandle`은 floating일 때만 | tiled 상태에서는 handle 동작 없이 children만 렌더 | 제목 표시줄을 그대로 감쌀 수 있게 |
| 접힌 패널은 너비 0 | 너비, padding, 테두리 모두 0 | 사용자 테두리 1px이 남아 overlay 전환 시 Main이 1px 움직였다 |

구현 중 고친 공용 버그:

- `useStoreSelector`가 store 값이 같으면 selector closure가 바뀌어도 이전 결과를 돌려줬다. Grid placeholder가 드래그 후 남는 문제로 발견했다.
- 드래그 중 pointerup이 rAF보다 먼저 오면 마지막 이동이 반영되지 않았다. WebKit e2e에서 발견했다. 이제 놓는 순간 마지막 이동을 먼저 반영한다.

### 사용 시 알아둘 것

- 패널 내용은 접힐 때 너비가 0이 된다. 내용이 찌그러지지 않게 하려면 안쪽 요소에 `width: var(--side-panel-size)`를 준다.
- `render` prop의 lazy 노드 처리는 React 내부 필드(`_init`, `_payload`)를 읽는다. React를 올릴 때 `/rsc` dev e2e로 확인해야 한다.
- hover로 연 overlay는 포커스 위치와 관계없이 Esc로 닫힌다(문서 전체 keydown 감지).
- Grid Root의 padding은 0으로 고정된다. 여백이 필요하면 바깥 요소에 준다.
- 한 페이지에 viewport 범위 Tiling이 여러 개면 창의 z-order는 각 Tiling 안에서만 정해진다(레이어 공용 카운터는 구현하지 않음).
