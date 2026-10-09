import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { siteUrl } from '@/lib/seo';

// Search results are endless and user-generated, so crawlers skip them
// entirely. Favorites is not blocked: it carries a `noindex` meta, which
// crawlers can only see when they are allowed to fetch the page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: routing.locales.map((locale) => `/${locale}/search`),
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
