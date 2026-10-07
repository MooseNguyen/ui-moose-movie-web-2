import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { TMDB_WIDTHS } from './src/lib/tmdb-image-loader';

const withNextIntl = createNextIntlPlugin();

// Widths at or above the smallest card width go to deviceSizes (used for `vw`
// sizes and fill images); the rest to imageSizes. Together they are exactly
// TMDB's widths, so the loader never rounds two srcset entries to one file.
const DEVICE_SIZE_MIN = 780;

const nextConfig: NextConfig = {
  images: {
    // No optimization server: TMDB hosts the resized copies itself.
    loader: 'custom',
    loaderFile: './src/lib/tmdb-image-loader.ts',
    deviceSizes: TMDB_WIDTHS.filter((w) => w >= DEVICE_SIZE_MIN),
    imageSizes: TMDB_WIDTHS.filter((w) => w < DEVICE_SIZE_MIN),
  },
};

export default withNextIntl(nextConfig);
