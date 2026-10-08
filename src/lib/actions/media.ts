'use server';

import { z } from 'zod';
import { parseDiscoverParams } from '@/features/discover/params';
import { MAX_QUERY_LENGTH } from '@/lib/route-params';
import { discover, getList, getVideos, search } from '@/lib/tmdb/api';
import {
  LOCALES,
  MAX_PAGE,
  MOVIE_LISTS,
  SEARCH_TYPES,
  TV_LISTS,
} from '@/lib/tmdb/constants';
import { TmdbError } from '@/lib/tmdb/errors';
import type { GridItem, MediaItem, Paginated, Video } from '@/lib/tmdb/types';
import type { ActionError, ActionResult } from './types';
import type { Locale, MediaType, SearchType } from '@/lib/tmdb/constants';

// Server Actions are public HTTP endpoints: TypeScript types are erased at
// runtime, so every argument is re-validated here and no action ever throws.

const localeSchema = z.enum(LOCALES);
const pageSchema = z.number().int().min(2).max(MAX_PAGE);

const listBaseSchema = z.discriminatedUnion('mediaType', [
  z.object({
    mediaType: z.literal('movie'),
    list: z.enum(MOVIE_LISTS),
    locale: localeSchema,
  }),
  z.object({
    mediaType: z.literal('tv'),
    list: z.enum(TV_LISTS),
    locale: localeSchema,
  }),
]);

const searchBaseSchema = z.object({
  type: z.enum(SEARCH_TYPES),
  q: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
  locale: localeSchema,
});

const discoverBaseSchema = z.object({
  query: z.string().max(200),
  locale: localeSchema,
});

const trailerSchema = z.object({
  mediaType: z.enum(['movie', 'tv']),
  id: z.number().int().positive().safe(),
  locale: localeSchema,
});

const INVALID_INPUT = { ok: false, error: 'invalid_input' } as const;

function toActionError(error: unknown, action: string): ActionError {
  if (error instanceof TmdbError) {
    switch (error.kind) {
      case 'not_found':
        return 'not_found';
      case 'rate_limit':
        return 'rate_limit';
      case 'network':
        return 'network';
      default:
        // TmdbError is already logged by tmdbFetch.
        return 'unknown';
    }
  }
  console.error('[action]', action, error);
  return 'unknown';
}

async function run<T>(
  action: string,
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: toActionError(error, action) };
  }
}

export async function loadMoreList(
  base: { mediaType: MediaType; list: string; locale: Locale },
  page: number
): Promise<ActionResult<Paginated<MediaItem>>> {
  const parsedBase = listBaseSchema.safeParse(base);
  const parsedPage = pageSchema.safeParse(page);
  if (!parsedBase.success || !parsedPage.success) return INVALID_INPUT;
  const { mediaType, list, locale } = parsedBase.data;
  return run('loadMoreList', () =>
    getList(mediaType, list, parsedPage.data, locale)
  );
}

export async function loadMoreSearch(
  base: { type: SearchType; q: string; locale: Locale },
  page: number
): Promise<ActionResult<Paginated<GridItem>>> {
  const parsedBase = searchBaseSchema.safeParse(base);
  const parsedPage = pageSchema.safeParse(page);
  if (!parsedBase.success || !parsedPage.success) return INVALID_INPUT;
  const { type, q, locale } = parsedBase.data;
  return run('loadMoreSearch', () => search(type, q, parsedPage.data, locale));
}

export async function loadMoreDiscover(
  base: { query: string; locale: Locale },
  page: number
): Promise<ActionResult<Paginated<MediaItem>>> {
  const parsedBase = discoverBaseSchema.safeParse(base);
  const parsedPage = pageSchema.safeParse(page);
  if (!parsedBase.success || !parsedPage.success) return INVALID_INPUT;
  const { query, locale } = parsedBase.data;
  // Garbage values fall back to defaults per field; that is not invalid input.
  const params = parseDiscoverParams(
    Object.fromEntries(new URLSearchParams(query))
  );
  return run('loadMoreDiscover', () =>
    discover(params, parsedPage.data, locale)
  );
}

export async function getTrailer(input: {
  mediaType: MediaType;
  id: number;
  locale: Locale;
}): Promise<ActionResult<Video | null>> {
  const parsed = trailerSchema.safeParse(input);
  if (!parsed.success) return INVALID_INPUT;
  const { mediaType, id, locale } = parsed.data;
  return run('getTrailer', async () => {
    const videos = await getVideos(mediaType, id, locale);
    return videos[0] ?? null;
  });
}
