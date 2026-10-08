import 'server-only';
import { z } from 'zod';
import {
  type DiscoverParams,
  toTmdbDiscoverQuery,
} from '@/features/discover/params';
import { tmdbFetch } from './client';
import {
  type Locale,
  type MediaType,
  type MovieList,
  REVALIDATE,
  type SearchType,
  type TvList,
} from './constants';
import {
  toGridItems,
  toMediaDetail,
  toMediaItem,
  toPaginated,
  toPersonDetail,
  pickVideos,
} from './normalize';
import {
  pageSchema,
  rawGenresSchema,
  rawMovieDetailSchema,
  rawMovieSchema,
  rawMultiItemSchema,
  rawPersonDetailSchema,
  rawTvDetailSchema,
  rawTvSchema,
  rawVideosSchema,
} from './schemas';
import type {
  Genre,
  GridItem,
  MediaDetail,
  MediaItem,
  Paginated,
  PersonDetail,
  Video,
} from './types';

const TRENDING_COUNT = 5;
const POPULAR_ID_PAGES = 5;

const overviewOnlySchema = z.object({ overview: z.string().catch('') });
const biographyOnlySchema = z.object({ biography: z.string().catch('') });

// TMDB filters videos by the request language, and most trailers are English
// or language-less: always include those next to the locale.
const videoLanguages = (locale: Locale) =>
  [...new Set([locale, 'en', 'null'])].join(',');

const itemSchema = (mediaType: MediaType) =>
  mediaType === 'movie' ? rawMovieSchema : rawTvSchema;

export async function getTrending(locale: Locale): Promise<MediaItem[]> {
  const raw = await tmdbFetch('/trending/all/week', {
    schema: pageSchema(rawMultiItemSchema),
    locale,
    revalidate: REVALIDATE.list,
  });
  return toGridItems(raw.results)
    .filter((item): item is MediaItem => item.mediaType !== 'person')
    .slice(0, TRENDING_COUNT);
}

export async function getList(
  mediaType: MediaType,
  list: MovieList | TvList,
  page: number,
  locale: Locale
): Promise<Paginated<MediaItem>> {
  const raw = await tmdbFetch(`/${mediaType}/${list}`, {
    schema: pageSchema(itemSchema(mediaType)),
    locale,
    params: { page },
    revalidate: REVALIDATE.list,
  });
  return toPaginated(raw, (results) =>
    results.map((r) => toMediaItem(r, mediaType))
  );
}

export async function getDetail(
  mediaType: MediaType,
  id: number,
  locale: Locale
): Promise<MediaDetail> {
  const options = {
    locale,
    params: {
      append_to_response: 'credits,videos,recommendations,similar',
      include_video_language: videoLanguages(locale),
    },
    revalidate: REVALIDATE.detail,
  };
  // The two schemas have different output types, so each branch keeps its own type.
  const raw =
    mediaType === 'movie'
      ? await tmdbFetch(`/movie/${id}`, {
          ...options,
          schema: rawMovieDetailSchema,
        })
      : await tmdbFetch(`/tv/${id}`, { ...options, schema: rawTvDetailSchema });

  let fallbackOverview: string | undefined;
  if (locale === 'vi' && raw.overview.trim() === '') {
    // Best effort: a failed English lookup must not take down a page that loaded fine in vi.
    try {
      const en = await tmdbFetch(`/${mediaType}/${id}`, {
        schema: overviewOnlySchema,
        locale: 'en',
        revalidate: REVALIDATE.detail,
      });
      fallbackOverview = en.overview;
    } catch {
      // Already logged by tmdbFetch.
    }
  }
  return toMediaDetail(raw, mediaType, fallbackOverview);
}

export async function getVideos(
  mediaType: MediaType,
  id: number,
  locale: Locale
): Promise<Video[]> {
  const raw = await tmdbFetch(`/${mediaType}/${id}/videos`, {
    schema: rawVideosSchema,
    locale,
    params: { include_video_language: videoLanguages(locale) },
    revalidate: REVALIDATE.detail,
  });
  return pickVideos(raw.results);
}

export async function search(
  type: SearchType,
  q: string,
  page: number,
  locale: Locale
): Promise<Paginated<GridItem>> {
  const raw = await tmdbFetch(`/search/${type}`, {
    schema: pageSchema(rawMultiItemSchema),
    locale,
    params: { query: q, page },
    revalidate: REVALIDATE.search,
  });
  // Only /search/multi sets media_type; the typed endpoints omit it, so stamp it from the endpoint.
  return toPaginated(raw, (results) =>
    toGridItems(
      type === 'multi'
        ? results
        : results.map((r) => ({ ...r, media_type: type }))
    )
  );
}

export async function discover(
  p: DiscoverParams,
  page: number,
  locale: Locale
): Promise<Paginated<MediaItem>> {
  const raw = await tmdbFetch(`/discover/${p.type}`, {
    schema: pageSchema(itemSchema(p.type)),
    locale,
    params: { ...toTmdbDiscoverQuery(p), page },
    revalidate: REVALIDATE.list,
  });
  return toPaginated(raw, (results) =>
    results.map((r) => toMediaItem(r, p.type))
  );
}

export async function getGenres(
  mediaType: MediaType,
  locale: Locale
): Promise<Genre[]> {
  const raw = await tmdbFetch(`/genre/${mediaType}/list`, {
    schema: rawGenresSchema,
    locale,
    revalidate: REVALIDATE.genres,
  });
  return raw.genres;
}

export async function getPerson(
  id: number,
  locale: Locale
): Promise<PersonDetail> {
  const raw = await tmdbFetch(`/person/${id}`, {
    schema: rawPersonDetailSchema,
    locale,
    params: { append_to_response: 'combined_credits' },
    revalidate: REVALIDATE.detail,
  });

  let fallbackBiography: string | undefined;
  if (locale === 'vi' && raw.biography.trim() === '') {
    try {
      const en = await tmdbFetch(`/person/${id}`, {
        schema: biographyOnlySchema,
        locale: 'en',
        revalidate: REVALIDATE.detail,
      });
      fallbackBiography = en.biography;
    } catch {
      // Already logged by tmdbFetch.
    }
  }
  return toPersonDetail(raw, fallbackBiography);
}

// Used for generateStaticParams: locale does not matter for ids, so `en` keeps one cache entry.
export async function getPopularIds(mediaType: MediaType): Promise<number[]> {
  const pages = await Promise.all(
    Array.from({ length: POPULAR_ID_PAGES }, (_, i) =>
      getList(mediaType, 'popular', i + 1, 'en')
    )
  );
  return [...new Set(pages.flatMap((p) => p.items.map((item) => item.id)))];
}
