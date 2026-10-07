'use client';

/**
 * Widths TMDB serves for every image family (poster, backdrop, profile),
 * verified with real requests. `next.config.ts` builds its `deviceSizes` and
 * `imageSizes` from this list, so every srcset entry maps to a real file.
 */
export const TMDB_WIDTHS = [92, 154, 185, 300, 342, 500, 780, 1280] as const;

const TMDB_PREFIX = 'https://image.tmdb.org/t/p/';

type LoaderParams = { src: string; width: number; quality?: number };

/**
 * Global next/image loader (`images.loaderFile`). TMDB already hosts resized
 * copies, so instead of an optimization server we swap the size segment of
 * `https://image.tmdb.org/t/p/{size}/{file}` for the smallest TMDB width that
 * covers the request. `quality` is ignored: TMDB has no quality parameter.
 * Other sources (local files, YouTube thumbnails) are returned unchanged and
 * should be rendered with `unoptimized` so no fake srcset is generated.
 */
export default function tmdbImageLoader({ src, width }: LoaderParams): string {
  if (!src.startsWith(TMDB_PREFIX)) return src;

  const rest = src.slice(TMDB_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return src;

  const size = TMDB_WIDTHS.find((w) => w >= width);
  return `${TMDB_PREFIX}${size ? `w${size}` : 'original'}${rest.slice(slash)}`;
}
