import { parseEnv } from './env';

/**
 * Fails `next build` early when the env is unusable. Without a token the
 * build would otherwise succeed and bake TMDB error rows into the ISR Home
 * page; a bad NEXT_PUBLIC_SITE_URL would break canonical and sitemap URLs.
 */
export function assertBuildEnv(source: Record<string, string | undefined>) {
  const result = parseEnv(source);
  if (result.ok) return;
  throw new Error(
    [
      'Invalid environment for the production build:',
      ...result.issues.map((issue) => `  - ${issue}`),
      'Set the variables in .env.local (see .env.example) or the CI/Vercel environment.',
    ].join('\n')
  );
}
