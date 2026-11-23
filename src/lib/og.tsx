import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getTranslations } from 'next-intl/server';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import type { AppLocale } from '@/i18n/routing';
import { tmdbImage } from '@/lib/images';
import { oklchToHex } from '@/lib/oklch';
import type { Ambient } from '@/lib/poster-color';
import { SITE_NAME } from '@/lib/seo';
import { REVALIDATE } from '@/lib/tmdb/constants';
import type { MediaDetail } from '@/lib/tmdb/types';
import { truncate } from '@/lib/utils';

/** Open Graph card size recommended by Facebook, X and Zalo. */
export const OG_SIZE = { width: 1200, height: 630 };
/**
 * JPEG, not next/og's PNG: with a photographic poster the PNG weighs
 * 400–700 KB, over what some apps (e.g. WhatsApp, ~300 KB) still preview.
 */
export const OG_CONTENT_TYPE = 'image/jpeg';
const JPEG_QUALITY = 82;

const POSTER = { width: 360, height: 540 };
const TITLE_MAX_LENGTH = 70;
const MAX_GENRES = 3;
const POSTER_TIMEOUT_MS = 1500;

/** Dark card colors; the detail card tints the top with the poster's hue. */
const BACKGROUND = '#0a0a0a';
const FOREGROUND = '#fafafa';
const MUTED = '#a3a3a3';
const ACCENT = '#f59e0b';
const TINT_LIGHTNESS = 0.3;

// The default font of next/og has no Vietnamese glyphs: titles would render
// as boxes. Be Vietnam Pro is the site font (src/app/[locale]/layout.tsx).
const FONT_DIR = join(process.cwd(), 'src', 'app', 'fonts');
let fonts: Promise<ConstructorParameters<typeof ImageResponse>[1]> | null =
  null;

function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(FONT_DIR, 'BeVietnamPro-Regular.ttf')),
    readFile(join(FONT_DIR, 'BeVietnamPro-Bold.ttf')),
  ]).then(([regular, bold]) => ({
    ...OG_SIZE,
    fonts: [
      { name: 'Be Vietnam Pro', data: regular, weight: 400, style: 'normal' },
      { name: 'Be Vietnam Pro', data: bold, weight: 700, style: 'normal' },
    ],
  }));
  return fonts;
}

// The image routes render on demand, so the CDN does the caching. A card
// degraded by a failure (no poster, site card instead of the title) is kept
// briefly so the next crawl can get the full one.
const CACHE_CONTROL = {
  full: 'public, s-maxage=86400, stale-while-revalidate=604800',
  degraded: 'public, s-maxage=300',
};

export async function renderOgImage(
  element: React.ReactElement,
  { degraded = false }: { degraded?: boolean } = {}
) {
  const png = await new ImageResponse(element, await loadFonts()).arrayBuffer();
  const jpeg = await sharp(Buffer.from(png))
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      'Content-Type': OG_CONTENT_TYPE,
      'Cache-Control': CACHE_CONTROL[degraded ? 'degraded' : 'full'],
    },
  });
}

/** The site card: brand, tagline and the home description. */
export async function renderDefaultCard(
  locale: AppLocale,
  options?: { degraded?: boolean }
) {
  const [og, home] = await Promise.all([
    getTranslations({ locale, namespace: 'og' }),
    getTranslations({ locale, namespace: 'home' }),
  ]);
  return renderOgImage(
    <DefaultCard
      heading={og('tagline')}
      description={home('metaDescription')}
    />,
    options
  );
}

export type DetailCardModel = {
  title: string;
  /** "1999 · Drama · Thriller"; empty when nothing is known. */
  meta: string;
  /** "8.4" (locale-formatted) or null without votes. */
  rating: string | null;
};

const NUMBER_LOCALES: Record<AppLocale, string> = { vi: 'vi-VN', en: 'en-US' };

export function detailCardModel(
  detail: Pick<
    MediaDetail,
    'title' | 'year' | 'genres' | 'voteAverage' | 'voteCount'
  >,
  locale: AppLocale
): DetailCardModel {
  const meta = [
    detail.year,
    ...detail.genres.slice(0, MAX_GENRES).map((genre) => genre.name),
  ]
    .filter(Boolean)
    .join(' · ');
  const rating =
    detail.voteCount > 0
      ? new Intl.NumberFormat(NUMBER_LOCALES[locale], {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }).format(detail.voteAverage)
      : null;
  return { title: truncate(detail.title, TITLE_MAX_LENGTH), meta, rating };
}

/**
 * The poster as a data URL, or null. Fetched here rather than by next/og so
 * a slow or failing image yields a text-only card instead of a failed
 * response, which crawlers would cache as a broken preview.
 */
export async function fetchPoster(
  posterPath: string | null,
  timeoutMs = POSTER_TIMEOUT_MS
): Promise<string | null> {
  if (!posterPath) return null;
  try {
    // Shown at 360 px: w342 would be upscaled. Server-side only, so the
    // larger file costs no visitor bandwidth.
    const response = await fetch(tmdbImage(posterPath, 'w780'), {
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: REVALIDATE.detail },
    } as RequestInit);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get('content-type') ?? 'image/jpeg';
    if (!type.startsWith('image/')) throw new Error(`Unexpected ${type}`);
    const data = Buffer.from(await response.arrayBuffer()).toString('base64');
    return `data:${type};base64,${data}`;
  } catch (error) {
    console.error('[og] Poster unavailable, rendering text only:', error);
    return null;
  }
}

function tint(ambient: Ambient | null) {
  if (!ambient) return BACKGROUND;
  return oklchToHex({
    l: TINT_LIGHTNESS,
    c: ambient.chroma,
    h: ambient.hue,
  });
}

function Brand() {
  return (
    <div
      style={{
        display: 'flex',
        fontSize: 30,
        fontWeight: 700,
        color: ACCENT,
        letterSpacing: -0.5,
      }}
    >
      {SITE_NAME}
    </div>
  );
}

export function DetailCard({
  model,
  poster,
  ambient,
}: {
  model: DetailCardModel;
  poster: string | null;
  ambient: Ambient | null;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 56,
        padding: '45px 64px',
        backgroundColor: BACKGROUND,
        backgroundImage: `linear-gradient(160deg, ${tint(ambient)} 0%, ${BACKGROUND} 75%)`,
        color: FOREGROUND,
        fontFamily: 'Be Vietnam Pro',
      }}
    >
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>.
        <img
          src={poster}
          alt=""
          width={POSTER.width}
          height={POSTER.height}
          style={{ borderRadius: 20, objectFit: 'cover' }}
        />
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          height: '100%',
          justifyContent: 'space-between',
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        <Brand />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              fontSize: model.title.length > 40 ? 54 : 68,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: -1,
            }}
          >
            {model.title}
          </div>
          {model.meta && (
            <div style={{ display: 'flex', fontSize: 30, color: MUTED }}>
              {model.meta}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', height: 48, alignItems: 'center' }}>
          {model.rating && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 40,
                fontWeight: 700,
              }}
            >
              {/* SVG, not "★": Be Vietnam Pro has no star glyph. */}
              <svg width="36" height="36" viewBox="0 0 24 24" fill={ACCENT}>
                <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z" />
              </svg>
              <span>{model.rating}</span>
              <span style={{ fontSize: 28, fontWeight: 400, color: MUTED }}>
                / 10
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DefaultCard({
  heading,
  description,
}: {
  heading: string;
  description: string;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 28,
        padding: '0 96px',
        backgroundColor: BACKGROUND,
        backgroundImage: `linear-gradient(160deg, #3a2a00 0%, ${BACKGROUND} 70%)`,
        color: FOREGROUND,
        fontFamily: 'Be Vietnam Pro',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 96,
          fontWeight: 700,
          color: ACCENT,
          letterSpacing: -2,
        }}
      >
        {SITE_NAME}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 44,
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {heading}
      </div>
      <div
        style={{ display: 'flex', fontSize: 30, color: MUTED, lineHeight: 1.4 }}
      >
        {description}
      </div>
    </div>
  );
}
