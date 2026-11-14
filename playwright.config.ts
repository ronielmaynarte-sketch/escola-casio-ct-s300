import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4173/', trace: 'off' },
  webServer: {
    command: 'node tests/e2e/servidor.mjs',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    { name: 'retrato-375x667', use: { viewport: { width: 375, height: 667 }, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'paisagem-812x375', use: { viewport: { width: 812, height: 375 }, hasTouch: true, deviceScaleFactor: 2 } },
  ],
})
