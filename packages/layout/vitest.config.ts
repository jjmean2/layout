import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        // 순수 모델과 controller. React 없이 Node에서 돈다.
        test: { name: 'unit', include: ['src/**/*.test.ts'], environment: 'node' },
      },
      {
        // part 컴포넌트와 hook. 실제 브라우저에서 렌더한다.
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
