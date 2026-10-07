import { FavoriteButton } from '@/features/favorites/FavoriteButton';
import type { GridItem } from '@/lib/tmdb/types';
import { MediaCard } from './MediaCard';
import { PersonCard } from './PersonCard';

export function GridItemCard({ item }: { item: GridItem }) {
  if (item.mediaType === 'person') return <PersonCard person={item} />;

  return (
    <MediaCard
      item={item}
      action={
        <FavoriteButton
          item={{
            id: item.id,
            mediaType: item.mediaType,
            title: item.title,
            posterPath: item.posterPath,
            voteAverage: item.voteAverage,
            year: item.year,
          }}
        />
      }
    />
  );
}
