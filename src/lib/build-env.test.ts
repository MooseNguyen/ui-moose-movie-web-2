import { assertBuildEnv } from './build-env';

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
});
