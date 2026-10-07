import { useTranslations } from 'next-intl';
import { FavoriteButton } from '@/features/favorites/FavoriteButton';
import { Link } from '@/i18n/navigation';
import { getList } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
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

/**
 * Streams one list as a horizontal row (wrap it in Suspense).
 *
 * Data errors are handled here, not by an error boundary: Home is prerendered
 * (ISR), and any error thrown by a Server Component fails the whole
 * prerender/revalidation, so one TMDB hiccup would break the build. The error
 * state is cached like any other render until the next revalidation (≤ 1h).
 */
export async function MediaRow({
  locale,
  ...row
}: RowProps & { locale: Locale }) {
  let items: MediaItem[] | null;
  try {
    ({ items } = await getList(row.mediaType, row.list, 1, locale));
  } catch (error) {
    // tmdbFetch already logs TmdbErrors (all but not_found, which a fixed list
    // endpoint does not return); log only unexpected ones
    // (e.g. a bug while normalizing) so each failure is logged exactly once.
    if (!(error instanceof TmdbError)) {
      console.error('[home]', row.mediaType, row.list, error);
    }
    items = null;
  }
  if (items?.length === 0) return null;
  return <MediaRowView {...row} items={items} />;
}

// Hooks cannot run in an async component, so the markup lives in a sync one.
function MediaRowView({
  title,
  mediaType,
  list,
  items,
}: RowProps & { items: MediaItem[] | null }) {
  const t = useTranslations('home');

  return (
    // No aria-labelledby: the carousel region inside already carries the
    // title, and two nested regions with the same name are just noise.
    <section>
      {/* h-7 header: MediaRowSkeleton reserves the same height. */}
      <div className="mb-4 flex h-7 items-center justify-between gap-4">
        <h2 className="truncate text-xl font-bold">{title}</h2>
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
      {items === null ? (
        <p
          role="status"
          className="text-muted-foreground rounded-lg border p-6 text-sm"
        >
          {t('rowError', { title })}
        </p>
      ) : (
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
      )}
    </section>
  );
}
