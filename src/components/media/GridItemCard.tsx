import { FavoriteButton } from '@/features/favorites/FavoriteButton';
import type { GridItem } from '@/lib/tmdb/types';
import { MediaCard } from './MediaCard';
import { PersonCard } from './PersonCard';

type GridItemCardProps = {
  item: GridItem;
  headingLevel?: 'h2' | 'h3';
  /** Set for above-the-fold cards so the image is not lazy-loaded. */
  priority?: boolean;
};

export function GridItemCard({
  item,
  headingLevel,
  priority = false,
}: GridItemCardProps) {
  if (item.mediaType === 'person') {
    return (
      <PersonCard
        person={item}
        headingLevel={headingLevel}
        priority={priority}
      />
    );
  }

  return (
    <MediaCard
      item={item}
      headingLevel={headingLevel}
      priority={priority}
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
