import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'desktop-chrome',
      testIgnore: '**/auth.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'mobile-chrome',
      testIgnore: '**/auth.spec.ts',
      use: { ...devices['Pixel 7'], channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' },
    },
    {
      name: 'auth-chrome',
      testMatch: '**/auth.spec.ts',
      use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    env: { VITE_API_BASE_URL: 'http://127.0.0.1:5081/api/v1' },
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 30000,
  },
})
