import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { config } from './proxy';

// next-intl's middleware cannot be resolved by Vitest's ESM loader and is not
// under test here; only the exported matcher config is.
vi.mock('next-intl/middleware', () => ({ default: () => () => {} }));

const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

describe('proxy matcher', () => {
  it.each(['/', '/vi', '/en/movie/123', '/movie'])('runs for %s', (url) => {
    expect(matches(url)).toBe(true);
  });

  it.each(['/logo.png', '/_next/static/x.js', '/api/x'])('skips %s', (url) => {
    expect(matches(url)).toBe(false);
  });
});
