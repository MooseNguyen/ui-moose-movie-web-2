import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { parseEnv } from './env';

type EnvSource = Record<string, string | undefined>;

/**
 * Whether next.config should run `assertBuildEnv`.
 *
 * The phase alone is not enough: `next typegen` (run by `pnpm typecheck`,
 * also in CI without the token) loads the config with
 * PHASE_PRODUCTION_BUILD too. Only the `next build` CLI command, i.e. the
 * first positional argument after the script, should fail fast.
 */
export function shouldAssertBuildEnv(phase: string, argv: readonly string[]) {
  if (phase !== PHASE_PRODUCTION_BUILD) return false;
  const command = argv.slice(2).find((arg) => !arg.startsWith('-'));
  return command === 'build';
}

/**
 * Fails `next build` early when the env is unusable. Without a token the
 * build would otherwise succeed and bake TMDB error rows into the ISR Home
 * page; a bad NEXT_PUBLIC_SITE_URL would break canonical and sitemap URLs.
 */
export function assertBuildEnv(source: EnvSource) {
  const result = parseEnv(source);
  const issues = result.ok ? [] : [...result.issues];
  // On a Vercel production deploy the localhost default would ship
  // canonical, hreflang and sitemap URLs pointing at localhost.
  if (source.VERCEL_ENV === 'production' && !source.NEXT_PUBLIC_SITE_URL) {
    issues.push(
      'NEXT_PUBLIC_SITE_URL: NEXT_PUBLIC_SITE_URL is required for production deploys (the absolute https origin, e.g. https://moose.example)'
    );
  }
  if (issues.length === 0) return;
  throw new Error(
    [
      'Invalid environment for the production build:',
      ...issues.map((issue) => `  - ${issue}`),
      'Set the variables in .env.local (see .env.example) or the CI/Vercel environment.',
    ].join('\n')
  );
}
