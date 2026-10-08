import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ListTabs } from '@/components/media/ListTabs';
import { LoadMoreGrid } from '@/components/media/LoadMoreGrid';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { loadMoreList } from '@/lib/actions/media';
import { parseListName, parseMediaType } from '@/lib/route-params';
import { getList } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
import type { Paginated, MediaItem } from '@/lib/tmdb/types';

type ListPageProps = PageProps<'/[locale]/[mediaType]'>;

async function resolveParams({ params, searchParams }: ListPageProps) {
  const { locale, mediaType: rawMediaType } = await params;
  const mediaType = parseMediaType(rawMediaType);
  if (!hasLocale(routing.locales, locale) || !mediaType) notFound();
  const list = parseListName(mediaType, (await searchParams).list);
  return { locale, mediaType, list };
}

export async function generateMetadata(
  props: ListPageProps
): Promise<Metadata> {
  const { locale, mediaType, list } = await resolveParams(props);
  const t = await getTranslations({ locale, namespace: 'list' });
  const title = t(`titles.${mediaType}.${list}`);
  return { title, description: t('metaDescription', { title }) };
}

export default async function ListPage(props: ListPageProps) {
  const { locale, mediaType, list } = await resolveParams(props);
  const t = await getTranslations({ locale, namespace: 'list' });
  const tErrors = await getTranslations({ locale, namespace: 'errors' });

  // A thrown error would surface as the generic error page; the shell (title,
  // tabs) stays usable instead, like the Home rows.
  let initial: Paginated<MediaItem> | null;
  try {
    initial = await getList(mediaType, list, 1, locale);
  } catch (error) {
    // tmdbFetch already logged TmdbErrors; log only unexpected ones.
    if (!(error instanceof TmdbError)) {
      console.error('[list]', mediaType, list, error);
    }
    initial = null;
  }

  return (
    // pt-24: clears the fixed 4rem header.
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-10">
      <h1 className="text-3xl font-bold">{t(`heading.${mediaType}`)}</h1>
      <div className="mt-6 mb-8">
        <ListTabs mediaType={mediaType} active={list} />
      </div>
      {initial?.items.length ? (
        <LoadMoreGrid
          key={list}
          initial={initial}
          loadMore={loadMoreList.bind(null, { mediaType, list, locale })}
        />
      ) : initial ? (
        <p
          role="status"
          className="text-muted-foreground rounded-lg border p-6 text-sm"
        >
          {t('empty')}
        </p>
      ) : (
        <div
          role="status"
          className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border p-6 text-sm"
        >
          <p>{t('loadError', { title: t(`titles.${mediaType}.${list}`) })}</p>
          <Link
            href={`/${mediaType}?list=${list}`}
            className="text-foreground focus-visible:ring-ring rounded-sm font-medium underline outline-none focus-visible:ring-2"
          >
            {tErrors('retry')}
          </Link>
        </div>
      )}
    </div>
  );
}
