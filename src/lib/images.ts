export type ImageSize = 'w185' | 'w342' | 'w780' | 'w1280' | 'original';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/**
 * `crossOrigin` for every <Image> of a TMDB URL. image.tmdb.org sends
 * `Access-Control-Allow-Origin: *` only to requests that carry an Origin
 * header, and no `Vary: Origin`. A plain (no-cors) <img> therefore caches a
 * response without CORS headers for about a year, and a later CORS request for
 * the same URL (the poster wall's WebGL textures) is served that copy and
 * fails. Requesting with CORS everywhere keeps one cacheable variant.
 * next/image forwards it to the <img> and to its preload link.
 */
export const TMDB_CROSS_ORIGIN = 'anonymous';

export function tmdbImage(
  path: string | null,
  size: ImageSize,
  kind: 'poster' | 'profile' | 'backdrop' = 'poster'
): string {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : `/placeholder-${kind}.svg`;
}
