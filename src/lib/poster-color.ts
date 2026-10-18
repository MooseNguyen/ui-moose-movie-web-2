import 'server-only';
import sharp from 'sharp';
import { tmdbImage } from '@/lib/images';
import { REVALIDATE } from '@/lib/tmdb/constants';
import { oklchToHex, rgbToOklch } from './oklch';

/**
 * Hue and chroma of a poster's dominant color, for the Detail ambient tint.
 * Lightness is deliberately absent: CSS sets it per theme (globals.css), so
 * text contrast never depends on the poster.
 */
export type Ambient = {
  hue: number;
  chroma: number;
  /** For `<meta name="theme-color">` (dark theme: the default). */
  themeColor: string;
};

/** Caps loud posters to a tint, not a paint job. */
export const AMBIENT_MAX_CHROMA = 0.12;

/** Lightness of the theme color: the top of the dark hero. */
const THEME_COLOR_LIGHTNESS = 0.25;

/**
 * The tint is decoration: a slow image must not hold the page back, and any
 * failure renders the page without a tint.
 */
const DEFAULT_TIMEOUT_MS = 1000;

const round = (value: number, digits: number) => Number(value.toFixed(digits));

const SAMPLE_WIDTH = 24;
const SAMPLE_HEIGHT = 36;

// Near-black and near-white pixels carry no usable hue.
const MIN_LIGHTNESS = 0.15;
const MAX_LIGHTNESS = 0.95;

/**
 * The poster's characteristic color, from raw RGB pixels.
 *
 * Neither the dominant color (most posters: a black or white background)
 * nor the plain average (a muddy brown) works. Instead, each pixel's OKLab
 * a/b vector is averaged with its chroma as the weight, skipping near-black
 * and near-white pixels: colorful areas decide the hue. Opposite hues cancel
 * out, so a poster with no clear color gets a low chroma, i.e. a faint tint.
 */
export function vibrantColor(pixels: ArrayLike<number>): {
  c: number;
  h: number;
} {
  let sumA = 0;
  let sumB = 0;
  let weights = 0;
  for (let i = 0; i + 2 < pixels.length; i += 3) {
    const { l, c, h } = rgbToOklch(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (l < MIN_LIGHTNESS || l > MAX_LIGHTNESS || c === 0) continue;
    const rad = (h * Math.PI) / 180;
    sumA += c * c * Math.cos(rad);
    sumB += c * c * Math.sin(rad);
    weights += c;
  }
  if (weights === 0) return { c: 0, h: 0 };
  const a = sumA / weights;
  const b = sumB / weights;
  return {
    c: Math.hypot(a, b),
    h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  };
}

export async function getPosterAmbient(
  posterPath: string | null,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {}
): Promise<Ambient | null> {
  if (!posterPath) return null;
  try {
    // The smallest poster is plenty for one color; cached like the detail.
    const response = await fetch(tmdbImage(posterPath, 'w185'), {
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: REVALIDATE.detail },
    } as RequestInit);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const image = Buffer.from(await response.arrayBuffer());
    // A few hundred pixels are enough for a hue and keep this ~1 ms.
    const pixels = await sharp(image)
      .resize(SAMPLE_WIDTH, SAMPLE_HEIGHT, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();

    const { c, h } = vibrantColor(pixels);
    const chroma = Math.min(c, AMBIENT_MAX_CHROMA);
    return {
      hue: round(h, 1),
      chroma: round(chroma, 3),
      themeColor: oklchToHex({ l: THEME_COLOR_LIGHTNESS, c: chroma, h }),
    };
  } catch (error) {
    console.error('[poster-color]', posterPath, error);
    return null;
  }
}
