import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { assertBuildEnv, shouldAssertBuildEnv } from './build-env';

describe('assertBuildEnv', () => {
  it('passes with a token and no SITE_URL (defaults to localhost)', () => {
    expect(() => assertBuildEnv({ TMDB_READ_TOKEN: 'abc' })).not.toThrow();
  });

  it('passes with a token and an absolute https SITE_URL', () => {
    expect(() =>
      assertBuildEnv({
        TMDB_READ_TOKEN: 'abc',
        NEXT_PUBLIC_SITE_URL: 'https://moose.example',
      })
    ).not.toThrow();
  });

  it.each([undefined, ''])(
    'fails with a message naming TMDB_READ_TOKEN when it is %j',
    (token) => {
      expect(() => assertBuildEnv({ TMDB_READ_TOKEN: token })).toThrow(
        /TMDB_READ_TOKEN is required/
      );
    }
  );

  it('fails when NEXT_PUBLIC_SITE_URL has no http(s) scheme', () => {
    expect(() =>
      assertBuildEnv({
        TMDB_READ_TOKEN: 'abc',
        NEXT_PUBLIC_SITE_URL: 'moose.example',
      })
    ).toThrow(/NEXT_PUBLIC_SITE_URL must be an absolute http\(s\) URL/);
  });

  it('reports every problem at once and says the build was stopped', () => {
    let message = '';
    try {
      assertBuildEnv({ NEXT_PUBLIC_SITE_URL: 'localhost:3000' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/production build/i);
    expect(message).toMatch(/TMDB_READ_TOKEN/);
    expect(message).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });

  it('never echoes the token value', () => {
    expect(() =>
      assertBuildEnv({
        TMDB_READ_TOKEN: 'secret-token-value',
        NEXT_PUBLIC_SITE_URL: 'bad',
      })
    ).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining('secret-token-value'),
      })
    );
  });

  it('requires NEXT_PUBLIC_SITE_URL on a Vercel production build', () => {
    expect(() =>
      assertBuildEnv({ TMDB_READ_TOKEN: 'abc', VERCEL_ENV: 'production' })
    ).toThrow(/NEXT_PUBLIC_SITE_URL is required for production/);
  });

  it('accepts a Vercel production build with a site URL', () => {
    expect(() =>
      assertBuildEnv({
        TMDB_READ_TOKEN: 'abc',
        VERCEL_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://moose.example',
      })
    ).not.toThrow();
  });

  it('keeps the localhost default on Vercel preview builds', () => {
    expect(() =>
      assertBuildEnv({ TMDB_READ_TOKEN: 'abc', VERCEL_ENV: 'preview' })
    ).not.toThrow();
  });

  it('lists the Vercel rule together with the other problems', () => {
    expect(() => assertBuildEnv({ VERCEL_ENV: 'production' })).toThrow(
      /TMDB_READ_TOKEN[\s\S]*NEXT_PUBLIC_SITE_URL is required for production/
    );
  });
});

describe('shouldAssertBuildEnv', () => {
  const node = ['/usr/bin/node', '/app/node_modules/next/dist/bin/next'];

  it.each([
    [['build']],
    [['build', '--turbopack']],
    [['--no-lint', 'build']],
    [['build', 'some-dir']],
  ])('is true for `next build` (args %j)', (args) => {
    expect(
      shouldAssertBuildEnv(PHASE_PRODUCTION_BUILD, [...node, ...args])
    ).toBe(true);
  });

  it('is false for `next typegen`, which also loads the build phase', () => {
    expect(
      shouldAssertBuildEnv(PHASE_PRODUCTION_BUILD, [...node, 'typegen'])
    ).toBe(false);
  });

  it('is false for build-phase loads outside the CLI (e.g. build workers)', () => {
    expect(
      shouldAssertBuildEnv(PHASE_PRODUCTION_BUILD, [
        '/usr/bin/node',
        '/app/worker.js',
      ])
    ).toBe(false);
  });

  it.each(['phase-development-server', 'phase-production-server'])(
    'is false for %s even with a build argument',
    (phase) => {
      expect(shouldAssertBuildEnv(phase, [...node, 'build'])).toBe(false);
    }
  );
});
