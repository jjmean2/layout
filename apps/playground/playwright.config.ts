import { defineConfig, devices } from '@playwright/test'

// E2E_MODE=dev 이면 next dev(StrictMode 이중 실행 포함), 아니면 next build 산출물(next start)로 실행한다.
const dev = process.env.E2E_MODE === 'dev'
const port = dev ? 3101 : 3100

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: dev ? `next dev -p ${port}` : `next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
