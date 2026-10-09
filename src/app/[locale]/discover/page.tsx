import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { LoadMoreGrid } from '@/components/media/LoadMoreGrid';
import { Skeleton } from '@/components/ui/skeleton';
import { DiscoverFilters } from '@/features/discover/DiscoverFilters';
import {
  DEFAULT_DISCOVER,
  parseDiscoverParams,
  serializeDiscoverParams,
  type DiscoverParams,
} from '@/features/discover/params';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { loadMoreDiscover } from '@/lib/actions/media';
import { buildMetadata } from '@/lib/seo';
import { discover, getGenres } from '@/lib/tmdb/api';
import type { Locale, MediaType } from '@/lib/tmdb/constants';
import { TmdbError } from '@/lib/tmdb/errors';
import type { Genre, MediaItem, Paginated } from '@/lib/tmdb/types';

type DiscoverPageProps = PageProps<'/[locale]/discover'>;

async function resolveParams({ params, searchParams }: DiscoverPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Next has already decoded the URL (`genres=12%2C28` arrives as "12,28").
  // One clock for the URL validation and the year options in the filters.
  const now = new Date();
  return {
    locale,
    value: parseDiscoverParams(await searchParams, now),
    currentYear: now.getFullYear(),
  };
}

/** Back to a query object for object hrefs (next-intl encodes it). */
const toQuery = (serialized: string) =>
  Object.fromEntries(new URLSearchParams(serialized));

export async function generateMetadata(
  props: DiscoverPageProps
): Promise<Metadata> {
  const { locale, value } = await resolveParams(props);
  const t = await getTranslations({ locale, namespace: 'discover' });
  // Only the unfiltered movie and tv views are indexed; every filter
  // combination is a near-duplicate of them (noindex, links still followed).
  const filtered =
    value.genres.length > 0 ||
    value.year !== null ||
    value.sort !== DEFAULT_DISCOVER.sort;
  return buildMetadata({
    locale,
    path: '/discover',
    // Normalized: unknown params dropped, `type=movie` omitted.
    query: new URLSearchParams(serializeDiscoverParams(value)),
    title: t(`title.${value.type}`),
    description: t(`description.${value.type}`),
    noIndex: filtered,
  });
}

async function loadGenres(
  type: MediaType,
  locale: Locale
): Promise<Genre[] | null> {
  // Genres are optional: without them the page still filters by type, year
  // and sort, so a failure must not take the whole page down.
  try {
    return await getGenres(type, locale);
  } catch (error) {
    // tmdbFetch already logged TmdbErrors; log only unexpected ones.
    if (!(error instanceof TmdbError)) console.error('[genres]', type, error);
    return null;
  }
}

export default async function DiscoverPage(props: DiscoverPageProps) {
  const { locale, value: parsed, currentYear } = await resolveParams(props);
  const t = await getTranslations({ locale, namespace: 'discover' });
  const tCommon = await getTranslations({ locale, namespace: 'common' });
  const genres = await loadGenres(parsed.type, locale);

  // Drop stale or hand-typed ids TMDB does not know for this type, so the
  // filters, the results and load more all agree on one query. Without the
  // genre list there is nothing to check against, so ids are kept.
  const known = genres && new Set(genres.map((g) => g.id));
  const value: DiscoverParams = known
    ? { ...parsed, genres: parsed.genres.filter((id) => known.has(id)) }
    : parsed;
  const query = serializeDiscoverParams(value);

  return (
    // pt-24: clears the fixed 4rem header.
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-10">
      <h1 className="text-3xl font-bold">{t(`title.${value.type}`)}</h1>
      <div className="mt-6 mb-8">
        <DiscoverFilters
          value={value}
          genres={genres ?? []}
          currentYear={currentYear}
        />
        {genres === null && (
          <p className="text-muted-foreground mt-3 text-sm">
            {t('genresError')}
          </p>
        )}
      </div>
      {/* No loading.tsx on purpose: a route-level loading boundary would
          replace the filters on every navigation and lose the focus on the
          chip just pressed. Only the results suspend; the key makes every new
          query show the skeleton instead of the stale grid. */}
      <Suspense
        key={query}
        fallback={<ResultsSkeleton label={tCommon('loading')} />}
      >
        <DiscoverResults value={value} query={query} locale={locale} />
      </Suspense>
    </div>
  );
}

async function DiscoverResults({
  value,
  query,
  locale,
}: {
  value: DiscoverParams;
  query: string;
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: 'discover' });
  const tErrors = await getTranslations({ locale, namespace: 'errors' });

  // A thrown error would replace the whole page with the error boundary; the
  // filters stay usable instead, like the list page.
  let initial: Paginated<MediaItem> | null;
  try {
    initial = await discover(value, 1, locale);
  } catch (error) {
    if (!(error instanceof TmdbError)) {
      console.error('[discover]', query, error);
    }
    initial = null;
  }

  if (initial?.items.length) {
    return (
      <LoadMoreGrid
        key={query}
        initial={initial}
        loadMore={loadMoreDiscover.bind(null, { query, locale })}
      />
    );
  }

  const linkClass =
    'text-foreground focus-visible:ring-ring rounded-sm font-medium underline outline-none focus-visible:ring-2';

  return (
    <div
      role="status"
      className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border p-6 text-sm"
    >
      {initial ? (
        <>
          <p>{t('empty')}</p>
          {query && (
            <Link href="/discover" className={linkClass}>
              {t('clear')}
            </Link>
          )}
        </>
      ) : (
        <>
          <p>{t('loadError')}</p>
          <Link
            href={{ pathname: '/discover', query: toQuery(query) }}
            className={linkClass}
          >
            {tErrors('retry')}
          </Link>
        </>
      )}
    </div>
  );
}

/** Mirrors the MediaGrid columns (see the list loading.tsx) to avoid layout shift. */
function ResultsSkeleton({ label }: { label: string }) {
  return (
    <div role="status">
      <ul
        aria-hidden="true"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <li key={i}>
            <Skeleton className="aspect-[2/3] w-full rounded-lg" />
            <Skeleton className="mt-2 h-5 w-3/4" />
            <Skeleton className="mt-0.5 h-4 w-1/3" />
          </li>
        ))}
      </ul>
      <span className="sr-only">{label}</span>
    </div>
  );
}
