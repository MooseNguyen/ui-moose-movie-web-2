import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { absoluteUrl } from '@/lib/seo';
import { getPopularIds } from '@/lib/tmdb/api';
import type { MediaType } from '@/lib/tmdb/constants';
import { TmdbError } from '@/lib/tmdb/errors';

// Daily, like the detail cache (REVALIDATE.detail); must be a literal here.
export const revalidate = 86400;

const STATIC_PATHS = ['', '/movie', '/tv', '/discover'];
const MEDIA_TYPES: MediaType[] = ['movie', 'tv'];

// The sitemap is generated at build time: a TMDB failure must never fail the
// build, so that type's titles are simply left out until the next revalidation.
async function loadIds(mediaType: MediaType): Promise<number[]> {
  try {
    return await getPopularIds(mediaType);
  } catch (error) {
    // tmdbFetch already logged TmdbErrors; log only unexpected ones.
    if (!(error instanceof TmdbError)) {
      console.error('[sitemap]', mediaType, error);
    }
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const idsByType = await Promise.all(MEDIA_TYPES.map(loadIds));
  const paths = [
    ...STATIC_PATHS,
    ...MEDIA_TYPES.flatMap((mediaType, i) =>
      idsByType[i].map((id) => `/${mediaType}/${id}`)
    ),
  ];

  return paths.flatMap((path) => {
    const languages = Object.fromEntries(
      routing.locales.map((locale) => [locale, absoluteUrl(locale, path)])
    );
    return routing.locales.map((locale) => ({
      url: absoluteUrl(locale, path),
      alternates: { languages },
    }));
  });
}
