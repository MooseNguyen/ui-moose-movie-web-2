import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  // No hreflang `Link` header from the middleware: it uses the request host
  // and an unprefixed x-default. The HTML alternates (lib/seo) are the single
  // source of truth.
  alternateLinks: false,
});

export type AppLocale = (typeof routing.locales)[number];
