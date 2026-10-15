import { useTranslations } from 'next-intl';
import { MediaCard } from '@/components/media/MediaCard';
import { MediaGrid } from '@/components/media/MediaGrid';
import { FavoriteButton } from '@/features/favorites/FavoriteButton';
import { getTrendingWall } from '@/lib/tmdb/api';
import type { Locale } from '@/lib/tmdb/constants';
import { TmdbError } from '@/lib/tmdb/errors';
import type { MediaItem } from '@/lib/tmdb/types';

const HEADING_ID = 'trending-wall-heading';

/**
 * Trending posters as a plain HTML grid (wrap it in Suspense).
 *
 * Like MediaRow, data errors are handled here: Home is prerendered (ISR) and a
 * thrown Server Component error would fail the whole prerender. The wall is
 * decorative extra content, so a failure simply leaves it out.
 */
export async function PosterWall({ locale }: { locale: Locale }) {
  let items: MediaItem[];
  try {
    items = await getTrendingWall(locale);
  } catch (error) {
    // tmdbFetch already logged TmdbErrors; log only unexpected ones.
    if (!(error instanceof TmdbError)) {
      console.error('[home]', 'trending wall', error);
    }
    return null;
  }
  if (items.length === 0) return null;
  return <PosterWallView items={items} />;
}

// Hooks cannot run in an async component, so the markup lives in a sync one.
function PosterWallView({ items }: { items: MediaItem[] }) {
  const t = useTranslations('home');

  return (
    <section aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} className="mb-4 text-xl font-bold">
        {t('trendingWall')}
      </h2>
      <MediaGrid>
        {items.map((item) => (
          <MediaCard
            key={`${item.mediaType}-${item.id}`}
            item={item}
            headingLevel="h3"
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
      </MediaGrid>
    </section>
  );
}
