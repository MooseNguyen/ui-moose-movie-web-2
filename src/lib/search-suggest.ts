// Client-safe contract of /api/search/suggest, shared by the route handler
// and the search dialog (the TMDB types are server-only).

/** Shortest query that asks for suggestions (one letter matches too much). */
export const SUGGEST_MIN_LENGTH = 2;

/** Suggestions shown under the search input. */
export const SUGGEST_LIMIT = 8;

export type Suggestion = {
  id: number;
  mediaType: 'movie' | 'tv' | 'person';
  /** Title, or the person's name. */
  title: string;
  year: number | null;
  /** Poster, or the person's profile photo. */
  imagePath: string | null;
};

export type SuggestResponse = { items: Suggestion[] };

export function suggestUrl(q: string, locale: string): string {
  return `/api/search/suggest?${new URLSearchParams({ q, locale })}`;
}
