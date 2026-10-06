// @vitest-environment node
import { http, HttpResponse, delay } from 'msw';
import { z } from 'zod';
import { resetEnvCache } from '@/lib/env';
import { server } from '../../../tests/msw/server';
import { TmdbError } from './errors';
import { tmdbFetch } from './client';

const BASE = 'https://api.themoviedb.org/3';
const schema = z.object({ page: z.number() });

beforeEach(() => {
  vi.stubEnv('TMDB_READ_TOKEN', 'test-token');
  resetEnvCache();
});

afterEach(() => {
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
      }),
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
    server.use(http.get(`${BASE}/movie/1`, () => new HttpResponse(null, { status: 404 })));

    const error = await catchError(tmdbFetch('/movie/1', { schema, revalidate: 60 }));

    expect(error).toMatchObject({ kind: 'not_found', status: 404, path: '/movie/1' });
  });

  it('retries once after 429 then succeeds', async () => {
    let hits = 0;
    server.use(
      http.get(`${BASE}/movie/popular`, () => {
        hits += 1;
        return hits === 1
          ? new HttpResponse(null, { status: 429, headers: { 'Retry-After': '0' } })
          : HttpResponse.json({ page: 1 });
      }),
    );

    await expect(tmdbFetch('/movie/popular', { schema, revalidate: 60 })).resolves.toEqual({
      page: 1,
    });
    expect(hits).toBe(2);
  });

  it('throws rate_limit when 429 repeats', async () => {
    let hits = 0;
    server.use(
      http.get(`${BASE}/movie/popular`, () => {
        hits += 1;
        return new HttpResponse(null, { status: 429, headers: { 'Retry-After': '0' } });
      }),
    );

    const error = await catchError(tmdbFetch('/movie/popular', { schema, revalidate: 60 }));

    expect(error).toMatchObject({ kind: 'rate_limit', status: 429 });
    expect(hits).toBe(2);
  });

  it('maps 500 to kind server', async () => {
    server.use(http.get(`${BASE}/movie/popular`, () => new HttpResponse(null, { status: 500 })));

    const error = await catchError(tmdbFetch('/movie/popular', { schema, revalidate: 60 }));

    expect(error).toMatchObject({ kind: 'server', status: 500 });
  });

  it('maps timeout to kind network', async () => {
    server.use(
      http.get(`${BASE}/movie/popular`, async () => {
        await delay('infinite');
        return HttpResponse.json({ page: 1 });
      }),
    );

    const error = await catchError(
      tmdbFetch('/movie/popular', { schema, revalidate: 60, timeoutMs: 50 }),
    );

    expect(error).toMatchObject({ kind: 'network', status: null });
  });

  it('maps schema mismatch to kind invalid_response and logs once', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get(`${BASE}/movie/popular`, () => HttpResponse.json({ page: 'x' })));

    const error = await catchError(tmdbFetch('/movie/popular', { schema, revalidate: 60 }));

    expect(error).toMatchObject({ kind: 'invalid_response', status: 200 });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toBe('[tmdb]');
    consoleError.mockRestore();
  });

  it('maps a non-JSON body to kind invalid_response', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get(`${BASE}/movie/popular`, () => new HttpResponse('not json')));

    const error = await catchError(tmdbFetch('/movie/popular', { schema, revalidate: 60 }));

    expect(error).toMatchObject({ kind: 'invalid_response', status: 200 });
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
