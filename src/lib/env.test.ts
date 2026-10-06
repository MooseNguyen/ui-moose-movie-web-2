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
});
