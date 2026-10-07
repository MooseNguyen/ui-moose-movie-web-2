import type { MediaType } from '@/lib/tmdb/constants';

// Local media type runtime list to avoid importing values from server-only module
const MEDIA_TYPES = ['movie', 'tv'] as const satisfies readonly MediaType[];

export const DISCOVER_SORTS = [
  'popularity.desc',
  'vote_average.desc',
  'release_date.desc',
  'title.asc',
] as const;

export type DiscoverSort = (typeof DISCOVER_SORTS)[number];

export type DiscoverParams = {
  type: MediaType;
  genres: number[];
  year: number | null;
  sort: DiscoverSort;
};

export const DEFAULT_DISCOVER: DiscoverParams = {
  type: 'movie',
  genres: [],
  year: null,
  sort: 'popularity.desc',
};

/**
 * Parse discover parameters from URL query string.
 * Invalid values fall back to defaults per field.
 * @param sp - Search params from URL
 * @param now - Current date (for year validation), defaults to Date.now()
 */
export function parseDiscoverParams(
  sp: Record<string, string | string[] | undefined>,
  now: Date = new Date()
): DiscoverParams {
  const type = parseType(sp.type);
  const genres = parseGenres(sp.genres);
  const year = parseYear(sp.year, now);
  const sort = parseSort(sp.sort);

  return { type, genres, year, sort };
}

/**
 * Serialize discover parameters to query string.
 * Omits fields that match the default.
 */
export function serializeDiscoverParams(p: DiscoverParams): string {
  const params = new URLSearchParams();

  if (p.type !== DEFAULT_DISCOVER.type) {
    params.append('type', p.type);
  }

  if (p.genres.length > 0) {
    params.append('genres', p.genres.join(','));
  }

  if (p.year !== null) {
    params.append('year', p.year.toString());
  }

  if (p.sort !== DEFAULT_DISCOVER.sort) {
    params.append('sort', p.sort);
  }

  return params.toString();
}

/**
 * Map discover parameters to TMDB discover API query params.
 */
export function toTmdbDiscoverQuery(
  p: DiscoverParams
): Record<string, string | number> {
  const query: Record<string, string | number> = {};

  // Map sort by media type
  if (p.type === 'movie') {
    query.sort_by = MOVIE_SORT_MAP[p.sort];
    if (p.year !== null) {
      query.primary_release_year = p.year;
    }
  } else {
    // tv
    query.sort_by = TV_SORT_MAP[p.sort];
    if (p.year !== null) {
      query.first_air_date_year = p.year;
    }
  }

  // Add genres
  if (p.genres.length > 0) {
    query.with_genres = p.genres.join(',');
  }

  // Add vote_count minimum for rating sort
  if (p.sort === 'vote_average.desc') {
    query['vote_count.gte'] = 200;
  }

  return query;
}

// ============================================================================
// Helper functions
// ============================================================================

function getFirstValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseType(value: string | string[] | undefined): MediaType {
  const v = getFirstValue(value);
  return v && MEDIA_TYPES.includes(v as MediaType)
    ? (v as MediaType)
    : DEFAULT_DISCOVER.type;
}

function parseGenres(value: string | string[] | undefined): number[] {
  const v = getFirstValue(value);
  if (!v) {
    return [];
  }

  const genreIds = v
    .split(',')
    .map((g) => {
      // Only accept strict decimal notation: /^\d+$/
      if (!/^\d+$/.test(g)) {
        return null;
      }
      const id = parseInt(g, 10);
      // Only include safe positive integers
      return Number.isSafeInteger(id) && id > 0 ? id : null;
    })
    .filter((id): id is number => id !== null);

  // Deduplicate and sort ascending
  return Array.from(new Set(genreIds)).sort((a, b) => a - b);
}

function parseYear(
  value: string | string[] | undefined,
  now: Date
): number | null {
  const v = getFirstValue(value);
  if (!v) {
    return null;
  }

  const year = parseInt(v, 10);

  // Must be an integer (check that string parses to just the integer without decimals)
  if (!Number.isInteger(year) || v !== year.toString()) {
    return null;
  }

  // Must be within 1950 to current year (inclusive)
  const currentYear = now.getFullYear();
  if (year < 1950 || year > currentYear) {
    return null;
  }

  return year;
}

function parseSort(value: string | string[] | undefined): DiscoverSort {
  const v = getFirstValue(value);
  return v && DISCOVER_SORTS.includes(v as DiscoverSort)
    ? (v as DiscoverSort)
    : DEFAULT_DISCOVER.sort;
}

const MOVIE_SORT_MAP: Record<DiscoverSort, string> = {
  'popularity.desc': 'popularity.desc',
  'vote_average.desc': 'vote_average.desc',
  'release_date.desc': 'primary_release_date.desc',
  'title.asc': 'title.asc',
};

const TV_SORT_MAP: Record<DiscoverSort, string> = {
  'popularity.desc': 'popularity.desc',
  'vote_average.desc': 'vote_average.desc',
  'release_date.desc': 'first_air_date.desc',
  'title.asc': 'name.asc',
};
