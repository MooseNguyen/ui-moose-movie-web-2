import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { OG_CONTENT_TYPE, OG_SIZE, renderDefaultCard } from '@/lib/og';
import { SITE_NAME } from '@/lib/seo';

// Site-wide card: every page under [locale] without its own image uses it.
export const alt = SITE_NAME;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return renderDefaultCard(
    hasLocale(routing.locales, locale) ? locale : routing.defaultLocale
  );
}
