import { getEnv, resetEnvCache } from './env';

describe('getEnv', () => {
  beforeEach(() => resetEnvCache());
  afterEach(() => vi.unstubAllEnvs());

  it('throws a message naming TMDB_READ_TOKEN when missing', () => {
    vi.stubEnv('TMDB_READ_TOKEN', '');
    expect(() => getEnv()).toThrow(/TMDB_READ_TOKEN/);
  });

  it('returns token and default SITE_URL', () => {
    vi.stubEnv('TMDB_READ_TOKEN', 'abc');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(getEnv()).toEqual({
      TMDB_READ_TOKEN: 'abc',
      SITE_URL: 'http://localhost:3000',
    });
  });

  it('returns the configured SITE_URL when set', () => {
    vi.stubEnv('TMDB_READ_TOKEN', 'abc');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://moose.example');
    expect(getEnv().SITE_URL).toBe('https://moose.example');
  });

  it('caches the parsed env until resetEnvCache is called', () => {
    vi.stubEnv('TMDB_READ_TOKEN', 'abc');
    const first = getEnv();
    expect(getEnv()).toBe(first);
    resetEnvCache();
    expect(getEnv()).not.toBe(first);
    expect(getEnv()).toEqual(first);
  });
});
