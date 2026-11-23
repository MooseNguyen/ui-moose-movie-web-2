import { hasLocale } from 'next-intl';
import type { AppLocale } from '@/i18n/routing';
import { routing } from '@/i18n/routing';
import {
  DetailCard,
  detailCardModel,
  fetchPoster,
  OG_CONTENT_TYPE,
  OG_SIZE,
  renderDefaultCard,
  renderOgImage,
} from '@/lib/og';
import { getPosterAmbient } from '@/lib/poster-color';
import { parseMediaType, parsePositiveId } from '@/lib/route-params';
import { SITE_NAME } from '@/lib/seo';
import { getDetail } from '@/lib/tmdb/api';
import type { MediaType } from '@/lib/tmdb/constants';

// Rendered on demand and cached by the CDN (Cache-Control in renderOgImage).
export const alt = SITE_NAME;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

type Params = { locale: string; mediaType: string; id: string };

async function loadCard(mediaType: MediaType, id: number, locale: AppLocale) {
  try {
    const detail = await getDetail(mediaType, id, locale);
    const [poster, ambient] = await Promise.all([
      fetchPoster(detail.posterPath),
      getPosterAmbient(detail.posterPath),
    ]);
    return {
      model: detailCardModel(detail, locale),
      poster,
      ambient,
      // A poster that exists but could not be loaded: keep this card briefly.
      degraded: detail.posterPath !== null && poster === null,
    };
  } catch (error) {
    console.error('[og] Detail card failed, using the site card:', error);
    return null;
  }
}

/**
 * Never fails: crawlers cache a broken preview for a long time, so a missing
 * or failing title falls back to the site card instead of an error.
 */
export default async function Image({ params }: { params: Promise<Params> }) {
  const { locale: rawLocale, mediaType: rawType, id: rawId } = await params;
  const locale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;
  const mediaType = parseMediaType(rawType);
  const id = parsePositiveId(rawId);

  const card =
    mediaType && id !== null ? await loadCard(mediaType, id, locale) : null;
  if (!card) return renderDefaultCard(locale, { degraded: true });
  const { degraded, ...props } = card;
  return renderOgImage(<DetailCard {...props} />, { degraded });
}
