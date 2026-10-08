import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FavoritesView } from '@/features/favorites/FavoritesView';
import { routing } from '@/i18n/routing';

type FavoritesPageProps = PageProps<'/[locale]/favorites'>;

// FavoritesView moves focus here when a list empties. A plain string prop:
// constants exported from a client module are client references on the server.
const HEADING_ID = 'favorites-heading';

async function resolveLocale({ params }: FavoritesPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return locale;
}

export async function generateMetadata(
  props: FavoritesPageProps
): Promise<Metadata> {
  const locale = await resolveLocale(props);
  const t = await getTranslations({ locale, namespace: 'favorites' });
  return {
    title: t('title'),
    // A per-browser list (localStorage): nothing for search engines to index.
    robots: { index: false, follow: true },
  };
}

export default async function FavoritesPage(props: FavoritesPageProps) {
  const locale = await resolveLocale(props);
  const t = await getTranslations({ locale, namespace: 'favorites' });

  return (
    // pt-24: clears the fixed 4rem header.
    <div className="mx-auto max-w-7xl px-4 pt-24 pb-10">
      <h1
        id={HEADING_ID}
        tabIndex={-1}
        className="mb-6 text-3xl font-bold outline-none"
      >
        {t('heading')}
      </h1>
      <FavoritesView headingId={HEADING_ID} />
    </div>
  );
}
