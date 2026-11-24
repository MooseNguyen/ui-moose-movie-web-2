'use client';

import { Info } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/features/favorites/FavoriteButton';
import { Link } from '@/i18n/navigation';
import type { MediaItem } from '@/lib/tmdb/types';
import { cn } from '@/lib/utils';
import { TrailerButton } from './TrailerButton';

type HeroDetailsProps = {
  item: MediaItem;
  onTrailerOpenChange: (open: boolean) => void;
  className?: string;
};

/**
 * Title, meta line, overview and actions of a Home hero title. Shared by the
 * slideshow (HeroSlider) and the 3D hero (Hero3D).
 */
export function HeroDetails({
  item,
  onTrailerOpenChange,
  className,
}: HeroDetailsProps) {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const format = useFormatter();
  const showRating = item.voteCount > 0;

  return (
    <div className={cn('max-w-2xl min-w-0', className)}>
      <h2 className="line-clamp-2 text-3xl font-bold md:text-5xl">
        {item.title}
      </h2>
      {(item.year !== null || showRating) && (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium">
          {item.year !== null && <span>{item.year}</span>}
          {item.year !== null && showRating && (
            <span aria-hidden="true">·</span>
          )}
          {showRating && (
            <span>
              <span className="sr-only">{tc('rating')}</span>
              <span aria-hidden="true">★ </span>
              {format.number(item.voteAverage, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </span>
          )}
        </p>
      )}
      {item.overview && (
        <p className="mt-3 line-clamp-3 text-sm md:text-base">
          {item.overview}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link
            href={`/${item.mediaType}/${item.id}`}
            aria-label={t('detailsTitle', { title: item.title })}
          >
            <Info aria-hidden="true" />
            {t('details')}
          </Link>
        </Button>
        <TrailerButton
          mediaType={item.mediaType}
          id={item.id}
          title={item.title}
          onOpenChange={onTrailerOpenChange}
          variant="secondary"
        />
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
      </div>
    </div>
  );
}
