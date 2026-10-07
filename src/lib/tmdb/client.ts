import 'server-only';
import type { z } from 'zod';
import { getEnv } from '@/lib/env';
import { type Locale, TMDB_BASE_URL, toTmdbLanguage } from './constants';
import { TmdbError, type TmdbErrorKind } from './errors';

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RETRY_DELAY_MS = 2000;

type NextFetchInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

export interface TmdbFetchOptions<T> {
  schema: z.ZodType<T>;
  locale?: Locale;
  params?: Record<string, string | number | undefined>;
  revalidate: number;
  tags?: string[];
  timeoutMs?: number;
}

function buildUrl(
  path: string,
  locale: Locale | undefined,
  params: TmdbFetchOptions<unknown>['params']
): string {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  if (locale) url.searchParams.set('language', toTmdbLanguage(locale));
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function retryDelayMs(response: Response): number {
  const seconds = Number(response.headers.get('Retry-After'));
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
}

// Single logging point for every failure; not_found is expected control flow, so it stays quiet.
function fail(
  kind: TmdbErrorKind,
  path: string,
  status: number | null,
  cause?: unknown,
  detail?: unknown
): TmdbError {
  if (kind !== 'not_found') {
    console.error(
      '[tmdb]',
      path,
      kind,
      status,
      ...(detail === undefined ? [] : [detail])
    );
  }
  return new TmdbError(
    kind,
    path,
    status,
    cause === undefined ? undefined : { cause }
  );
}

async function request(
  url: string,
  path: string,
  init: Omit<NextFetchInit, 'signal'>,
  timeoutMs: number
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    } as NextFetchInit);
  } catch (error) {
    throw fail('network', path, null, error);
  }
}

export async function tmdbFetch<T>(
  path: string,
  opts: TmdbFetchOptions<T>
): Promise<T> {
  const {
    schema,
    locale,
    params,
    revalidate,
    tags,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;
  const url = buildUrl(path, locale, params);
  const init: NextFetchInit = {
    headers: {
      Authorization: `Bearer ${getEnv().TMDB_READ_TOKEN}`,
      Accept: 'application/json',
    },
    next: { revalidate, tags },
  };

  let response = await request(url, path, init, timeoutMs);
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response)));
    response = await request(url, path, init, timeoutMs);
  }

  if (!response.ok) {
    if (response.status === 404) throw fail('not_found', path, 404);
    if (response.status === 429) throw fail('rate_limit', path, 429);
    throw fail('server', path, response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw fail('invalid_response', path, response.status, error);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw fail(
      'invalid_response',
      path,
      response.status,
      parsed.error,
      parsed.error.issues
    );
  }
  return parsed.data;
}
