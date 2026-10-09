import { resetEnvCache } from '@/lib/env';
import robots from './robots';

beforeEach(() => {
  resetEnvCache();
  vi.stubEnv('TMDB_READ_TOKEN', 'test-token');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://moose.example');
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe('robots', () => {
  it('allows everything except the localized search pages', () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: '*',
        allow: '/',
        disallow: ['/vi/search', '/en/search'],
      },
      sitemap: 'https://moose.example/sitemap.xml',
    });
  });

  it('does not block favorites: it relies on its noindex meta', () => {
    const { rules } = robots();
    expect(JSON.stringify(rules)).not.toContain('favorites');
  });
});
