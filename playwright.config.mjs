import { defineConfig, devices } from '@playwright/test';

if (process.env.LOCAL_REVIEW_ONLY !== '1' || process.env.E2E_BASE_URL !== 'http://localhost:8088') {
  throw new Error('E2E refuses non-review origins');
}
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 60000,
  expect: { timeout: 12000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: process.env.E2E_BASE_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: 'node scripts/review-browser-proxy.mjs', url: 'http://localhost:8088/hr/login', reuseExistingServer: false, timeout: 30000 },
});
