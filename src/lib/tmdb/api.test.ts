// @vitest-environment node
import type { MockInstance } from 'vitest';
import { http, HttpResponse } from 'msw';
import { resetEnvCache } from '@/lib/env';
import type { DiscoverParams } from '@/features/discover/params';
import { server } from '../../../tests/msw/server';
import trendingFixture from '../../../tests/fixtures/trending-all-week.json';
import moviePopular from '../../../tests/fixtures/movie-popular.json';
import movieDetail from '../../../tests/fixtures/movie-detail.json';
import tvDetail from '../../../tests/fixtures/tv-detail.json';
import personDetail from '../../../tests/fixtures/person-detail.json';
import searchMulti from '../../../tests/fixtures/search-multi.json';
import genresMovie from '../../../tests/fixtures/genres-movie.json';
import {
  discover,
  getDetail,
  getGenres,
  getList,
  getPerson,
  getPopularIds,
  getTrending,
  getVideos,
  search,
} from './api';
import { TmdbError } from './errors';
import { REVALIDATE } from './constants';

const BASE = 'https://api.themoviedb.org/3';

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('TMDB_READ_TOKEN', 'test-token');
  resetEnvCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetEnvCache();
});

/** Registers a GET handler and returns the URLs it received, in order. */
function mockGet(
  path: string,
  body: object | null | ((url: URL) => object),
  status = 200
): URL[] {
  const calls: URL[] = [];
  server.use(
    http.get(`${BASE}${path}`, ({ request }) => {
      const url = new URL(request.url);
      calls.push(url);
      if (status !== 200) return new HttpResponse(null, { status });
      return HttpResponse.json(typeof body === 'function' ? body(url) : body);
    })
  );
  return calls;
}

/** Returns a getter for the `next.revalidate` value tmdbFetch passed to fetch on its first call. */
function spyRevalidate(): () => number | false | undefined {
  const spy = vi.spyOn(globalThis, 'fetch');
  return () => {
    const init = spy.mock.calls[0]?.[1] as {
      next?: { revalidate?: number | false };
    };
    return init?.next?.revalidate;
  };
}

async function catchError(promise: Promise<unknown>): Promise<TmdbError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(TmdbError);
    return error as TmdbError;
  }
  throw new Error('Expected promise to reject');
}

describe('getTrending', () => {
  it('filters people and returns 5 media items', async () => {
    mockGet('/trending/all/week', trendingFixture);
    const revalidate = spyRevalidate();

    const items = await getTrending('en');

    expect(items).toHaveLength(5);
    expect(items.map((i) => i.mediaType)).toEqual([
      'movie',
      'movie',
      'movie',
      'movie',
      'tv',
    ]);
    expect(revalidate()).toBe(REVALIDATE.list);
  });
});

describe('getList', () => {
  it('requests /{mediaType}/{list} with page and locale', async () => {
    const calls = mockGet('/tv/on_the_air', moviePopular);
    const revalidate = spyRevalidate();

    const result = await getList('tv', 'on_the_air', 3, 'vi');

    expect(calls[0].searchParams.get('page')).toBe('3');
    expect(calls[0].searchParams.get('language')).toBe('vi-VN');
    expect(result.items.length).toBeGreaterThan(0);
    expect(revalidate()).toBe(REVALIDATE.list);
  });
});

describe('getDetail', () => {
  const emptyOverview = { ...movieDetail, overview: '' };

  it('requests appended resources', async () => {
    const calls = mockGet('/movie/550', movieDetail);
    const revalidate = spyRevalidate();

    const detail = await getDetail('movie', 550, 'en');

    expect(calls[0].searchParams.get('append_to_response')).toBe(
      'credits,videos,recommendations,similar'
    );
    expect(detail.overviewIsFallback).toBe(false);
    expect(revalidate()).toBe(REVALIDATE.detail);
  });

  it('works for tv', async () => {
    mockGet('/tv/1399', tvDetail);
    const detail = await getDetail('tv', 1399, 'en');
    expect(detail.mediaType).toBe('tv');
  });

  it('fetches en overview when vi overview is empty', async () => {
    const calls: URL[] = [];
    server.use(
      http.get(`${BASE}/movie/550`, ({ request }) => {
        const url = new URL(request.url);
        calls.push(url);
        return HttpResponse.json(
          url.searchParams.get('language') === 'vi-VN'
            ? emptyOverview
            : { ...movieDetail, overview: 'English overview' }
        );
      })
    );

    const detail = await getDetail('movie', 550, 'vi');

    expect(calls).toHaveLength(2);
    expect(calls[1].searchParams.get('language')).toBe('en-US');
    expect(calls[1].searchParams.has('append_to_response')).toBe(false);
    expect(detail.overview).toBe('English overview');
    expect(detail.overviewIsFallback).toBe(true);
  });

  it('does not refetch when overview is present', async () => {
    const calls = mockGet('/movie/550', movieDetail);
    await getDetail('movie', 550, 'vi');
    expect(calls).toHaveLength(1);
  });

  it('returns vi data without fallback when the en request fails', async () => {
    server.use(
      http.get(`${BASE}/movie/550`, ({ request }) =>
        new URL(request.url).searchParams.get('language') === 'vi-VN'
          ? HttpResponse.json(emptyOverview)
          : new HttpResponse(null, { status: 500 })
      )
    );

    const detail = await getDetail('movie', 550, 'vi');

    expect(detail.overview).toBe('');
    expect(detail.overviewIsFallback).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      '[tmdb]',
      '/movie/550',
      'server',
      500
    );
  });

  it('propagates not_found', async () => {
    mockGet('/movie/999', null, 404);
    const error = await catchError(getDetail('movie', 999, 'en'));
    expect(error.kind).toBe('not_found');
  });
});

describe('getVideos', () => {
  const videos = {
    id: 1,
    results: [
      {
        key: 'abc',
        name: 'T',
        site: 'YouTube',
        type: 'Trailer',
        official: true,
      },
    ],
  };

  it('includes vi, en and null video languages for vi', async () => {
    const calls = mockGet('/movie/550/videos', videos);
    const revalidate = spyRevalidate();

    const result = await getVideos('movie', 550, 'vi');

    expect(calls[0].searchParams.get('include_video_language')).toBe(
      'vi,en,null'
    );
    expect(result).toEqual([
      { key: 'abc', name: 'T', type: 'Trailer', official: true },
    ]);
    expect(revalidate()).toBe(REVALIDATE.detail);
  });

  it('dedupes the language list for en', async () => {
    const calls = mockGet('/tv/1/videos', videos);
    await getVideos('tv', 1, 'en');
    expect(calls[0].searchParams.get('include_video_language')).toBe('en,null');
  });
});

describe('search', () => {
  it('encodes Vietnamese query', async () => {
    const calls = mockGet('/search/multi', searchMulti);
    const revalidate = spyRevalidate();

    const result = await search('multi', 'người nhện', 2, 'vi');

    expect(calls[0].searchParams.get('query')).toBe('người nhện');
    expect(calls[0].searchParams.get('page')).toBe('2');
    expect(result.items.some((i) => i.mediaType === 'person')).toBe(true);
    expect(revalidate()).toBe(REVALIDATE.search);
  });

  it('stamps person results returned without media_type', async () => {
    const person = searchMulti.results.find((r) => r.media_type === 'person')!;
    const untyped: Record<string, unknown> = { ...person };
    delete untyped.media_type;
    mockGet('/search/person', { ...searchMulti, results: [untyped] });

    const result = await search('person', 'brad', 1, 'en');

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: person.id,
      mediaType: 'person',
    });
  });

  it('maps movie searches to media items', async () => {
    mockGet('/search/movie', moviePopular);
    const result = await search('movie', 'x', 1, 'en');
    expect(result.items.every((i) => i.mediaType === 'movie')).toBe(true);
  });
});

describe('discover', () => {
  const params: DiscoverParams = {
    type: 'movie',
    genres: [28, 12],
    year: 2020,
    sort: 'vote_average.desc',
  };

  it('sends mapped query', async () => {
    const calls = mockGet('/discover/movie', moviePopular);
    const revalidate = spyRevalidate();

    await discover(params, 4, 'en');

    const q = calls[0].searchParams;
    expect(q.get('sort_by')).toBe('vote_average.desc');
    expect(q.get('with_genres')).toBe('28,12');
    expect(q.get('vote_count.gte')).toBe('200');
    expect(q.get('primary_release_year')).toBe('2020');
    expect(q.get('page')).toBe('4');
    expect(revalidate()).toBe(REVALIDATE.list);
  });
});

describe('getGenres', () => {
  it('returns genres with the genres revalidate window', async () => {
    mockGet('/genre/movie/list', genresMovie);
    const revalidate = spyRevalidate();

    const genres = await getGenres('movie', 'vi');

    expect(genres).toEqual(genresMovie.genres);
    expect(revalidate()).toBe(REVALIDATE.genres);
  });
});

describe('getPerson', () => {
  const emptyBio = { ...personDetail, biography: '' };

  it('requests combined_credits', async () => {
    const calls = mockGet('/person/287', personDetail);
    const revalidate = spyRevalidate();

    const person = await getPerson(287, 'vi');

    expect(calls[0].searchParams.get('append_to_response')).toBe(
      'combined_credits'
    );
    expect(person.biographyIsFallback).toBe(false);
    expect(revalidate()).toBe(REVALIDATE.detail);
  });

  it('fetches en biography when vi biography is empty', async () => {
    const calls: URL[] = [];
    server.use(
      http.get(`${BASE}/person/287`, ({ request }) => {
        const url = new URL(request.url);
        calls.push(url);
        return HttpResponse.json(
          url.searchParams.get('language') === 'vi-VN'
            ? emptyBio
            : { ...personDetail, biography: 'English biography' }
        );
      })
    );

    const person = await getPerson(287, 'vi');

    expect(calls).toHaveLength(2);
    expect(person.biography).toBe('English biography');
    expect(person.biographyIsFallback).toBe(true);
  });

  it('returns vi data without fallback when the en request fails', async () => {
    server.use(
      http.get(`${BASE}/person/287`, ({ request }) =>
        new URL(request.url).searchParams.get('language') === 'vi-VN'
          ? HttpResponse.json(emptyBio)
          : new HttpResponse(null, { status: 500 })
      )
    );

    const person = await getPerson(287, 'vi');

    expect(person.biography).toBe('');
    expect(person.biographyIsFallback).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      '[tmdb]',
      '/person/287',
      'server',
      500
    );
  });
});

describe('getPopularIds', () => {
  it('dedupes ids repeated across pages', async () => {
    mockGet('/tv/popular', (url) => {
      const page = Number(url.searchParams.get('page'));
      // Page 2 repeats the last id of page 1 (TMDB popularity shifts between requests).
      return {
        page,
        total_pages: 500,
        total_results: 10000,
        results: [{ id: page === 2 ? 11 : page * 10 }, { id: page * 10 + 1 }],
      };
    });

    const ids = await getPopularIds('tv');

    expect(ids).toEqual([10, 11, 21, 30, 31, 40, 41, 50, 51]);
  });

  it('returns 100 ids from pages 1-5 using locale en', async () => {
    const calls = mockGet('/movie/popular', (url) => {
      const page = Number(url.searchParams.get('page'));
      return {
        page,
        total_pages: 500,
        total_results: 10000,
        results: Array.from({ length: 20 }, (_, i) => ({
          id: page * 1000 + i,
        })),
      };
    });
    const revalidate = spyRevalidate();

    const ids = await getPopularIds('movie');

    expect(ids).toHaveLength(100);
    expect(ids[0]).toBe(1000);
    expect(ids[99]).toBe(5019);
    expect(calls.map((u) => u.searchParams.get('page')).sort()).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
    expect(calls.every((u) => u.searchParams.get('language') === 'en-US')).toBe(
      true
    );
    expect(revalidate()).toBe(REVALIDATE.list);
  });
});
