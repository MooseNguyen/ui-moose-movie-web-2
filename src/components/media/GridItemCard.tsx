import { FavoriteButton } from '@/features/favorites/FavoriteButton';
import type { GridItem } from '@/lib/tmdb/types';
import { MediaCard } from './MediaCard';
import { PersonCard } from './PersonCard';

type GridItemCardProps = {
  item: GridItem;
  /** Set for above-the-fold cards so the image is not lazy-loaded. */
  priority?: boolean;
  headingLevel?: 'h2' | 'h3';
};

export function GridItemCard({
  item,
  priority = false,
  headingLevel,
}: GridItemCardProps) {
  if (item.mediaType === 'person') {
    return (
      <PersonCard
        person={item}
        priority={priority}
        headingLevel={headingLevel}
      />
    );
  }

  return (
    <MediaCard
      item={item}
      priority={priority}
      headingLevel={headingLevel}
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
