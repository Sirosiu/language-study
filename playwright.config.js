import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.js', fullyParallel: true, workers: 2,
  timeout: 90000, expect: { timeout: 12000 }, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4187/language-study/', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ],
  webServer: { command:'node scripts/serve.mjs',env:{PORT:'4187',BASE_PATH:'language-study'},url:'http://127.0.0.1:4187/language-study/',reuseExistingServer:!process.env.CI }
});
