export type ImageSize = 'w185' | 'w342' | 'w780' | 'w1280' | 'original';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export function tmdbImage(
  path: string | null,
  size: ImageSize,
  kind: 'poster' | 'profile' | 'backdrop' = 'poster'
): string {
  return path ? `${IMAGE_BASE_URL}/${size}${path}` : `/placeholder-${kind}.svg`;
}
