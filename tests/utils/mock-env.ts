// Fixed env for page tests, so metadata URLs are predictable without a token.
// Usage: vi.mock('@/lib/env', () => import('../../../tests/utils/mock-env'));
export const TEST_SITE_URL = 'https://moose.test';

export function getEnv() {
  return { TMDB_READ_TOKEN: 'test-token', SITE_URL: TEST_SITE_URL };
}

export function resetEnvCache() {}
