import type { ComponentPropsWithRef, CSSProperties, HTMLAttributes, ReactElement, Ref } from 'react'

/** part가 render 함수에 넘기는 props */
export type RenderFnProps = HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> } & Record<string, unknown>

/** 요소를 직접 만드는 render 함수. props를 펼치고 state로 내용을 바꿀 수 있다. */
export type RenderFn<State> = (props: RenderFnProps, state: State) => ReactElement

export type PartProps<Extra = object, State = Record<string, unknown>> = Omit<
  ComponentPropsWithRef<'div'>,
  keyof Extra | 'className' | 'style'
> &
  Extra & {
    /** 기본 div 대신 렌더할 요소, 또는 요소를 만드는 함수. 예: render={<aside />} */
    render?: ReactElement<Record<string, unknown>> | RenderFn<State>
    /** class 이름, 또는 part의 상태를 받아 class 이름을 돌려주는 함수 */
    className?: string | ((state: State) => string | undefined)
    /** style, 또는 part의 상태를 받아 style을 돌려주는 함수. 배치용 키는 라이브러리 값이 우선한다 */
    style?: CSSProperties | ((state: State) => CSSProperties | undefined)
  }
