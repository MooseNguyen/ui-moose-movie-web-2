import { useTranslations } from 'next-intl';
import { MediaCard } from '@/components/media/MediaCard';
import { CAROUSEL_POSTER_SIZES } from '@/components/media/carousel-layout';
import { MediaCarousel } from '@/components/media/MediaCarousel';
import { FavoriteButton } from '@/features/favorites/FavoriteButton';
import { getTrendingWall } from '@/lib/tmdb/api';
import type { Locale } from '@/lib/tmdb/constants';
import { TmdbError } from '@/lib/tmdb/errors';
import type { MediaItem } from '@/lib/tmdb/types';

/**
 * Trending posters as a carousel, like the Home rows (wrap it in Suspense).
 * The page's only 3D scene is the hero (HeroStage): one WebGL context per page.
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
  const title = t('trendingWall');

  return (
    // Same pattern as MediaRow: the carousel region carries the title, so the
    // section stays unnamed (two nested regions with one name are noise).
    <section className="row-reveal">
      {/* h-7 header like MediaRow, so the wall lines up with the rows. */}
      <div className="mb-4 flex h-7 items-center">
        <h2 className="truncate text-xl font-bold">{title}</h2>
      </div>
      <MediaCarousel label={title}>
        {items.map((item) => (
          <MediaCard
            key={`${item.mediaType}-${item.id}`}
            item={item}
            sizes={CAROUSEL_POSTER_SIZES}
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
