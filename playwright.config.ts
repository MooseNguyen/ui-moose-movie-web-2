import { defineConfig, devices } from '@playwright/test';

// Port 3100, not 3000: a `next dev` server on 3000 must never be reused as
// the system under test. The suite always runs against a production build.
const PORT = 3100;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !isCI,
    // The build prerenders Home against TMDB.
    timeout: 180_000,
  },
});
