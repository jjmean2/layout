import { defineConfig, devices } from '@playwright/test'

// E2E_MODE=dev 이면 next dev(StrictMode, 개발 모드 접근성 이름 검사 포함), 아니면 next start로 실행한다.
const dev = process.env.E2E_MODE === 'dev'
const port = dev ? 3201 : 3200

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: `http://localhost:${port}`, ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  webServer: {
    command: dev ? `next dev -p ${port}` : `next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
