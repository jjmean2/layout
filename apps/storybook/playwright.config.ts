import { defineConfig, devices } from '@playwright/test'

// storybook build 결과를 띄워 모든 story를 연다.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:6106', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'node e2e/serve.mjs storybook-static 6106',
    url: 'http://localhost:6106/index.json',
    reuseExistingServer: !process.env.CI,
  },
})
