import { useTranslations } from 'next-intl';
import { FavoriteButton } from '@/features/favorites/FavoriteButton';
import { Link } from '@/i18n/navigation';
import { getList } from '@/lib/tmdb/api';
import type {
  Locale,
  MediaType,
  MovieList,
  TvList,
} from '@/lib/tmdb/constants';
import type { MediaItem } from '@/lib/tmdb/types';
import { MediaCard } from './MediaCard';
import { MediaCarousel } from './MediaCarousel';

type RowProps = {
  title: string;
  mediaType: MediaType;
  list: MovieList | TvList;
};

/** Streams one list as a horizontal row; wrap it in Suspense + ErrorBoundary. */
export async function MediaRow({
  locale,
  ...row
}: RowProps & { locale: Locale }) {
  const { items } = await getList(row.mediaType, row.list, 1, locale);
  if (items.length === 0) return null;
  return <MediaRowView {...row} items={items} />;
}

// Hooks cannot run in an async component, so the markup lives in a sync one.
function MediaRowView({
  title,
  mediaType,
  list,
  items,
}: RowProps & { items: MediaItem[] }) {
  const t = useTranslations('home');
  const headingId = `row-${mediaType}-${list}`;

  return (
    <section aria-labelledby={headingId}>
      {/* h-7 header: MediaRowSkeleton reserves the same height. */}
      <div className="mb-4 flex h-7 items-center justify-between gap-4">
        <h2 id={headingId} className="truncate text-xl font-bold">
          {title}
        </h2>
        <Link
          href={`/${mediaType}?list=${list}`}
          // Visible text first keeps the label-in-name rule; the title makes
          // every row's link unique in a links list.
          aria-label={t('seeAllTitle', { title })}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-2"
        >
          {t('seeAll')}
        </Link>
      </div>
      <MediaCarousel label={title}>
        {items.map((item) => (
          <MediaCard
            key={item.id}
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
        ))}
      </MediaCarousel>
    </section>
  );
}
