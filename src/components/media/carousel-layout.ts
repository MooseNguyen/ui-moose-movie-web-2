// Card carousel layout, shared by MediaCarousel (columns) and the Server
// Components that render its cards (poster `sizes`). It lives outside
// MediaCarousel.tsx because that is a 'use client' module: a constant
// imported from it into a Server Component is a client reference, not a string.

/** Slide width per breakpoint: 2 / 3 / 4 / 5 / 6 cards. */
export const CAROUSEL_ITEM_CLASS =
  'basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6';

/**
 * Rendered poster width for CAROUSEL_ITEM_CLASS inside a `max-w-7xl px-4`
 * page container. With C = min(100vw, 1280px) - 32px (container padding) and
 * n cards, a slide is (C - P + 16 - 4) / n - 16 px: -ml-4 on the track adds
 * 16px, its pr-1 takes 4px, each slide's pl-4 takes 16px, and P is the
 * carousel's own md:px-12 (0 below md, 96px from md). Constants are rounded
 * up so the poster is never under-sized. Change together with
 * CAROUSEL_ITEM_CLASS and MediaCarousel's padding.
 */
export const CAROUSEL_POSTER_SIZES =
  '(min-width: 1280px) 178px, (min-width: 1024px) calc(20vw - 39px), (min-width: 768px) calc(25vw - 45px), (min-width: 640px) calc(33.34vw - 22px), calc(50vw - 26px)';
