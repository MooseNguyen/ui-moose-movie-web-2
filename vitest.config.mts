import path from 'node:path';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      'server-only': path.resolve(import.meta.dirname, 'tests/stubs/empty.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    // `.claude/**` holds Claude Code git worktrees: full repo copies whose
    // tests (including Playwright specs) must not run with this suite.
    exclude: [...configDefaults.exclude, 'tests/e2e/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/features/**'],
      thresholds: { lines: 80 },
    },
  },
});
