import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // optimizer-workflow.spec.ts waits up to 90s for a worker optimization to land.
  // Playwright's 30s default killed those tests before their own waits could resolve.
  timeout: 120_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
