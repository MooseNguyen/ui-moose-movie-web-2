import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { CastList } from '@/components/detail/CastList';
import { DetailHero } from '@/components/detail/DetailHero';
import { JsonLd } from '@/components/JsonLd';
import { VideoList } from '@/components/detail/VideoList';
import { MediaCard } from '@/components/media/MediaCard';
import { MediaCarousel } from '@/components/media/MediaCarousel';
import { FavoriteButton } from '@/features/favorites/FavoriteButton';
import { routing } from '@/i18n/routing';
import { tmdbImage } from '@/lib/images';
import { parseMediaType, parsePositiveId } from '@/lib/route-params';
import { absoluteUrl, buildMetadata, movieJsonLd } from '@/lib/seo';
import { truncate } from '@/lib/utils';
import { getDetail } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';

type DetailPageProps = PageProps<'/[locale]/[mediaType]/[id]'>;

const META_DESCRIPTION_LENGTH = 160;

// Request-scoped memo: generateMetadata and the page share one TMDB call.
const getDetailCached = cache(getDetail);

// No loading.tsx at or above this segment: existence is resolved (and
// notFound() thrown) before anything streams, so a missing title is a real
// HTTP 404 instead of a streamed soft 404 with status 200.
async function loadDetail({ params }: DetailPageProps) {
  const { locale, mediaType: rawMediaType, id: rawId } = await params;
  const mediaType = parseMediaType(rawMediaType);
  const id = parsePositiveId(rawId);
  if (!hasLocale(routing.locales, locale) || !mediaType || id === null) {
    notFound();
  }
  try {
    return {
      locale,
      path: `/${mediaType}/${id}`,
      detail: await getDetailCached(mediaType, id, locale),
    };
  } catch (error) {
    if (error instanceof TmdbError && error.kind === 'not_found') notFound();
    // Anything else is a real failure for error.tsx (never cache it as a 404).
    throw error;
  }
}

// Nothing is prerendered at build time; titles render on first request and
// are then cached like the detail fetch (REVALIDATE.detail).
export function generateStaticParams() {
  return [];
}

export async function generateMetadata(
  props: DetailPageProps
): Promise<Metadata> {
  const { locale, path, detail } = await loadDetail(props);
  const t = await getTranslations({ locale, namespace: 'detail' });
  const title = detail.title;
  const description = detail.overview.trim()
    ? truncate(detail.overview, META_DESCRIPTION_LENGTH)
    : t('metaDescription', { title });

  return buildMetadata({
    locale,
    path,
    title,
    description,
    type: detail.mediaType === 'tv' ? 'video.tv_show' : 'video.movie',
    image: detail.backdropPath
      ? {
          url: tmdbImage(detail.backdropPath, 'w1280', 'backdrop'),
          width: 1280,
          height: 720,
        }
      : undefined,
  });
}

export default async function DetailPage(props: DetailPageProps) {
  const { locale, path, detail } = await loadDetail(props);
  const t = await getTranslations({ locale, namespace: 'detail' });

  return (
    <div className="pb-10">
      <JsonLd data={movieJsonLd(detail, absoluteUrl(locale, path))} />
      <DetailHero detail={detail} />
      {/* Block layout (space-y), not flex: flex items default to min-width:auto and the carousels would overflow. */}
      <div className="mx-auto max-w-7xl space-y-12 px-4">
        <CastList cast={detail.cast} />
        <VideoList videos={detail.videos} />
        {detail.related.length > 0 && (
          // No aria-labelledby: the carousel region inside already carries the name.
          <section>
            <h2 className="mb-4 text-xl font-bold">{t('related')}</h2>
            <MediaCarousel label={t('related')}>
              {detail.related.map((item) => (
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
        )}
      </div>
    </div>
  );
}
