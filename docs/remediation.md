# 리뷰 결과 근본 수정 설계

- 상태: 구현 완료 (2026-11-18). `main` 위의 stack 8개 레이어로 진행했다. 결과는 맨 끝 "구현 결과"
- 대상: `packages/layout` v1
- 결정 (권장안 채택):
  - 사이드 패널 손잡이를 `SidePanels.Separator`(Root 직계)로 옮기고, HoverTrigger는 별도 요소로 두되 tab 순서에서 뺀다
  - `onLayoutChange`는 놓을 때 한 번 호출하는 의미를 유지하고 `details`를 추가한다
  - 라벨은 라이브러리가 문구를 갖지 않고 관계(`aria-labelledby`)로 만든다
  - LICENSE 종류는 미정이다
- 원칙: 리뷰 지적을 하나씩 덧대지 않는다. 지적들을 만든 **원인 구조**를 바꾸고, 그 결과로 지적이 사라지게 한다. 각 원인마다 **지금 실패하는 테스트**를 먼저 만들고, 그 테스트가 통과하는 것을 완료 기준으로 삼는다.

## 0. 원인 요약

| # | 원인 | 이 원인에서 나온 지적 |
|---|---|---|
| A | 상태가 여러 곳에 흩어져 있다. 확정값은 React 렌더 값, draft는 store, 설정은 ref에 있다 | 함수형 commit 손실, 렌더 중 ref 쓰기, 렌더 순서에 따른 `mainMinSize` |
| B | 렌더가 순수하지 않다. 렌더 중에 DOM과 공유 객체를 바꾼다 | `hosts.get()` DOM 생성, `ctx.state = state`, `order.current`, `mergeRefs` 매 렌더 재생성 |
| C | 상호작용 요소의 역할(semantics)을 정하지 않고 속성만 붙였다 | 접을 때 포커스 손실, `HoverTrigger` 클릭 불가, role 없는 이름, 범위 밖 `aria-valuenow`, 영어 고정 이름 |
| D | 닫기(dismiss) 소유권이 없다. 각자 Esc를 듣는다 | 문서 전체 Esc가 다른 레이어와 충돌 |
| E | 배포 형식을 검증하지 않았다 | Node ESM 로드 실패, source map, 패키지 메타데이터 |
| F | `render` 처리가 React 내부 구조에 기댄다 | `_init`, `_payload` 읽기, 요소만 받는 `render` |
| G | 공개 API가 구독 범위와 변경 원인을 표현하지 못한다 | 전체 layout 구독 hook, `onLayoutChange` 의미, 사용자 id를 DOM id로 사용 |
| H | 자동 검사 장치가 없다 | lint, 포매터, CI, LICENSE, 컴포넌트 단위 테스트 |

각 절은 같은 순서로 쓴다: 실패 테스트 → 구조 변경 → 지워지는 코드 → 사라지는 지적 → 공개 API 영향.

---

## A. 상태 소유: Root마다 controller 하나

### 실패 테스트

```ts
// 한 핸들러에서 두 액션. controlled와 uncontrolled 모두
api.toggle('left'); api.toggle('right')
// 기대: 두 패널 모두 접힘. 현재: left 변경이 사라진다 (2026-11-18 두 모드 모두 재현)
```

### 원인

`commit(fn)`은 렌더 때만 갱신되는 `committedRef`에 `fn`을 적용한다. 같은 tick에서 두 번 부르면 두 번째도 렌더 전 값에서 출발한다. 설정값(`minSize`, `mainMinSize`, `gap`)도 렌더 중 ref에 써서, 읽는 쪽이 렌더 순서에 따라 오래된 값을 본다.

### 구조

Root마다 React 밖에 **controller 객체 하나**를 둔다. 모든 상태와 액션이 여기 있다.

```ts
interface Controller<L, C, R> {
  // 상태
  getLayout(): L        // 화면에 보이는 값 = draft ?? committed
  getCommitted(): L     // 액션이 동기적으로 읽는 단일 기준값
  getConfig(): C        // part가 등록한 설정 (minSize 등)
  getRuntime(): R       // 포커스, 드래그 대상, bounds 측정값
  subscribe(listener): () => void

  // 변경
  preview(next: L): void                          // 드래그 중
  commit(update: L | ((prev: L) => L), reason: ChangeReason): void
  cancel(): void

  // React와의 연결 (layout effect에서만 호출)
  syncProps(props: { layout?: L; onLayoutChange?: Fn }): void
  registerConfig(key, value): () => void
}
```

- **액션은 controller의 committed에서 출발한다.** `commit(fn)`은 `fn(getCommitted())`를 계산하고 committed를 즉시 갱신한다. 같은 tick에서 여러 번 불러도 이어서 적용된다.
- **uncontrolled 모드:** controller가 진짜 소유자다. React state를 쓰지 않는다.
- **controlled 모드:** `layout` prop이 진실이다. commit은 controller의 committed를 *낙관적으로* 바꾸고 `onLayoutChange(next, details)`를 호출한다. `syncProps`에서 규칙은 다음과 같다.

  | 다음 렌더의 `layout` prop | 처리 |
  |---|---|
  | 낙관값과 같음 | 그대로 둔다 |
  | 이전 prop과 같음 (부모가 거절하거나 무시) | committed를 prop으로 되돌린다 |
  | 다른 값 (부모가 바꿈, 예: 저장 규칙 적용) | prop을 채택한다 |

  부모가 무시하면 Root가 다시 렌더되지 않으므로, commit은 Root에 렌더를 하나 예약한다(현재의 `forceRender`와 같은 역할이지만 controller 안에서 일어난다).
- **설정은 등록한다.** `Panel`, `Main`, `Item`은 자기 설정을 layout effect에서 `registerConfig`로 등록하고, cleanup에서 해제한다. 렌더 중 ref 쓰기가 없어진다. `Panel`의 너비 계산처럼 다른 part의 설정이 필요하면 controller를 구독한다. 순서에 따른 차이가 없어진다.
- **React 연결은 하나뿐이다.** `useController(create, props)`: controller는 `useState` 초기화로 한 번 만든다. props 동기화는 layout effect에서 한다. part는 `useSyncExternalStoreWithSelector`(React 팀의 `use-sync-external-store` 패키지)로 필요한 조각만 구독한다.

### 지워지는 코드

`internal/use-layout-state.ts`(전체), 세 Root의 `ctx.state = state`, `mainMinSize` ref, Grid의 `options` ref, 직접 만든 `useStoreSelector`의 캐시 로직.

### 사라지는 지적

함수형 commit 손실(높음 3), 렌더 중 ref 쓰기 일부(중간 5), 렌더 순서에 따른 `mainMinSize`.

### 공개 API

바뀌지 않는다. `onLayoutChange`에 두 번째 인자 `details`가 추가될 수 있다(G 참조).

---

## B. 렌더 순수성

### 실패 테스트

- `eslint-plugin-react-hooks`(compiler 규칙 포함 recommended 설정)를 돌리면 오류가 0건이어야 한다. 지금은 렌더 중 ref 접근, 조건부 `useRender` 호출이 걸릴 것으로 예상한다(도구를 아직 돌리지 않았으므로 첫 작업으로 확인).
- 기존 e2e의 mount 1회, StrictMode, fallback 검사가 계속 통과해야 한다.

### 구조

1. **pane host는 controller가 effect에서 관리한다.**
   - pane id 집합이 바뀌면 layout effect에서 host를 만들거나 지우고, 올바른 부모로 옮긴다.
   - 끝나면 `hostsVersion`을 올려 `Panes`가 다시 렌더된다.
   - `Panes`는 렌더 중 host를 읽기만 한다. 아직 host가 없는 pane은 portal을 렌더하지 않는다.
   - 비용: pane이 추가될 때 렌더가 한 번 더 일어난다.
   - DOM 순서는 controller가 관리하는 "추가된 순서" 목록으로 정한다. `useMemo` 안의 ref 변경이 없어진다.
2. **`useRender`를 hook이 아닌 함수 `renderPart`로 바꾼다.** 조건 분기 없이 한 번만 부른다. `MoveHandle`은 floating 여부와 상관없이 같은 요소를 렌더하고, 핸들러와 속성만 바꾼다.
3. **ref 병합을 메모이즈한다.** `useMergedRefs(a, b)`로 바꾸고, ref가 바뀔 때만 새 콜백을 만든다. cleanup에서는 object ref를 null로 비우고 함수 ref의 cleanup을 모두 실행한다.
4. **최신 값 ref는 layout effect에서 갱신한다.** `useEffectEvent`는 Effect 안에서만 호출할 수 있어서(react.dev 확인), 이벤트 핸들러에서 불리는 드래그 콜백에는 쓸 수 없다. 그래서 `useLatest(value)`(layout effect에서 ref 갱신)를 쓴다. Effect 안에서만 쓰는 콜백은 `useEffectEvent`를 쓴다.

### 지워지는 코드

`Panes`의 `order` ref와 렌더 중 `hosts.get`, `mergeRefs`, 조건부 `useRender`, 대부분의 `xxxRef.current = xxx`.

### 사라지는 지적

중간 5, 6, 11. 설계 문서 3.5의 "render 중 document 금지"와 실제 코드가 일치하게 된다.

### 공개 API

바뀌지 않는다.

### 위험

pane host 이동은 이 라이브러리에서 가장 위험한 부분이다. **독립 레이어**로 진행하고, mount 1회, StrictMode, `moveBefore` 없는 경로, WebKit e2e를 완료 기준으로 둔다.

---

## C. 상호작용 요소의 역할 모델

### 실패 테스트

1. 왼쪽 손잡이에 포커스 → Enter → **포커스가 손잡이에 남아 있고**, 다시 Enter를 누르면 펼쳐진다. 현재는 포커스가 `<body>`로 간다(재현함).
2. 접힌 상태에서 `HoverTrigger`를 클릭(터치 탭과 같은 경로)하면 overlay가 열린다. 현재는 열리지 않는다.
3. axe(`@axe-core/playwright`)를 모든 story에서 돌려 위반 0건.

### C-1. 사이드 패널 손잡이를 Panel 밖으로 옮긴다

APG Window Splitter(원문 확인):
- Enter는 필수이고 접기를 전환한다.
- 값은 기본 패널(primary pane)의 위치이며 보통 0~100이다.
- `aria-controls`는 기본 패널을 가리킨다.
- 이름은 기본 패널에 보이는 제목이 있으면 `aria-labelledby`로 연결하고, 없으면 `aria-label`을 쓴다.

손잡이가 접히는 패널 안에 있으면 `inert` 때문에 Enter로 다시 펼 수 없다. 그래서:

```tsx
<SidePanels.Root>
  <SidePanels.Panel side="left">…</SidePanels.Panel>
  <SidePanels.Separator side="left" />   {/* Root의 직계 자식. 이름도 Separator로 통일 */}
  <SidePanels.Main>…</SidePanels.Main>
</SidePanels.Root>
```

- 라이브러리가 Separator를 패널 경계에 배치한다(`--side-panel-left-size` 같은 CSS 변수로 위치를 정한다).
- 접히면 Root 가장자리(x=0)에 남는다. 포커스가 유지되고 Enter로 다시 펼 수 있다.
- **값:** `aria-valuenow`는 0~100 퍼센트로 표현한다(APG 예시와 같다). `aria-valuetext="280px"`를 함께 준다. 접히면 0이다.
- **`HoverTrigger`와의 관계 (결정 필요):**
  - **(권장) 두 요소로 둔다.** Separator는 키보드와 크기 조정을, HoverTrigger는 포인터의 임시 열기를 맡는다. HoverTrigger는 tab 순서에서 뺀다(`tabIndex=-1`). 키보드 사용자는 Separator의 Enter로 펴면 된다. tab stop이 하나만 늘어나지 않는다.
  - 하나로 합치기: 접힌 Separator가 hover 영역도 겸한다. 요소 수는 줄지만, 크기 조정 손잡이와 열기 버튼이 한 요소에 섞여 역할이 모호하다.

### C-2. HoverTrigger를 진짜 버튼으로

- 기본 요소를 `<button type="button">`으로 바꾼다.
- `onClick`은 overlay를 토글한다. 터치, 스크린 리더, 마우스 클릭이 모두 이 경로를 쓴다.
- hover 지연 열기는 포인터 보조 기능으로 남긴다. Space와 Enter는 네이티브 버튼 동작에 맡긴다.

### C-3. 이동/크기 손잡이 (Tiling floating 창, Grid 아이템)

APG에 해당 패턴이 없다. 그래서 선례 중에서 고른다.

| 선택 | 선례 | 내용 |
|---|---|---|
| **(권장)** `role="button"` + `aria-roledescription` + `aria-describedby` 조작 안내 + live region 알림 | dnd-kit의 기본 접근성 구현 (확인 필요) | 방향키로 이동하고, 이동 후 "위젯 a, 2열 3행으로 이동"처럼 알린다 |
| 역할 없이 숨김, 액션 버튼으로 대체 | WCAG 2.5.7의 "드래그 대안" | 키보드 이동을 빼고 "앞으로/뒤로" 버튼만 제공 |

- floating 창(`Tiling.Pane`이 floating일 때)은 `role="dialog"` + `aria-modal="false"` + 이름을 쓰는 것을 제안한다. 비모달 창의 일반적 표현이지만, 이것도 표준 패턴은 아니다.
- tiled pane은 `role="group"` + 이름을 쓴다.

### C-4. 이름(라벨)과 i18n (결정 필요)

| 선택 | 내용 |
|---|---|
| **(권장) 라벨을 관계로 만든다** | Separator는 `aria-labelledby`로 기본 패널의 이름을 참조한다(APG 방식). Panel과Pane에 `aria-label` 또는 제목 id를 받는다. 라이브러리는 문자열을 갖지 않는다. 이름이 없으면 개발 모드에서 경고한다 |
| 메시지 사전 | Root에 `messages` prop을 두고 기본 영어 문구를 둔다 (React Aria 방식). 문구 관리가 라이브러리 책임이 된다 |

### 지워지는 코드

- 하드코딩된 영어 `aria-label` 7곳
- `Panel` 안의 `ResizeHandle` 배치 로직
- `HoverTrigger`의 keydown 열기 처리

### 사라지는 지적

높음 2와 4, 중간 7과 8과 9, 낮음의 Space 처리 시점.

### 공개 API

**바뀐다.**
- `SidePanels.ResizeHandle`(Panel 자식)이 `SidePanels.Separator side=…`(Root 자식)로 바뀐다.
- `HoverTrigger`의 기본 요소가 `<button>`으로 바뀐다.
- 기본 `aria-label`이 사라진다.
- showcase, storybook, playground, README를 모두 고쳐야 한다.

---

## D. 닫기 소유권: dismissable layer stack

### 실패 테스트

overlay가 열린 상태에서 Main 안에 다른 라이브러리의 dialog를 열고 Esc를 누르면 dialog만 닫혀야 한다. 지금은 overlay도 함께 닫힌다.

### 구조

- 열려 있는 overlay는 문서 수준의 **layer stack**에 자신을 등록한다. Esc는 맨 위 layer만 처리한다.
- 다른 라이브러리와 공존하기 위해, 이미 처리된 이벤트(`defaultPrevented`)는 무시한다. Esc를 처리하면 `preventDefault`를 호출해 다른 쪽에 알린다. 이것이 Radix의 DismissableLayer와 React Aria의 공통 관례다(구현 시 각 문서에서 확인).
- 포인터로 연 overlay도 같은 stack에 들어간다. 포커스 위치와 무관하게 닫을 수 있다는 WCAG 1.4.13 조건은 "맨 위 layer일 때"라는 조건 아래에서 유지된다.

### 지워지는 코드

`Panel`의 문서 전체 Esc effect, `onKeyDown` Esc 처리.

### 사라지는 지적

낮음의 Esc 충돌.

### 공개 API

바뀌지 않는다.

---

## E. 배포 형식

### 실패 테스트

`node -e "import('@justwonder/layout/side-panels')"`가 성공해야 한다. 지금은 `ERR_MODULE_NOT_FOUND`(재현함).

### 구조

- **import 경로 형식:** `module`과 `moduleResolution`을 `NodeNext`로 바꾸고, 소스의 상대 import에 `.js`를 붙인다. TypeScript가 라이브러리에 권장하는 형식이다.
- **확인할 환경 (구현 중 검증):**
  - tsc 7 emit
  - Vitest
  - Next(Turbopack, 빌드된 `dist`를 소비)
  - Storybook의 Vite alias. 소스를 직접 불러오므로, `.js` 경로가 `.ts`로 해석되어야 한다.
  - 하나라도 실패하면 대안은 `.ts` 경로 + `rewriteRelativeImportExtensions`다.
- **빌드 산출물:** source map에 원문을 넣는다(`inlineSources: true`). `files`는 `dist`만 유지한다.
- **`package.json`:**
  - `exports`에 `./package.json`을 추가한다.
  - `license`, `repository`, `homepage`를 채운다.
  - peer는 `react`와 `react-dom`의 `^19.0.0`으로 한다.
- **영구 검사:** 빌드 후 스크립트가 각 entry를 `node`로 import해 본다(`scripts/check-directives.mjs`를 `check-dist.mjs`로 확장). CI에서 pack한 tarball로 `publint`와 `@arethetypeswrong/cli`를 돌린다(**버전 고정 devDependency**로 설치).

### 사라지는 지적

높음 1, 중간 10, 낮음의 peer 범위와 메타데이터.

### 공개 API

바뀌지 않는다.

---

## F. render prop: React 내부 구조에 기대지 않기

### 실패 테스트

`/rsc` 페이지를 `next dev`로 열 때 hydration 오류가 0건이어야 하고, `merge-props.ts`에서 `_init`, `_payload`를 쓰지 않아야 한다.

### 구조

- Server Component가 넘긴 요소는 dev에서 lazy 래퍼로 온다. 이것은 React 이슈 #32392로 알려진 동작이다(Base UI 소스 주석에서 확인).
- Base UI는 이를 **공개 API인 `React.Children.toArray`**로 푼다. `toArray`가 lazy 타입을 풀기 때문이다. `$$typeof` 비교는 남지만 내부 함수를 호출하지는 않는다. 같은 방식을 쓴다.
- `render`에 함수 형식 `(props, state) => element`를 추가한다. 함수형 `className`과 `style`도 받는다(Base UI 형식).
- 병합 우선순위:
  - 사용자 값이 이긴다(Base UI와 같음).
  - 단, **배치에 필요한 style 키**(`position`, `left`, `top`, `width`, `height`, `transform`, `display`)만 라이브러리 값이 이긴다.
  - 이 목록을 문서와 타입 주석에 명시한다.

### 지워지는 코드

`resolveLazy`.

### 사라지는 지적

React 내부 필드 의존, 낮음의 render 형식과 병합 순서.

### 공개 API

함수형 `render`, `className`, `style`이 추가된다(호환됨). style 병합 순서가 바뀐다(배치 키 외에는 사용자 우선).

---

## G. 공개 API의 구독 범위와 변경 원인

### 실패 테스트

separator를 드래그하는 동안, `useTilingActions()`만 쓰는 pane 헤더의 렌더 횟수가 0이어야 한다. 지금은 `useTiling()`을 쓰면 매 프레임 렌더된다.

### 구조

- **hook을 나눈다.**
  - `useXxxActions()`: 안정적인 액션 묶음. 구독하지 않는다.
  - `useXxxLayout(selector?)`: 선택 구독.
  - 기존 `useTiling()` 같은 전체 구독 hook은 두 hook을 합친 편의 hook으로 남기거나 제거한다.
- **`onLayoutChange(layout, details)`:**
  - `details.reason`: `'drag' | 'keyboard' | 'action' | 'external'`
  - `details.source`: 관련 part, 예를 들어 separator key나 pane id
  - Base UI의 `eventDetails` 관례를 따른다.
- **DOM id를 안전하게 만든다.** 사용자 pane id를 그대로 쓰지 않는다. controller가 pane마다 `useId` 기반 접두어 + 순번으로 id를 발급한다.

### `onLayoutChange` 의미 (결정 필요)

| 선택 | 내용 |
|---|---|
| **(권장) 지금 의미를 유지한다.** 놓을 때 한 번 호출하고, `layout`/`onLayoutChange`를 controlled 값 쌍으로 둔다. `details`를 추가하고, 드래그 중 값이 필요하면 별도 `onLayoutPreview`를 둔다 | 부모가 매 프레임 렌더되지 않는다. 레이아웃은 앱 전체를 감싸므로 이 비용이 크다. react-resizable-panels와 의미가 다르다는 점은 문서에 적는다 |
| react-resizable-panels처럼 바꾼다. `onLayoutChange`는 이동할 때마다, `onLayoutChanged`는 놓을 때 호출한다 | 그 라이브러리를 아는 사용자에게 익숙하다. 하지만 controlled 부모가 `onLayoutChange`로 state를 갱신하면 매 프레임 렌더된다 |

### 사라지는 지적

낮음의 전체 구독 hook, DOM id, 콜백 의미.

### 공개 API

hook이 추가되거나 이름이 바뀐다. `onLayoutChange`에 인자가 추가된다.

---

## H. 자동 검사

- ESLint flat config: `eslint-plugin-react-hooks` recommended(compiler 규칙 포함). Prettier로 포맷을 고정한다. B의 완료 기준이 이 lint다.
  - TypeScript 7 패키지에는 JS API(`createSourceFile` 등)가 없어서 `typescript-eslint`가 돌지 않는다(peer 범위도 `<6.1.0`). TS 문법은 `@babel/eslint-parser`로 읽고, 타입 정보가 필요한 규칙은 쓰지 않는다. 타입 검사는 `tsc`가 맡는다.
  - 기준값(2026-11-18): 29건 (refs 21, immutability 4, rules-of-hooks 3, set-state-in-effect 1). lint는 0건이 되는 레이어에서 blocking으로 바꾼다.
- **컴포넌트 단위 테스트:** Vitest browser mode(Playwright provider)로 controller와 part를 테스트한다. 대상은 controlled/uncontrolled 전환, 부모 거절, 연쇄 commit, ref 병합, render 함수 형식이다. 지금은 모델 단위 테스트와 e2e 사이가 비어 있다.
- **axe:** `@axe-core/playwright`를 storybook e2e에 넣는다.
- **CI (GitHub Actions):** install → lint → typecheck → unit → build(+ dist import 검사) → publint/attw → e2e(Chromium, WebKit) → storybook smoke 순서로 돈다.
- **저장소:** LICENSE를 추가한다(라이선스 종류는 결정 필요). changesets는 배포를 결정할 때 추가한다.
- **문서:** `docs/design.md`의 3.1(레이아웃별 `store.ts`)과 3.8(`useHoverReveal`, `useElementSize`)을 실제 구조에 맞게 고친다. 이 설계의 A, B, C가 끝나면 3장을 다시 쓴다.

---

## 지적 추적표

| 리뷰 지적 | 심각도 | 처리 | 절 |
|---|---|---|---|
| dist가 Node ESM에서 로드 안 됨 | 높음 | 수정 | E |
| HoverTrigger 클릭 없음 | 높음 | 수정 | C-2 |
| 키보드로 접으면 포커스 손실 | 높음 | 수정 (구조 변경) | C-1 |
| 함수형 commit 손실 | 높음 | 수정 (구조 변경) | A |
| 렌더 중 부수효과와 ref 쓰기 | 중간 | 수정 | A, B |
| `mergeRefs` 재생성과 cleanup | 중간 | 수정 | B |
| `aria-valuemax` 범위 | 중간 | 수정 (퍼센트 값) | C-1 |
| role 없는 요소에 이름 | 중간 | 수정 | C-3 |
| 영어 고정 이름 | 중간 | 수정 (관계형 라벨) | C-4 |
| source map | 중간 | 수정 | E |
| 조건부 `useRender` | 중간 | 수정 | B |
| lint, CI, LICENSE, 테스트 공백 | 중간 | 수정 | H |
| `render` 형식이 좁음 | 낮음 | 수정 | F |
| `onLayoutChange` 의미 | 낮음 | 결정 필요 (권장: 유지 + `details`) | G |
| style 병합 순서 | 낮음 | 수정 (배치 키만 라이브러리 우선) | F |
| peer 범위 `>=19` | 낮음 | 수정 (`^19.0.0`) | E |
| 메타데이터 누락 | 낮음 | 수정 | E |
| 사용자 pane id를 DOM id로 사용 | 낮음 | 수정 | G |
| 문서 전체 Esc 충돌 | 낮음 | 수정 (layer stack) | D |
| HoverTrigger Space를 keydown에서 처리 | 낮음 | 수정 (네이티브 버튼) | C-2 |
| 전체 구독 hook | 낮음 | 수정 | G |
| `docs/design.md`와 코드 불일치 | 낮음 | 수정 | H |
| React 내부 필드 의존 | (추가) | 수정 | F |
| CJS 없음 | 낮음 | 하지 않음. React 19, Next, Vite 모두 ESM을 지원하고, 이중 패키지는 상태가 둘로 갈리는 위험이 있다 | — |

## 구현 순서 (stack 레이어)

현재 stack(#1 ← #2 ← #3 ← #4) 위에 원인별로 하나씩 쌓는다. 각 레이어의 완료 기준은 해당 절의 실패 테스트 통과 + 기존 테스트 전체 통과다.

| 레이어 | 내용 | 공개 API |
|---|---|---|
| `fix/tooling` | H의 lint, 포매터, CI, 컴포넌트 테스트 기반. 먼저 들어가야 이후 레이어의 완료 기준(lint 0건)을 쓸 수 있다 | 없음 |
| `fix/packaging` | E | 없음 |
| `fix/controller` | A | `details` 인자 |
| `fix/render-purity` | B (pane host 포함, 가장 위험) | 없음 |
| `fix/render-prop` | F | 추가만 |
| `fix/a11y-model` | C, D | **바뀜** |
| `fix/api-hooks` | G | **바뀜** |
| `docs/design-v2` | `docs/design.md` 3장 재작성, README, 이 문서의 상태 갱신 | 없음 |

---

## 구현 결과 (2026-11-18)

### 레이어와 완료 기준

| 레이어 | 완료 기준 | 결과 |
|---|---|---|
| `fix/tooling` | lint, 포매터, CI, 컴포넌트 테스트 기반 | ESLint 기준값 29건 기록, Prettier 서식 커밋 분리, Vitest browser 프로젝트, CI workflow |
| `fix/packaging` | `node`가 `dist`의 모든 entry를 import | 통과. 빌드마다 `check-dist.mjs`가 검사. publint `--strict`, attw(esm-only) 통과 |
| `fix/controller` | 한 핸들러의 액션 두 번 (controlled, uncontrolled), 부모 거절 | 통과. controller 상태 전이 테스트 10개(Node), 컴포넌트 테스트 3개 |
| `fix/render-purity` | lint 0건, mount 1회 / StrictMode / fallback e2e | 통과. lint를 CI blocking으로 전환 |
| `fix/render-prop` | `_init`/`_payload` 미사용, `/rsc` dev hydration 0건 | 통과 |
| `fix/a11y-model` | Enter로 접은 뒤 포커스 유지, 트리거 클릭, Escape 레이어, 이름 누락 0건 | 통과. dev e2e가 이름 누락 경고를 실패로 처리, storybook e2e에 axe |
| `fix/api-hooks` | 액션 전용 hook이 layout 변경에 리렌더 0회, 공백 포함 pane id | 통과 |
| `docs/design-v2` | 설계 문서 3장과 실제 구조 일치 | 이 문서와 함께 |

### 설계에서 달라진 점

| 설계 | 구현 | 이유 |
|---|---|---|
| ESLint에 `@typescript-eslint` | `@babel/eslint-parser` + `eslint-plugin-react-hooks` | TypeScript 7 패키지에 JS API가 없어 typescript-eslint가 돌지 않는다. 타입 정보 규칙은 쓰지 않는다 |
| SidePanels Separator 값은 0~100 퍼센트 | 패널 너비 px, 최소 0(접힘), 최대 = maxSize 또는 측정한 가용 너비 + `aria-valuetext` | 퍼센트는 Root 너비가 필요해 서버와 첫 렌더 값이 달라진다. APG는 0~100을 "보통"으로 둘 뿐 요구하지 않는다. 측정 전에는 현재 너비를 최대값으로 써서 서버와 클라이언트가 같다 |
| 이동 손잡이에 `aria-roledescription` + 조작 안내 + live region 알림 | `role="button"`만 주고 이름은 사용자가 준다 | "라이브러리는 문구를 갖지 않는다" 결정과 충돌한다. live region 알림은 하지 않았다 (아래 미구현) |
| 최신 값 ref를 `useEffectEvent`로 | `useLatest` (layout effect에서 갱신) | `useEffectEvent`는 Effect 안에서만 호출할 수 있다 |
| 드래그로 접기는 v1 제외 | 최소 너비의 절반보다 좁히면 접히고, 접힌 Separator를 끌면 펼쳐진다 | Separator가 접힌 상태에서도 남게 되면서, 끌어서 펼치는 동작이 필요해졌다 |
| `onLayoutPreview` (드래그 중 값) | 구현하지 않음 | `useXxxLayout(selector)`가 드래그 중 값을 구독할 수 있어 별도 콜백이 필요 없다 |

### 공개 API 변경

| 이전 | 이후 |
|---|---|
| `<SidePanels.ResizeHandle />` (Panel 자식) | `<SidePanels.Separator side="left" />` (Root 자식) |
| `HoverTrigger` = `div role="button"`, tab 가능, Enter로 열기 | `<button type="button" tabIndex={-1}>`, 클릭으로 토글 |
| 기본 영어 `aria-label` (손잡이, separator, 트리거) | 없음. 패널과 pane의 `aria-label`을 참조하거나 사용자가 준다 |
| `onLayoutChange(layout)` | `onLayoutChange(layout, details)` |
| `render`는 요소만 | 요소 또는 `(props, state) => 요소`. `className`, `style`도 state 함수 허용 |
| style 병합: 라이브러리 값 우선 | 사용자 값 우선, 라이브러리 배치 키만 보호 |
| 그 밖의 속성 병합: 라이브러리 우선(data/aria/role/tabIndex 제외) | 사용자 값 우선 |
| `useSidePanels`, `useTiling`, `useGrid`만 | `useXxxActions`, `useXxxLayout` 추가 |
| peer `react >=19` | `^19.0.0` |
| `dist` 상대 import에 확장자 없음 | `.js` 확장자 (Node ESM) |

### 마무리 검토에서 고친 것

- 리뷰 지적 8(역할 없는 요소의 이름)이 일부 되살아났던 것을 고쳤다. SidePanels.Panel은 기본 div일 때 이름 붙은 `region`이 되고(render로 준 `<nav>`, `<aside>`는 그 역할을 유지), tiled 상태의 `Tiling.MoveHandle`은 이름 속성을 내보내지 않는다. axe는 이 문제를 violation이 아니라 incomplete(`aria-prohibited-attr`)로 분류하므로 검사에 포함했다.
- `Grid.Root`가 함수형 `style`을 버리고 사용자 style 키를 모두 덮어쓰던 문제를 고쳤다.
- showcase 모든 라우트에 axe를 추가했고, 드러난 앱 쪽 문제(옅은 배경 위 글자 대비, 키보드로 접근할 수 없는 스크롤 영역, 차트 역할, 24px 미만 손잡이)를 고쳤다.
- README에서 Playwright 브라우저 설치를 `pnpm test`보다 앞으로 옮겼다(컴포넌트 테스트가 Chromium에서 돈다).

### 실행한 검증 (마지막 레이어 기준)

- 단위 + 컴포넌트 테스트 58개 (Vitest, Node + Chromium)
- lint 0건, Prettier, typecheck(TS 7), build + dist 검사, publint, attw
- e2e: playground prod(Chromium, WebKit) 69개 통과 1개 skip, playground dev 69개, showcase prod/dev 각 7개(prod는 axe 포함), storybook 14개(axe 포함)

### 실행하지 않은 것, 구현하지 않은 것, 알려진 동작

- CI는 push하지 않아 GitHub Actions에서 돌려보지 않았다. 같은 명령을 로컬에서 실행했다.
- Firefox, 스크린 리더 확인.
- 이동 결과 live region 알림, 조작 안내 문구 (문구를 사용자가 주는 API가 필요하다).
- LICENSE와 `license` 필드 (종류 미정).
- controlled 부모가 값을 비동기로 받아들이면(transition, 비동기 검증) 다음 렌더에서 한 번 원래 값으로 돌아갔다가 새 값을 받는다.
- `render`, `className`, `style` 함수가 받는 part 상태는 타입이 `Record<string, unknown>`이다. part별 상태 타입은 아직 없다.
- lint에는 타입 정보를 쓰는 규칙이 없다 (TypeScript 7과 typescript-eslint 비호환).
