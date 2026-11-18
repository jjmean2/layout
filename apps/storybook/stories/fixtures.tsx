import { Tiling, usePane, type FloatingOptions, type TilingLayout } from '@justwonder/layout/tiling'

function PaneHead({ title }: { title: string }) {
  const pane = usePane()
  const floating = pane.placement === 'floating'
  return (
    <div className="pane-head">
      <Tiling.MoveHandle className="pane-title" aria-label={`${title} 창 이동`}>
        {title}
      </Tiling.MoveHandle>
      <button className="pane-act" onClick={() => (floating ? pane.dock() : pane.float())}>
        {floating ? 'dock' : 'float'}
      </button>
      <button
        className="pane-act"
        onClick={() => pane.split(`${pane.id}.${Math.random().toString(36).slice(2, 5)}`, 'row')}
      >
        split
      </button>
      <button className="pane-act" onClick={pane.hide}>
        hide
      </button>
      <button className="pane-act" onClick={pane.close}>
        close
      </button>
    </div>
  )
}

/** story 공용 Tiling 구성 */
export function TilingDemo({
  layout,
  defaultLayout,
  onLayoutChange,
  floating,
  gap = 6,
}: {
  layout?: TilingLayout
  defaultLayout?: TilingLayout
  onLayoutChange?: (l: TilingLayout) => void
  floating?: FloatingOptions
  gap?: number
}) {
  return (
    <Tiling.Root
      layout={layout}
      defaultLayout={defaultLayout}
      onLayoutChange={onLayoutChange}
      gap={gap}
      floating={floating}
    >
      <Tiling.Panes>
        {({ id }) => (
          <Tiling.Pane className="pane" aria-label={id}>
            <PaneHead title={id} />
            <div className="pane-body">
              <input
                aria-label={`${id} 입력`}
                placeholder="입력 상태는 분할/띄우기 후에도 유지된다"
                style={{ width: '100%' }}
              />
            </div>
            <Tiling.ResizeHandle edge="bottom-right" className="grip" aria-label={`${id} 창 크기`} />
          </Tiling.Pane>
        )}
      </Tiling.Panes>
      <Tiling.Separators>
        {(separator) => <Tiling.Separator separator={separator} className="split-bar" />}
      </Tiling.Separators>
    </Tiling.Root>
  )
}
