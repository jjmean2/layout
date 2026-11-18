import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3200', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
  webServer: { command: 'next start -p 3200', url: 'http://localhost:3200', reuseExistingServer: !process.env.CI },
})
