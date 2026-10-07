// @vitest-environment node
import type { MockInstance } from 'vitest';
import { http, HttpResponse } from 'msw';
import { resetEnvCache } from '@/lib/env';
import * as api from '@/lib/tmdb/api';
import { server } from '../../../tests/msw/server';
import moviePopular from '../../../tests/fixtures/movie-popular.json';
import searchMulti from '../../../tests/fixtures/search-multi.json';
import {
  getTrailer,
  loadMoreDiscover,
  loadMoreList,
  loadMoreSearch,
} from './media';

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

/** Answers every GET to the given path and records the URLs it received. */
function mockTmdb(path: string, body: object | null, status = 200) {
  const calls: URL[] = [];
  server.use(
    http.get(`${BASE}${path}`, ({ request }) => {
      calls.push(new URL(request.url));
      if (status !== 200) return new HttpResponse(null, { status });
      return HttpResponse.json(body);
    })
  );
  return calls;
}

/** Counts every request that reaches TMDB, whatever the path. */
function countAnyRequest() {
  const counter = { count: 0 };
  server.use(
    http.all(`${BASE}/*`, () => {
      counter.count += 1;
      return HttpResponse.json({});
    })
  );
  return counter;
}

const LIST_BASE = {
  mediaType: 'movie',
  list: 'popular',
  locale: 'vi',
} as const;
const SEARCH_BASE = { type: 'multi', q: 'matrix', locale: 'vi' } as const;
const DISCOVER_BASE = { query: '', locale: 'vi' } as const;

describe('loadMoreList', () => {
  it('returns ok with data', async () => {
    const calls = mockTmdb('/movie/popular', moviePopular);

    const result = await loadMoreList(LIST_BASE, 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items.length).toBeGreaterThan(0);
      expect(result.data.items[0].mediaType).toBe('movie');
    }
    expect(calls[0].searchParams.get('page')).toBe('2');
    expect(calls[0].searchParams.get('language')).toBe('vi-VN');
  });

  it.each([1, 501, 2.5, -3, Number.NaN, '2' as unknown as number])(
    'rejects page %s without calling TMDB',
    async (page) => {
      const counter = countAnyRequest();
      expect(await loadMoreList(LIST_BASE, page)).toEqual({
        ok: false,
        error: 'invalid_input',
      });
      expect(counter.count).toBe(0);
    }
  );

  it('rejects a tv list name on movie', async () => {
    const counter = countAnyRequest();
    const result = await loadMoreList(
      { mediaType: 'movie', list: 'on_the_air', locale: 'vi' },
      2
    );
    expect(result).toEqual({ ok: false, error: 'invalid_input' });
    expect(counter.count).toBe(0);
  });

  it('rejects a movie list name on tv', async () => {
    const counter = countAnyRequest();
    const result = await loadMoreList(
      { mediaType: 'tv', list: 'upcoming', locale: 'vi' },
      2
    );
    expect(result).toEqual({ ok: false, error: 'invalid_input' });
    expect(counter.count).toBe(0);
  });

  it.each([
    ['null', null],
    ['a string', 'popular'],
    ['an empty object', {}],
    ['a missing locale', { mediaType: 'movie', list: 'popular' }],
    ['locale fr', { mediaType: 'movie', list: 'popular', locale: 'fr' }],
    [
      'an unknown media type',
      { mediaType: 'person', list: 'popular', locale: 'vi' },
    ],
  ])('rejects %s', async (_label, base) => {
    const counter = countAnyRequest();
    const result = await loadMoreList(base as never, 2);
    expect(result).toEqual({ ok: false, error: 'invalid_input' });
    expect(counter.count).toBe(0);
  });

  it('maps 404 to not_found', async () => {
    mockTmdb('/movie/popular', null, 404);
    expect(await loadMoreList(LIST_BASE, 2)).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('maps 429 twice to rate_limit', async () => {
    const calls = mockTmdb('/movie/popular', null, 429);
    expect(await loadMoreList(LIST_BASE, 2)).toEqual({
      ok: false,
      error: 'rate_limit',
    });
    expect(calls.length).toBe(2);
  });

  it('maps 500 to unknown', async () => {
    mockTmdb('/movie/popular', null, 500);
    expect(await loadMoreList(LIST_BASE, 2)).toEqual({
      ok: false,
      error: 'unknown',
    });
  });

  it('maps a network failure to network', async () => {
    server.use(http.get(`${BASE}/movie/popular`, () => HttpResponse.error()));
    expect(await loadMoreList(LIST_BASE, 2)).toEqual({
      ok: false,
      error: 'network',
    });
  });

  it('maps an unexpected non-TmdbError to unknown and logs it', async () => {
    const boom = new Error('boom');
    vi.spyOn(api, 'getList').mockRejectedValue(boom);

    expect(await loadMoreList(LIST_BASE, 2)).toEqual({
      ok: false,
      error: 'unknown',
    });
    expect(consoleError).toHaveBeenCalledWith('[action]', 'loadMoreList', boom);
  });
});

describe('loadMoreSearch', () => {
  it('returns ok with the trimmed query sent to TMDB', async () => {
    const calls = mockTmdb('/search/multi', searchMulti);

    const result = await loadMoreSearch({ ...SEARCH_BASE, q: '  matrix  ' }, 3);

    expect(result.ok).toBe(true);
    expect(calls[0].searchParams.get('query')).toBe('matrix');
    expect(calls[0].searchParams.get('page')).toBe('3');
  });

  it.each([
    ['empty q', { ...SEARCH_BASE, q: '' }],
    ['whitespace q', { ...SEARCH_BASE, q: '   ' }],
    ['a 101-char q', { ...SEARCH_BASE, q: 'a'.repeat(101) }],
    ['an unknown type', { ...SEARCH_BASE, type: 'collection' }],
    ['locale fr', { ...SEARCH_BASE, locale: 'fr' }],
    ['null', null],
  ])('rejects %s without calling TMDB', async (_label, base) => {
    const counter = countAnyRequest();
    expect(await loadMoreSearch(base as never, 2)).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(counter.count).toBe(0);
  });

  it('accepts a 100-char q', async () => {
    mockTmdb('/search/multi', searchMulti);
    const result = await loadMoreSearch(
      { ...SEARCH_BASE, q: 'a'.repeat(100) },
      2
    );
    expect(result.ok).toBe(true);
  });

  it('rejects an out-of-range page', async () => {
    const counter = countAnyRequest();
    expect(await loadMoreSearch(SEARCH_BASE, 501)).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(counter.count).toBe(0);
  });

  it('maps 404 to not_found', async () => {
    mockTmdb('/search/multi', null, 404);
    expect(await loadMoreSearch(SEARCH_BASE, 2)).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('maps an unexpected non-TmdbError to unknown and logs it', async () => {
    const boom = new Error('boom');
    vi.spyOn(api, 'search').mockRejectedValue(boom);
    expect(await loadMoreSearch(SEARCH_BASE, 2)).toEqual({
      ok: false,
      error: 'unknown',
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[action]',
      'loadMoreSearch',
      boom
    );
  });
});

describe('loadMoreDiscover', () => {
  it('re-parses the serialized query and returns ok', async () => {
    const calls = mockTmdb('/discover/tv', moviePopular);

    const result = await loadMoreDiscover(
      { query: 'type=tv&genres=18,35&sort=vote_average.desc', locale: 'en' },
      2
    );

    expect(result.ok).toBe(true);
    expect(calls[0].searchParams.get('sort_by')).toBe('vote_average.desc');
    expect(calls[0].searchParams.get('page')).toBe('2');
  });

  it('falls back to defaults for a garbage query', async () => {
    const calls = mockTmdb('/discover/movie', moviePopular);

    const result = await loadMoreDiscover(
      { query: 'type=xx&sort=nope&year=abc&genres=;;', locale: 'vi' },
      2
    );

    expect(result.ok).toBe(true);
    expect(calls[0].searchParams.get('sort_by')).toBe('popularity.desc');
  });

  it('accepts an empty query', async () => {
    mockTmdb('/discover/movie', moviePopular);
    const result = await loadMoreDiscover(DISCOVER_BASE, 2);
    expect(result.ok).toBe(true);
  });

  it.each([
    ['a query over 200 chars', { query: 'a'.repeat(201), locale: 'vi' }],
    ['a missing query', { locale: 'vi' }],
    ['a non-string query', { query: 5, locale: 'vi' }],
    ['locale fr', { query: '', locale: 'fr' }],
    ['null', null],
  ])('rejects %s without calling TMDB', async (_label, base) => {
    const counter = countAnyRequest();
    expect(await loadMoreDiscover(base as never, 2)).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(counter.count).toBe(0);
  });

  it('rejects page 1', async () => {
    const counter = countAnyRequest();
    expect(await loadMoreDiscover(DISCOVER_BASE, 1)).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(counter.count).toBe(0);
  });

  it('maps 500 to unknown', async () => {
    mockTmdb('/discover/movie', null, 500);
    expect(await loadMoreDiscover(DISCOVER_BASE, 2)).toEqual({
      ok: false,
      error: 'unknown',
    });
  });

  it('maps an unexpected non-TmdbError to unknown and logs it', async () => {
    const boom = new Error('boom');
    vi.spyOn(api, 'discover').mockRejectedValue(boom);
    expect(await loadMoreDiscover(DISCOVER_BASE, 2)).toEqual({
      ok: false,
      error: 'unknown',
    });
    expect(consoleError).toHaveBeenCalledWith(
      '[action]',
      'loadMoreDiscover',
      boom
    );
  });
});

describe('getTrailer', () => {
  const INPUT = { mediaType: 'movie', id: 550, locale: 'vi' } as const;
  const video = {
    key: 'abc',
    name: 'T',
    site: 'YouTube',
    type: 'Trailer',
    official: true,
  };

  it('returns the first video', async () => {
    mockTmdb('/movie/550/videos', { id: 550, results: [video] });
    expect(await getTrailer(INPUT)).toEqual({
      ok: true,
      data: { key: 'abc', name: 'T', type: 'Trailer', official: true },
    });
  });

  it('returns null data when there are no videos', async () => {
    mockTmdb('/movie/550/videos', { id: 550, results: [] });
    expect(await getTrailer(INPUT)).toEqual({ ok: true, data: null });
  });

  it.each([
    ['id -1', { ...INPUT, id: -1 }],
    ['id 0', { ...INPUT, id: 0 }],
    ['id 1.5', { ...INPUT, id: 1.5 }],
    ['an unsafe id', { ...INPUT, id: Number.MAX_SAFE_INTEGER + 1 }],
    ['a string id', { ...INPUT, id: '550' }],
    ['locale fr', { ...INPUT, locale: 'fr' }],
    ['an unknown media type', { ...INPUT, mediaType: 'person' }],
    ['null', null],
    ['a string', 'movie'],
    ['a missing id', { mediaType: 'movie', locale: 'vi' }],
  ])('rejects %s without calling TMDB', async (_label, input) => {
    const counter = countAnyRequest();
    expect(await getTrailer(input as never)).toEqual({
      ok: false,
      error: 'invalid_input',
    });
    expect(counter.count).toBe(0);
  });

  it('maps 404 to not_found', async () => {
    mockTmdb('/movie/550/videos', null, 404);
    expect(await getTrailer(INPUT)).toEqual({ ok: false, error: 'not_found' });
  });

  it('maps an unexpected non-TmdbError to unknown and logs it', async () => {
    const boom = new Error('boom');
    vi.spyOn(api, 'getVideos').mockRejectedValue(boom);
    expect(await getTrailer(INPUT)).toEqual({ ok: false, error: 'unknown' });
    expect(consoleError).toHaveBeenCalledWith('[action]', 'getTrailer', boom);
  });
});
