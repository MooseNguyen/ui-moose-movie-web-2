import 'server-only';
import type { Metadata } from 'next';
import { routing, type AppLocale } from '@/i18n/routing';
import { getEnv } from '@/lib/env';
import { tmdbImage } from '@/lib/images';
import type { MediaDetail, PersonDetail } from '@/lib/tmdb/types';

export const SITE_NAME = 'Moose Movie';

const OG_LOCALES: Record<AppLocale, string> = { vi: 'vi_VN', en: 'en_US' };
const MAX_JSON_LD_ACTORS = 5;

export type SeoQuery = URLSearchParams | Record<string, string | undefined>;

export type SeoImage = { url: string; width?: number; height?: number };

type OgType = 'website' | 'video.movie' | 'video.tv_show' | 'profile';

export type BuildMetadataInput = {
  locale: AppLocale;
  /** Locale-less path: `''` for home, `/movie`, `/movie/550`. */
  path: string;
  /** Appended (sorted by key) to the canonical and every alternate. */
  query?: SeoQuery;
  title: string;
  description?: string;
  image?: SeoImage;
  type?: OgType;
  noIndex?: boolean;
};

type JsonLdObject = Record<string, unknown>;

/** The configured site origin without a trailing slash. */
export function siteUrl(): string {
  return getEnv().SITE_URL.replace(/\/+$/, '');
}

function toSearch(query: SeoQuery | undefined): string {
  if (!query) return '';
  const entries =
    query instanceof URLSearchParams ? [...query] : Object.entries(query);
  const params = new URLSearchParams(
    entries.filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
  // One URL per page whatever order the params arrived in.
  params.sort();
  const search = params.toString();
  return search ? `?${search}` : '';
}

export function absoluteUrl(
  locale: AppLocale,
  path: string,
  query?: SeoQuery
): string {
  return `${siteUrl()}/${locale}${path}${toSearch(query)}`;
}

/** Page metadata with canonical, hreflang alternates, Open Graph and Twitter. */
export function buildMetadata({
  locale,
  path,
  query,
  title,
  description,
  image,
  type = 'website',
  noIndex = false,
}: BuildMetadataInput): Metadata {
  const canonical = absoluteUrl(locale, path, query);
  const languages: Record<string, string> = Object.fromEntries(
    routing.locales.map((l) => [l, absoluteUrl(l, path, query)])
  );
  languages['x-default'] = absoluteUrl(routing.defaultLocale, path, query);
  const text = description === undefined ? { title } : { title, description };

  return {
    ...text,
    alternates: { canonical, languages },
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: OG_LOCALES[locale],
      url: canonical,
      ...text,
      ...(image && { images: [image] }),
    },
    twitter: image
      ? { card: 'summary_large_image', ...text, images: [image.url] }
      : { card: 'summary', ...text },
    ...(noIndex && { robots: { index: false, follow: true } }),
  };
}

/** Drops undefined, null, empty-string and empty-array values. */
function compact(data: JsonLdObject): JsonLdObject {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0)
    )
  );
}

export function movieJsonLd(detail: MediaDetail, url: string): JsonLdObject {
  const isTv = detail.mediaType === 'tv';
  return compact({
    '@context': 'https://schema.org',
    '@type': isTv ? 'TVSeries' : 'Movie',
    name: detail.title,
    url,
    image: detail.posterPath
      ? tmdbImage(detail.posterPath, 'w780', 'poster')
      : undefined,
    description: detail.overview.trim(),
    [isTv ? 'startDate' : 'datePublished']: detail.releaseDate,
    genre: detail.genres.map((genre) => genre.name),
    aggregateRating:
      detail.voteCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: Math.round(detail.voteAverage * 10) / 10,
            ratingCount: detail.voteCount,
            bestRating: 10,
          }
        : undefined,
    actor: detail.cast
      .slice(0, MAX_JSON_LD_ACTORS)
      .map((member) => ({ '@type': 'Person', name: member.name })),
  });
}

export function personJsonLd(person: PersonDetail, url: string): JsonLdObject {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    url,
    image: person.profilePath
      ? tmdbImage(person.profilePath, 'w780', 'profile')
      : undefined,
    birthDate: person.birthday,
    deathDate: person.deathday,
    birthPlace: person.placeOfBirth
      ? { '@type': 'Place', name: person.placeOfBirth }
      : undefined,
    jobTitle: person.knownForDepartment,
    description: person.biography.trim(),
  });
}
