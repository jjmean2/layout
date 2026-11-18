'use client'

import { Tiling, usePane, type FloatingOptions, type TilingLayout } from '@justwonder/layout/tiling'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { RenderCounter } from './render-counter'

function PaneHeader({ title }: { title: string }) {
  const pane = usePane()
  const floating = pane.placement === 'floating'
  return (
    <div className="pane-header">
      <Tiling.MoveHandle className="title" data-testid={`move-${pane.id}`}>
        {title}
      </Tiling.MoveHandle>
      {floating ? (
        <button data-testid={`dock-${pane.id}`} onClick={() => pane.dock()}>
          dock
        </button>
      ) : (
        <button data-testid={`float-${pane.id}`} onClick={() => pane.float()}>
          float
        </button>
      )}
      <button data-testid={`hide-${pane.id}`} onClick={() => pane.hide()}>
        hide
      </button>
      <button data-testid={`split-${pane.id}`} onClick={() => pane.split(`${pane.id}-${Date.now() % 10000}`, 'row')}>
        split
      </button>
      <button data-testid={`close-${pane.id}`} onClick={() => pane.close()}>
        ×
      </button>
    </div>
  )
}

function Popup({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button data-testid={`popup-open-${id}`} onClick={() => setOpen((v) => !v)}>
        메뉴 열기
      </button>
      {open
        ? createPortal(
            <div
              data-testid={`popup-${id}`}
              style={{
                position: 'fixed',
                left: 0,
                top: 0,
                zIndex: 50,
                width: 160,
                padding: 8,
                background: '#fff',
                border: '1px solid #ccc',
                boxShadow: '0 4px 12px #0003',
              }}
            >
              body portal 메뉴 (z-index 50)
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export function PaneBody({ id }: { id: string }) {
  if (id.startsWith('frame')) {
    return (
      <iframe
        data-testid={`iframe-${id}`}
        title={id}
        style={{ border: 0, width: '100%', height: '100%' }}
        srcDoc="<body style='font:13px system-ui;margin:8px'>iframe 내용</body>"
      />
    )
  }
  if (id.startsWith('list')) {
    return (
      <ul data-testid={`scroll-${id}`} style={{ margin: 0, height: '100%', overflow: 'auto' }}>
        {Array.from({ length: 200 }, (_, i) => (
          <li key={i}>항목 {i}</li>
        ))}
      </ul>
    )
  }
  return (
    <div>
      <input data-testid={`input-${id}`} aria-label={`${id} input`} placeholder="입력 상태 확인용" />
      <Popup id={id} />
    </div>
  )
}

export function Workspace({
  layout,
  onLayoutChange,
  floating,
  renderBody = (id) => <PaneBody id={id} />,
}: {
  layout: TilingLayout
  onLayoutChange: (l: TilingLayout) => void
  floating: FloatingOptions
  renderBody?: (id: string) => ReactNode
}) {
  return (
    <Tiling.Root layout={layout} onLayoutChange={onLayoutChange} gap={6} floating={floating} data-testid="tiling">
      <Tiling.Panes>
        {(pane) => (
          <Tiling.Pane className="pane" data-testid={`pane-${pane.id}`} aria-label={pane.id}>
            <RenderCounter id={`pane-${pane.id}`} />
            <PaneHeader title={pane.id} />
            <div className="pane-body">{renderBody(pane.id)}</div>
            <Tiling.ResizeHandle
              edge="bottom-right"
              className="grip"
              data-testid={`resize-${pane.id}`}
              aria-label={`${pane.id} 크기`}
            />
          </Tiling.Pane>
        )}
      </Tiling.Panes>
      <Tiling.Separators>
        {(separator) => (
          <Tiling.Separator separator={separator} className="split-bar" data-testid={`sep-${separator.key}`} />
        )}
      </Tiling.Separators>
    </Tiling.Root>
  )
}
