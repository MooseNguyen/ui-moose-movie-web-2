import {
  MOVIE_LISTS,
  TV_LISTS,
  type MediaType,
  type MovieList,
  type TvList,
} from '@/lib/tmdb/constants';

// Untrusted URL segments / search params are narrowed here, once, so pages
// never pass raw strings to the data layer.

export function parseMediaType(v: string): MediaType | null {
  return v === 'movie' || v === 'tv' ? v : null;
}

/** Invalid, missing or other-media-type values fall back to `popular`. */
export function parseListName(
  mediaType: MediaType,
  v: string | string[] | undefined
): MovieList | TvList {
  // A repeated param (?list=a&list=b) arrives as an array: first one wins.
  const value = Array.isArray(v) ? v[0] : v;
  const lists: readonly string[] =
    mediaType === 'movie' ? MOVIE_LISTS : TV_LISTS;
  return (lists.includes(value as string) ? value : 'popular') as
    MovieList | TvList;
}

/** Digits only, no leading zero, safe integer, > 0. */
export function parsePositiveId(v: string): number | null {
  if (!/^[1-9]\d*$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : null;
}
