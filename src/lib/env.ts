import { z } from 'zod';

const envSchema = z.object({
  TMDB_READ_TOKEN: z
    .string({ error: 'TMDB_READ_TOKEN is required' })
    .min(1, 'TMDB_READ_TOKEN is required'),
  // Canonical, hreflang and sitemap URLs are built from it: a value without
  // a scheme (`example.com`, `localhost:3000`) would break all of them.
  SITE_URL: z.url({
    protocol: /^https?$/,
    error:
      'NEXT_PUBLIC_SITE_URL must be an absolute http(s) URL, e.g. https://moose.example',
  }),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

type EnvSource = Record<string, string | undefined>;

/**
 * Validates the raw variables and returns one line per problem, or the
 * parsed env. Shared by `getEnv` (runtime) and `assertBuildEnv` (build).
 * Messages never include the values themselves, so the token cannot leak.
 */
export function parseEnv(
  source: EnvSource
): { ok: true; env: Env } | { ok: false; issues: string[] } {
  const result = envSchema.safeParse({
    TMDB_READ_TOKEN: source.TMDB_READ_TOKEN,
    SITE_URL: source.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  });
  if (result.success) return { ok: true, env: result.data };
  return {
    ok: false,
    issues: result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    ),
  };
}

export function getEnv(): Env {
  if (cached) return cached;
  const result = parseEnv(process.env);
  if (!result.ok) {
    throw new Error(
      `Invalid environment configuration (${result.issues.join('; ')})`
    );
  }
  cached = result.env;
  return cached;
}

/** Clears the cached env. Intended for tests only. */
export function resetEnvCache(): void {
  cached = undefined;
}
