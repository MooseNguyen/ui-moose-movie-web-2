import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LinkTabs } from '@/components/media/LinkTabs';
import { LoadMoreGrid } from '@/components/media/LoadMoreGrid';
import { SearchBox } from '@/components/media/SearchBox';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { loadMoreSearch } from '@/lib/actions/media';
import { parseSearchQuery, parseSearchType } from '@/lib/route-params';
import { buildMetadata } from '@/lib/seo';
import { search } from '@/lib/tmdb/api';
import {
  SEARCH_TYPES,
  type Locale,
  type SearchType,
} from '@/lib/tmdb/constants';
import { TmdbError } from '@/lib/tmdb/errors';
import type { GridItem, Paginated } from '@/lib/tmdb/types';

type SearchPageProps = PageProps<'/[locale]/search'>;

async function resolveParams({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const query = await searchParams;
  // Next has already decoded the URL: `q` is the exact string the user typed.
  return {
    locale,
    q: parseSearchQuery(query.q),
    type: parseSearchType(query.type),
  };
}

export async function generateMetadata(
  props: SearchPageProps
): Promise<Metadata> {
  const { locale, q, type } = await resolveParams(props);
  const t = await getTranslations({ locale, namespace: 'search' });
  return buildMetadata({
    locale,
    path: '/search',
    query: q ? { q, type: type === 'multi' ? undefined : type } : undefined,
    title: q ? t('titleWithQuery', { query: q }) : t('title'),
    // Result pages are endless, thin and user-generated: keep them out of
    // the index, but let crawlers follow the links to real titles.
    noIndex: true,
  });
}

async function loadFirstPage(
  type: SearchType,
  q: string,
  locale: Locale
): Promise<Paginated<GridItem> | null> {
  // Like the list page: a thrown error would replace the whole page with the
  // error boundary; the title, search box and tabs stay usable instead.
  try {
    return await search(type, q, 1, locale);
  } catch (error) {
    // tmdbFetch already logged TmdbErrors; log only unexpected ones.
    if (!(error instanceof TmdbError)) console.error('[search]', type, error);
    return null;
  }
}

export default async function SearchPage(props: SearchPageProps) {
  const { locale, q, type } = await resolveParams(props);
  const t = await getTranslations({ locale, namespace: 'search' });
  const tErrors = await getTranslations({ locale, namespace: 'errors' });
  // No keyword, no TMDB call.
  const initial = q === null ? null : await loadFirstPage(type, q, locale);

  return (
    // pt-24: clears the fixed 4rem header.
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-10">
      <h1 className="text-3xl font-bold">{t('heading')}</h1>
      <div className="mt-6 max-w-xl">
        {/* key: a new URL query remounts the uncontrolled input with it. */}
        <SearchBox key={q ?? ''} defaultValue={q ?? ''} type={type} />
      </div>
      {q === null ? (
        <p className="text-muted-foreground mt-8">{t('prompt')}</p>
      ) : (
        <>
          <div className="mt-6 mb-8">
            <LinkTabs
              label={t('tabsLabel')}
              items={SEARCH_TYPES.map((tab) => ({
                key: tab,
                // Object href: next-intl encodes the query.
                href: { pathname: '/search', query: { q, type: tab } },
                label: t(`tabs.${tab}`),
                active: tab === type,
              }))}
            />
          </div>
          {initial?.items.length ? (
            <LoadMoreGrid
              key={`${type}:${q}`}
              initial={initial}
              loadMore={loadMoreSearch.bind(null, { type, q, locale })}
            />
          ) : initial ? (
            <p
              role="status"
              className="text-muted-foreground rounded-lg border p-6 text-sm"
            >
              {t('empty', { query: q })}
            </p>
          ) : (
            <div
              role="status"
              className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border p-6 text-sm"
            >
              <p>{t('loadError')}</p>
              <Link
                href={{ pathname: '/search', query: { q, type } }}
                className="text-foreground focus-visible:ring-ring rounded-sm font-medium underline outline-none focus-visible:ring-2"
              >
                {tErrors('retry')}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
