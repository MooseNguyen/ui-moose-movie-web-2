import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  SUGGEST_LIMIT,
  SUGGEST_MIN_LENGTH,
  type Suggestion,
  type SuggestResponse,
} from '@/lib/search-suggest';
import { MAX_QUERY_LENGTH } from '@/lib/search-query';
import { search } from '@/lib/tmdb/api';
import { LOCALES } from '@/lib/tmdb/constants';
import { TmdbError } from '@/lib/tmdb/errors';
import type { GridItem } from '@/lib/tmdb/types';

// A GET Route Handler, not a Server Action: actions are POSTs that Next runs
// one at a time per client, so per-keystroke reads would queue up and could
// not be cancelled. A GET can be aborted by the client and cached by the CDN.

const querySchema = z.object({
  q: z.string().trim().min(SUGGEST_MIN_LENGTH).max(MAX_QUERY_LENGTH),
  locale: z.enum(LOCALES),
});

// Same query, same answer for every visitor: let the CDN absorb repeats
// (TMDB results change slowly; the fetch itself is cached for longer).
const CACHEABLE = 'public, s-maxage=300, stale-while-revalidate=3600';

function toSuggestion(item: GridItem): Suggestion {
  return item.mediaType === 'person'
    ? {
        id: item.id,
        mediaType: 'person',
        title: item.name,
        year: null,
        imagePath: item.profilePath,
      }
    : {
        id: item.id,
        mediaType: item.mediaType,
        title: item.title,
        year: item.year,
        imagePath: item.posterPath,
      };
}

function failure(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) return failure('invalid_input', 400);
  const { q, locale } = parsed.data;

  try {
    const { items } = await search('multi', q, 1, locale);
    const body: SuggestResponse = {
      items: items.slice(0, SUGGEST_LIMIT).map(toSuggestion),
    };
    return Response.json(body, { headers: { 'Cache-Control': CACHEABLE } });
  } catch (error) {
    // TmdbError is already logged by tmdbFetch.
    if (!(error instanceof TmdbError)) console.error('[suggest]', error);
    return error instanceof TmdbError && error.kind === 'rate_limit'
      ? failure('rate_limit', 429)
      : failure('upstream', 502);
  }
}
