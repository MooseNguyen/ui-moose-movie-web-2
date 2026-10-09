import { defineConfig } from '@playwright/test';

// Captures the README screenshots against a production build:
// `pnpm screenshots`. Kept out of the E2E suite (tests/e2e) on purpose:
// it asserts nothing and rewrites files in docs/screenshots/.
const PORT = 3100;

export default defineConfig({
  testDir: '.',
  testMatch: 'screenshots.ts',
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Stops the hero autoplay so every capture shows the first slide.
    reducedMotion: 'reduce',
    colorScheme: 'dark',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
