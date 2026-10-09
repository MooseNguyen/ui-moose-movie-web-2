import { resetEnvCache } from '@/lib/env';
import { getPopularIds } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
import sitemap, { revalidate } from './sitemap';

vi.mock('@/lib/tmdb/api', () => ({ getPopularIds: vi.fn() }));

const SITE = 'https://moose.example';
const mockedGetPopularIds = vi.mocked(getPopularIds);

const ids = (start: number) => Array.from({ length: 100 }, (_, i) => start + i);

beforeEach(() => {
  resetEnvCache();
  vi.stubEnv('TMDB_READ_TOKEN', 'test-token');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
  mockedGetPopularIds.mockReset();
  mockedGetPopularIds.mockImplementation(async (mediaType) =>
    mediaType === 'movie' ? ids(1) : ids(1001)
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetEnvCache();
});

describe('sitemap', () => {
  it('is regenerated daily', () => {
    expect(revalidate).toBe(86400);
  });

  it('lists the static pages and 100 popular titles per type in both locales', async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(entries).toHaveLength((4 + 100 + 100) * 2);
    for (const locale of ['vi', 'en']) {
      expect(urls).toEqual(
        expect.arrayContaining([
          `${SITE}/${locale}`,
          `${SITE}/${locale}/movie`,
          `${SITE}/${locale}/tv`,
          `${SITE}/${locale}/discover`,
          `${SITE}/${locale}/movie/1`,
          `${SITE}/${locale}/movie/100`,
          `${SITE}/${locale}/tv/1001`,
          `${SITE}/${locale}/tv/1100`,
        ])
      );
    }
    expect(new Set(urls).size).toBe(urls.length);
    expect(mockedGetPopularIds).toHaveBeenCalledWith('movie');
    expect(mockedGetPopularIds).toHaveBeenCalledWith('tv');
    // Once per type, shared by both locales.
    expect(mockedGetPopularIds).toHaveBeenCalledTimes(2);
  });

  it('never lists search, favorites, people or filtered discover URLs', async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.filter((u) => /search|favorites|person|\?/.test(u))).toEqual(
      []
    );
  });

  it('links every entry to its vi and en versions', async () => {
    const entries = await sitemap();
    const detail = entries.find((e) => e.url === `${SITE}/en/movie/1`);

    expect(detail?.alternates?.languages).toEqual({
      vi: `${SITE}/vi/movie/1`,
      en: `${SITE}/en/movie/1`,
    });
    expect(
      entries.find((e) => e.url === `${SITE}/vi`)?.alternates?.languages
    ).toEqual({ vi: `${SITE}/vi`, en: `${SITE}/en` });
  });

  it('keeps the static pages and the other type when TMDB fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockedGetPopularIds.mockImplementation(async (mediaType) => {
      if (mediaType === 'movie') {
        throw new TmdbError('network', '/movie/popular');
      }
      return ids(1001);
    });

    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toHaveLength((4 + 100) * 2);
    expect(urls).toContain(`${SITE}/vi/movie`);
    expect(urls).toContain(`${SITE}/vi/tv/1001`);
    expect(urls.some((u) => /\/movie\/\d/.test(u))).toBe(false);
    // tmdbFetch already logged the TmdbError.
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('logs unexpected failures and still returns the static pages', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const boom = new Error('boom');
    mockedGetPopularIds.mockRejectedValue(boom);

    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toHaveLength(4 * 2);
    expect(consoleError).toHaveBeenCalledWith('[sitemap]', 'movie', boom);
    expect(consoleError).toHaveBeenCalledWith('[sitemap]', 'tv', boom);
  });
});
