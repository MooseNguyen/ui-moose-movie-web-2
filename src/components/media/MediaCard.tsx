import Image from 'next/image';
import type { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { tmdbImage } from '@/lib/images';
import { GRID_POSTER_SIZES } from './MediaGrid';
import { CARD_NAV_TRANSITION, posterTransitionName } from './poster-transition';
import type { MediaItem } from '@/lib/tmdb/types';

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
  /** Set for LCP-candidate cards: the poster is preloaded with a high fetch priority. */
  priority?: boolean;
  /** Slot for an overlay control (e.g. FavoriteButton), rendered outside the link. */
  action?: ReactNode;
  /**
   * Title element. h3 under a section h2 (rows, filmography); h2 when the
   * grid sits directly under the page h1, so no heading level is skipped.
   */
  headingLevel?: 'h2' | 'h3';
  /**
   * Poster `sizes` for the layout the card sits in: GRID_POSTER_SIZES
   * (default) or CAROUSEL_POSTER_SIZES.
   */
  sizes?: string;
};

export function MediaCard({
  item,
  priority = false,
  action,
  headingLevel: Heading = 'h3',
  sizes = GRID_POSTER_SIZES,
}: MediaCardProps) {
  const format = useFormatter();
  const t = useTranslations('common');
  const showRating = item.voteCount > 0;

  return (
    // data-testid: E2E needs to count cards, and their accessible names are
    // TMDB titles that change daily.
    // data-tilt: pointer tilt target (TiltController + globals.css).
    <div data-testid="media-card" data-tilt className="group relative">
      <Link
        href={`/${item.mediaType}/${item.id}`}
        transitionTypes={[CARD_NAV_TRANSITION]}
        className="focus-visible:ring-ring block rounded-lg outline-none focus-visible:ring-2"
      >
        {/* Named only when clicked (PosterTransitionController). */}
        <div
          data-poster-transition={posterTransitionName(item.mediaType, item.id)}
          className="bg-muted relative aspect-[2/3] overflow-hidden rounded-lg [view-transition-class:poster-morph]"
        >
          <Image
            src={tmdbImage(item.posterPath, 'w342')}
            alt=""
            fill
            sizes={sizes}
            unoptimized={!item.posterPath}
            // LCP candidate: preloaded with a high fetch priority; the rest wait.
            {...(priority
              ? { preload: true, fetchPriority: 'high' as const }
              : { loading: 'lazy' as const })}
            className="object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
          {/* Decorative light that follows the pointer (TiltController + globals.css). */}
          <span aria-hidden="true" className="tilt-glare" />
        </div>
        {/* data-tilt-layer: floats above the poster while tilted. */}
        <Heading
          data-tilt-layer
          className="mt-2 line-clamp-2 text-sm font-medium"
        >
          {item.title}
        </Heading>
        {(item.year !== null || showRating) && (
          <p
            data-tilt-layer
            className="text-muted-foreground mt-0.5 flex gap-2 text-xs"
          >
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
      {action && (
        <div data-tilt-layer className="absolute top-2 right-2">
          {action}
        </div>
      )}
    </div>
  );
}
