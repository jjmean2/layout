import type { ComponentPropsWithRef, ReactElement } from 'react'

export type PartProps<Extra = object> = Omit<ComponentPropsWithRef<'div'>, keyof Extra> &
  Extra & {
    /** 기본 div 대신 렌더할 요소. 예: render={<aside />} */
    render?: ReactElement<Record<string, unknown>>
  }
