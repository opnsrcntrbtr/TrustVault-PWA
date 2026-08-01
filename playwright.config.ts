import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for TrustVault PWA E2E tests.
 *
 * Runs against the Vite dev server (port 3000) by default.
 * Uses Chromium for CI; macOS ships with WebKit/Gecko for cross-browser.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 'fit',
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: 'http://localhost:3000/TrustVault-PWA',
    actionTimeout: 5_000,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(process.env.CI
      ? [
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
