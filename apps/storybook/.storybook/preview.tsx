import type { Preview } from '@storybook/react-vite'
import { StrictMode } from 'react'
import '../stories/stories.css'

const preview: Preview = {
  parameters: {
    // 모든 Root는 부모를 100% 채우므로 캔버스 전체를 쓴다.
    layout: 'fullscreen',
    controls: { expanded: true },
    docs: {
      // floating 창과 hover overlay가 문서 페이지 전체를 덮지 않도록 각 story를 iframe에 고정 높이로 렌더한다.
      story: { inline: false, iframeHeight: '460px' },
    },
    a11y: { test: 'todo' },
  },
  decorators: [
    (Story) => (
      // pane host는 StrictMode의 effect 재실행을 견뎌야 하므로 항상 켠다.
      <StrictMode>
        <div style={{ height: '100vh' }}>
          <Story />
        </div>
      </StrictMode>
    ),
  ],
}

export default preview
