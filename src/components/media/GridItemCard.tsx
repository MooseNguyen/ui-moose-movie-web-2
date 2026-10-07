import type { GridItem } from '@/lib/tmdb/types';
import { MediaCard } from './MediaCard';
import { PersonCard } from './PersonCard';

export function GridItemCard({ item }: { item: GridItem }) {
  return item.mediaType === 'person' ? (
    <PersonCard person={item} />
  ) : (
    <MediaCard item={item} />
  );
}
