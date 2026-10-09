import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ErrorBoundary } from '@/components/media/ErrorBoundary';
import { HeroSlider } from '@/components/media/HeroSlider';
import { MediaRow } from '@/components/media/MediaRow';
import { MediaRowSkeleton } from '@/components/media/MediaRowSkeleton';
import { routing } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo';
import { getTrending } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
import type { Locale } from '@/lib/tmdb/constants';
import type { MediaItem } from '@/lib/tmdb/types';

// Same as the TMDB list cache (REVALIDATE.list); must be a literal here.
export const revalidate = 3600;

const ROWS = [
  { titleKey: 'popularMovies', mediaType: 'movie', list: 'popular' },
  { titleKey: 'topRatedMovies', mediaType: 'movie', list: 'top_rated' },
  { titleKey: 'upcomingMovies', mediaType: 'movie', list: 'upcoming' },
  { titleKey: 'popularTv', mediaType: 'tv', list: 'popular' },
  { titleKey: 'topRatedTv', mediaType: 'tv', list: 'top_rated' },
  { titleKey: 'onTheAirTv', mediaType: 'tv', list: 'on_the_air' },
] as const;

// Home is prerendered (ISR): a thrown Server Component error would fail the
// whole prerender/revalidation, so data failures become empty or error UI
// that is cached until the next revalidation (≤ 1h). Without trending the
// page simply renders without the hero.
async function getHeroItems(locale: Locale): Promise<MediaItem[]> {
  try {
    return await getTrending(locale);
  } catch (error) {
    // tmdbFetch already logged TmdbErrors; log only unexpected ones.
    if (!(error instanceof TmdbError)) {
      console.error('[home]', 'trending', error);
    }
    return [];
  }
}

async function getLocale(params: PageProps<'/[locale]'>['params']) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]'>): Promise<Metadata> {
  const locale = await getLocale(params);
  const t = await getTranslations({ locale, namespace: 'home' });
  return buildMetadata({
    locale,
    path: '',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const locale = await getLocale(params);
  const [t, trending] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getHeroItems(locale),
  ]);

  return (
    <>
      <h1 className="sr-only">{t('heading')}</h1>
      {/* Full-bleed, under the transparent fixed header. */}
      <HeroSlider items={trending} />
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10">
        {ROWS.map(({ titleKey, mediaType, list }) => {
          const title = t(`rows.${titleKey}`);
          const errorId = `row-error-${mediaType}-${list}`;
          return (
            // MediaRow renders its own data-error state. The boundary is only a
            // client-side safety net (e.g. a carousel crashing after hydration).
            <ErrorBoundary
              key={`${mediaType}-${list}`}
              fallback={
                <section aria-labelledby={errorId}>
                  <h2 id={errorId} className="mb-4 text-xl font-bold">
                    {title}
                  </h2>
                  <p className="text-muted-foreground rounded-lg border p-6 text-sm">
                    {t('rowError', { title })}
                  </p>
                </section>
              }
            >
              <Suspense fallback={<MediaRowSkeleton />}>
                <MediaRow
                  title={title}
                  mediaType={mediaType}
                  list={list}
                  locale={locale}
                />
              </Suspense>
            </ErrorBoundary>
          );
        })}
      </div>
    </>
  );
}
