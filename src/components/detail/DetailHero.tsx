import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import { Fragment, type ReactNode } from 'react';
import { TrailerButton } from '@/components/media/TrailerButton';
import { FavoriteButton } from '@/features/favorites/FavoriteButton';
import { Link } from '@/i18n/navigation';
import { tmdbImage } from '@/lib/images';
import type { MediaDetail } from '@/lib/tmdb/types';

const MAX_STUDIOS = 3;

export function DetailHero({ detail }: { detail: MediaDetail }) {
  const t = useTranslations('detail');
  const format = useFormatter();

  // TMDB dates are calendar dates ("YYYY-MM-DD", parsed as UTC midnight):
  // format them in UTC so a negative offset does not show the previous day.
  const date = detail.releaseDate ? new Date(detail.releaseDate) : null;
  const releaseDate =
    date && !Number.isNaN(date.getTime())
      ? format.dateTime(date, { dateStyle: 'long', timeZone: 'UTC' })
      : null;

  let runtime: string | null = null;
  if (detail.mediaType === 'movie' && detail.runtime) {
    const hours = Math.floor(detail.runtime / 60);
    const minutes = detail.runtime % 60;
    runtime =
      hours === 0
        ? t('runtimeMinutes', { minutes })
        : minutes === 0
          ? t('runtimeHours', { hours })
          : t('runtimeHoursMinutes', { hours, minutes });
  }

  const length =
    detail.mediaType === 'tv'
      ? [
          detail.seasons !== null && t('seasons', { count: detail.seasons }),
          detail.episodes !== null && t('episodes', { count: detail.episodes }),
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

  const studios = detail.companies.slice(0, MAX_STUDIOS).join(', ');

  const facts: [string, ReactNode][] = [];
  if (detail.originalTitle && detail.originalTitle !== detail.title) {
    facts.push([t('originalTitle'), detail.originalTitle]);
  }
  if (releaseDate) {
    facts.push([
      t(detail.mediaType === 'movie' ? 'releaseDate' : 'firstAirDate'),
      releaseDate,
    ]);
  }
  if (runtime) facts.push([t('runtime'), runtime]);
  if (length) facts.push([t('length'), length]);
  if (detail.voteCount > 0) {
    facts.push([
      t('rating'),
      <>
        <span aria-hidden="true">★ </span>
        <span>
          {t('ratingValue', {
            rating: format.number(detail.voteAverage, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
          })}
        </span>{' '}
        <span className="text-muted-foreground">
          ({t('votes', { count: detail.voteCount })})
        </span>
      </>,
    ]);
  }
  if (studios) facts.push([t('studios'), studios]);

  return (
    <div className="relative isolate overflow-hidden">
      {/* Decorative blurred backdrop; it extends behind the fixed header. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Image
          src={tmdbImage(detail.backdropPath, 'w1280', 'backdrop')}
          alt=""
          fill
          sizes="100vw"
          priority
          unoptimized={!detail.backdropPath}
          className="scale-110 object-cover opacity-40 blur-md"
        />
        <div className="from-background via-background/80 to-background/40 absolute inset-0 bg-gradient-to-t" />
      </div>

      {/* pt-24: clears the fixed 4rem header. */}
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-24 pb-10 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="bg-muted relative aspect-[2/3] w-44 overflow-hidden rounded-lg shadow-lg sm:w-56 md:w-full">
          <Image
            src={tmdbImage(detail.posterPath, 'w780')}
            alt=""
            fill
            sizes="(min-width: 1024px) 18rem, (min-width: 768px) 16rem, (min-width: 640px) 14rem, 11rem"
            priority
            unoptimized={!detail.posterPath}
            className="object-cover"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">{detail.title}</h1>
            {detail.tagline && (
              <p className="text-muted-foreground mt-2 text-lg italic">
                {detail.tagline}
              </p>
            )}
          </div>

          {detail.genres.length > 0 && (
            <ul aria-label={t('genres')} className="flex flex-wrap gap-2">
              {detail.genres.map((genre) => (
                <li key={genre.id}>
                  <Link
                    href={`/discover?type=${detail.mediaType}&genres=${genre.id}`}
                    className="bg-background/60 hover:bg-accent focus-visible:ring-ring inline-flex rounded-full border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-2"
                  >
                    {genre.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {detail.videos.length > 0 && (
              <TrailerButton
                mediaType={detail.mediaType}
                id={detail.id}
                title={detail.title}
              />
            )}
            <FavoriteButton
              item={{
                id: detail.id,
                mediaType: detail.mediaType,
                title: detail.title,
                posterPath: detail.posterPath,
                voteAverage: detail.voteAverage,
                year: detail.year,
              }}
            />
          </div>

          {detail.overview && (
            <div className="max-w-3xl">
              <p
                // A fallback overview is English text inside a Vietnamese page.
                lang={detail.overviewIsFallback ? 'en' : undefined}
                className="leading-relaxed"
              >
                {detail.overview}
              </p>
              {detail.overviewIsFallback && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {t('englishFallback')}
                </p>
              )}
            </div>
          )}

          {facts.length > 0 && (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
              {facts.map(([label, value]) => (
                <Fragment key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </Fragment>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
