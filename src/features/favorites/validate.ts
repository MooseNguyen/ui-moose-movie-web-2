import type { MediaType } from '@/lib/tmdb/constants';

export type FavoriteItem = {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  voteAverage: number;
  year: number | null;
  addedAt: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Runtime guard for data read back from localStorage, which anyone (or an old
 * app version) can have written. Hand-written instead of Zod so the client
 * bundle does not pay for a schema library. Extra fields are ignored.
 */
export function isFavoriteItem(value: unknown): value is FavoriteItem {
  if (!isRecord(value)) return false;
  const { id, mediaType, title, posterPath, voteAverage, year, addedAt } =
    value;
  return (
    typeof id === 'number' &&
    Number.isInteger(id) &&
    id > 0 &&
    (mediaType === 'movie' || mediaType === 'tv') &&
    typeof title === 'string' &&
    title.length > 0 &&
    (posterPath === null || typeof posterPath === 'string') &&
    typeof voteAverage === 'number' &&
    Number.isFinite(voteAverage) &&
    (year === null || (typeof year === 'number' && Number.isInteger(year))) &&
    typeof addedAt === 'number' &&
    Number.isFinite(addedAt)
  );
}
