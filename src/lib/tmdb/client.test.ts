// @vitest-environment node
import { http, HttpResponse, delay } from 'msw';
import { z } from 'zod';
import type { MockInstance } from 'vitest';
import { resetEnvCache } from '@/lib/env';
import { server } from '../../../tests/msw/server';
import { TmdbError } from './errors';
import { retryDelayMs, tmdbFetch } from './client';

const BASE = 'https://api.themoviedb.org/3';
const schema = z.object({ page: z.number() });

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.stubEnv('TMDB_READ_TOKEN', 'test-token');
  resetEnvCache();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  vi.unstubAllEnvs();
  resetEnvCache();
});

async function catchError(promise: Promise<unknown>): Promise<TmdbError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(TmdbError);
    return error as TmdbError;
  }
  throw new Error('Expected promise to reject');
}

describe('tmdbFetch', () => {
  it('sends bearer token and language, drops undefined params', async () => {
    let captured: Request | undefined;
    server.use(
      http.get(`${BASE}/movie/popular`, ({ request }) => {
        captured = request;
        return HttpResponse.json({ page: 2 });
      })
    );

    const result = await tmdbFetch('/movie/popular', {
      schema,
      locale: 'vi',
      params: { page: 2, region: undefined },
      revalidate: 60,
    });

    expect(result).toEqual({ page: 2 });
    const url = new URL(captured!.url);
    expect(captured!.headers.get('authorization')).toBe('Bearer test-token');
    expect(url.searchParams.get('language')).toBe('vi-VN');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.has('region')).toBe(false);
  });

  it('maps 404 to TmdbError kind not_found', async () => {
    server.use(
      http.get(`${BASE}/movie/1`, () => new HttpResponse(null, { status: 404 }))
    );

    const error = await catchError(
      tmdbFetch('/movie/1', { schema, revalidate: 60 })
    );

    expect(error).toMatchObject({
      kind: 'not_found',
      status: 404,
      path: '/movie/1',
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('retries once after 429 then succeeds', async () => {
    let hits = 0;
    server.use(
      http.get(`${BASE}/movie/popular`, () => {
        hits += 1;
        return hits === 1
          ? new HttpResponse(null, {
              status: 429,
              headers: { 'Retry-After': '0' },
            })
          : HttpResponse.json({ page: 1 });
      })
    );

    await expect(
      tmdbFetch('/movie/popular', { schema, revalidate: 60 })
    ).resolves.toEqual({
      page: 1,
    });
    expect(hits).toBe(2);
  });

  it('throws rate_limit when 429 repeats', async () => {
    let hits = 0;
    server.use(
      http.get(`${BASE}/movie/popular`, () => {
        hits += 1;
        return new HttpResponse(null, {
          status: 429,
          headers: { 'Retry-After': '0' },
        });
      })
    );

    const error = await catchError(
      tmdbFetch('/movie/popular', { schema, revalidate: 60 })
    );

    expect(error).toMatchObject({ kind: 'rate_limit', status: 429 });
    expect(hits).toBe(2);
    expect(consoleError).toHaveBeenCalledWith(
      '[tmdb]',
      '/movie/popular',
      'rate_limit',
      429
    );
  });

  it('maps 500 to kind server', async () => {
    server.use(
      http.get(
        `${BASE}/movie/popular`,
        () => new HttpResponse(null, { status: 500 })
      )
    );

    const error = await catchError(
      tmdbFetch('/movie/popular', { schema, revalidate: 60 })
    );

    expect(error).toMatchObject({ kind: 'server', status: 500 });
    expect(consoleError).toHaveBeenCalledWith(
      '[tmdb]',
      '/movie/popular',
      'server',
      500
    );
  });

  it('maps timeout to kind network', async () => {
    server.use(
      http.get(`${BASE}/movie/popular`, async () => {
        await delay('infinite');
        return HttpResponse.json({ page: 1 });
      })
    );

    const error = await catchError(
      tmdbFetch('/movie/popular', { schema, revalidate: 60, timeoutMs: 50 })
    );

    expect(error).toMatchObject({ kind: 'network', status: null });
    expect(consoleError).toHaveBeenCalledWith(
      '[tmdb]',
      '/movie/popular',
      'network',
      null
    );
  });

  it('maps schema mismatch to kind invalid_response and logs once', async () => {
    server.use(
      http.get(`${BASE}/movie/popular`, () => HttpResponse.json({ page: 'x' }))
    );

    const error = await catchError(
      tmdbFetch('/movie/popular', { schema, revalidate: 60 })
    );

    expect(error).toMatchObject({ kind: 'invalid_response', status: 200 });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0].slice(0, 4)).toEqual([
      '[tmdb]',
      '/movie/popular',
      'invalid_response',
      200,
    ]);
  });

  it('maps a non-JSON body to kind invalid_response', async () => {
    server.use(
      http.get(`${BASE}/movie/popular`, () => new HttpResponse('not json'))
    );

    const error = await catchError(
      tmdbFetch('/movie/popular', { schema, revalidate: 60 })
    );

    expect(error).toMatchObject({ kind: 'invalid_response', status: 200 });
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});

describe('retryDelayMs', () => {
  const now = Date.parse('2026-10-12T10:00:00Z');

  it.each([
    ['missing', null, 500],
    ['empty', '', 500],
    ['whitespace', '   ', 500],
    ['garbage', 'abc', 500],
    ['negative seconds', '-5', 500],
    ['fractional seconds', '1.5', 500],
    ['zero seconds', '0', 0],
    ['one second', '1', 1000],
    ['seconds above the cap', '60', 2000],
    ['HTTP-date 1 s ahead', 'Mon, 12 Oct 2026 10:00:01 GMT', 1000],
    ['HTTP-date in the past', 'Mon, 12 Oct 2026 09:59:00 GMT', 0],
    ['HTTP-date far ahead', 'Mon, 12 Oct 2026 11:00:00 GMT', 2000],
  ])('%s (%j) → %i ms', (_label, header, expected) => {
    expect(retryDelayMs(header, now)).toBe(expected);
  });
});

describe('tmdbFetch 429 backoff', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits the default backoff before retrying when Retry-After is missing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    let hits = 0;
    server.use(
      http.get(`${BASE}/movie/popular`, () => {
        hits += 1;
        return hits === 1
          ? new HttpResponse(null, { status: 429 })
          : HttpResponse.json({ page: 1 });
      })
    );

    const result = tmdbFetch('/movie/popular', { schema, revalidate: 60 });
    await vi.advanceTimersByTimeAsync(499);
    expect(hits).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ page: 1 });
    expect(hits).toBe(2);
  });
});
