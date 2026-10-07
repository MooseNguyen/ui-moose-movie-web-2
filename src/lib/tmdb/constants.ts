import 'server-only';

export type Locale = 'vi' | 'en';
export type MediaType = 'movie' | 'tv';

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const MAX_PAGE = 500;

export const REVALIDATE = {
  list: 3600,
  detail: 86400,
  genres: 604800,
  search: 600,
} as const;

export const MOVIE_LISTS = [
  'popular',
  'top_rated',
  'upcoming',
  'now_playing',
] as const;
export const TV_LISTS = [
  'popular',
  'top_rated',
  'on_the_air',
  'airing_today',
] as const;
export const SEARCH_TYPES = ['multi', 'movie', 'tv', 'person'] as const;
export const LOCALES = ['vi', 'en'] as const;

export type MovieList = (typeof MOVIE_LISTS)[number];
export type TvList = (typeof TV_LISTS)[number];
export type SearchType = (typeof SEARCH_TYPES)[number];

export function toTmdbLanguage(locale: Locale): 'vi-VN' | 'en-US' {
  return locale === 'vi' ? 'vi-VN' : 'en-US';
}
