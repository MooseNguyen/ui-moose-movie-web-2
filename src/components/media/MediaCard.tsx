import Image from 'next/image';
import type { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tmdbImage } from '@/lib/images';
import type { MediaItem } from '@/lib/tmdb/types';

// Matches the MediaGrid / MediaCarousel column counts per breakpoint.
const POSTER_SIZES =
  '(min-width: 1280px) 16vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw';

/** Only the fields the card reads, so callers can pass slim items (e.g. person credits). */
export type MediaCardItem = Pick<
  MediaItem,
  | 'id'
  | 'mediaType'
  | 'title'
  | 'posterPath'
  | 'year'
  | 'voteAverage'
  | 'voteCount'
>;

type MediaCardProps = {
  item: MediaCardItem;
  /** Set for above-the-fold cards so the poster is not lazy-loaded. */
  priority?: boolean;
  /** Slot for an overlay control (e.g. FavoriteButton), rendered outside the link. */
  action?: ReactNode;
};

export function MediaCard({ item, priority = false, action }: MediaCardProps) {
  const format = useFormatter();
  const t = useTranslations('common');
  const showRating = item.voteCount > 0;

  return (
    // data-testid: E2E needs to count cards, and their accessible names are
    // TMDB titles that change daily.
    <div data-testid="media-card" className="group relative">
      <Link
        href={`/${item.mediaType}/${item.id}`}
        className="focus-visible:ring-ring block rounded-lg outline-none focus-visible:ring-2"
      >
        <div className="bg-muted relative aspect-[2/3] overflow-hidden rounded-lg">
          <Image
            src={tmdbImage(item.posterPath, 'w342')}
            alt=""
            fill
            sizes={POSTER_SIZES}
            unoptimized={!item.posterPath}
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-medium">{item.title}</h3>
        {(item.year !== null || showRating) && (
          <p className="text-muted-foreground mt-0.5 flex gap-2 text-xs">
            {item.year !== null && <span>{item.year}</span>}
            {showRating && (
              <span>
                <span className="sr-only">{t('rating')}</span>
                <span aria-hidden="true">★ </span>
                {format.number(item.voteAverage, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
              </span>
            )}
          </p>
        )}
      </Link>
      {action && <div className="absolute top-2 right-2">{action}</div>}
    </div>
  );
}
