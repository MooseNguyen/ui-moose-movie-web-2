import { SpeedInsights } from '@vercel/speed-insights/next';

/**
 * Real-user Web Vitals (LCP, INP, CLS…) per route, in the Vercel dashboard
 * (Speed Insights). Production deployment only:
 * - outside Vercel (local, E2E, Lighthouse CI) its script would 404;
 * - preview traffic would spend the quota and mix test visits into the data.
 *
 * A Server Component: VERCEL_ENV is read on the server (at build time for
 * static pages), so no NEXT_PUBLIC_ variable is needed.
 */
export function WebVitals() {
  if (process.env.VERCEL_ENV !== 'production') return null;
  return <SpeedInsights />;
}
