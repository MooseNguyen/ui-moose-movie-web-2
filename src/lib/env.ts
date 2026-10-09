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

export function getEnv(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse({
    TMDB_READ_TOKEN: process.env.TMDB_READ_TOKEN,
    SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  });
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration (${details})`);
  }
  cached = result.data;
  return cached;
}

/** Clears the cached env. Intended for tests only. */
export function resetEnvCache(): void {
  cached = undefined;
}
