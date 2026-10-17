// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { NextRequest } from 'next/server';
import { resetEnvCache } from '@/lib/env';
import { MAX_QUERY_LENGTH } from '@/lib/search-query';
import { server } from '../../../../../tests/msw/server';
import searchMulti from '../../../../../tests/fixtures/search-multi.json';
import { GET } from './route';

const TMDB = 'https://api.themoviedb.org/3/search/multi';

function get(params: Record<string, string>) {
  const url = new URL('http://localhost/api/search/suggest');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return GET(new NextRequest(url));
}

function mockSearch(body: object | null, status = 200) {
  const calls: URL[] = [];
  server.use(
    http.get(TMDB, ({ request }) => {
      calls.push(new URL(request.url));
      return status === 200
        ? HttpResponse.json(body)
        : new HttpResponse(null, { status });
    })
  );
  return calls;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('TMDB_READ_TOKEN', 'test-token');
  resetEnvCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetEnvCache();
});

describe('GET /api/search/suggest', () => {
  it('returns slim suggestions for movies, TV and people, cacheable by the CDN', async () => {
    const calls = mockSearch(searchMulti);

    const response = await get({ q: ' batman ', locale: 'vi' });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, s-maxage=300, stale-while-revalidate=3600'
    );
    expect(await response.json()).toEqual({
      items: [
        {
          id: expect.any(Number),
          mediaType: 'tv',
          title: 'Batman',
          year: 1966,
          imagePath: '/1ZEJuuDh0Zpi5ELM3Zev0GBhQ3R.jpg',
        },
        expect.objectContaining({
          mediaType: 'movie',
          title: 'The Batman',
          year: 2022,
        }),
        expect.objectContaining({
          mediaType: 'person',
          title: 'Christian Bale',
          year: null,
          imagePath: '/7Pxez9J8fuPd2Mn9kex13YALrCQ.jpg',
        }),
      ],
    });
    expect(calls[0].searchParams.get('query')).toBe('batman');
    expect(calls[0].searchParams.get('language')).toBe('vi-VN');
  });

  it('returns at most 8 suggestions', async () => {
    const [movie] = searchMulti.results.filter((r) => r.media_type === 'movie');
    mockSearch({
      ...searchMulti,
      results: Array.from({ length: 12 }, (_, i) => ({ ...movie, id: i + 1 })),
    });

    const { items } = await (await get({ q: 'batman', locale: 'en' })).json();

    expect(items).toHaveLength(8);
  });

  it.each([
    ['a missing query', { locale: 'vi' }],
    ['a one-letter query', { q: 'b', locale: 'vi' }],
    ['a blank query', { q: '   ', locale: 'vi' }],
    [
      'an over-long query',
      { q: 'a'.repeat(MAX_QUERY_LENGTH + 1), locale: 'vi' },
    ],
    ['an unknown locale', { q: 'batman', locale: 'fr' }],
  ])('rejects %s with 400 without calling TMDB', async (_label, params) => {
    const calls = mockSearch(searchMulti);

    const response = await get(params as Record<string, string>);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_input' });
    expect(calls).toHaveLength(0);
  });

  it.each([
    [429, 429, 'rate_limit'],
    [500, 502, 'upstream'],
  ])(
    'maps a TMDB %i to %i, never cached',
    async (tmdbStatus, status, error) => {
      mockSearch(null, tmdbStatus);

      const response = await get({ q: 'batman', locale: 'vi' });

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  );
});
