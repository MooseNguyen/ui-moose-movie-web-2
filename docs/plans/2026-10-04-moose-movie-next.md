# Moose Movie Next — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a movie/TV browsing app with Next.js 16 on TMDB data — Home, lists, Search, Discover, Detail, Person, Favorites, i18n vi/en — deployable to Vercel.

**Architecture:** Server-first: Server Components fetch TMDB through `lib/tmdb` (server-only, cached with `fetch` revalidate, validated with Zod, normalized to `MediaItem`). Interactivity (slider, trailer, load more, favorites, filters) lives in leaf Client Components; "Load more" calls Server Actions. next-intl drives `/[locale]` routing.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, in-house theme module (replaced next-themes in Task 7), Embla Carousel, next-intl v4, Zod v4, Zustand v5, Vitest + Testing Library + MSW v2, Playwright, Lighthouse CI, GitHub Actions.

**Spec:** `docs/specs/2026-10-04-moose-movie-next-design.md`

**Tracking:** each task is GitHub issue `#N` (Task N = issue #N) in `MooseNguyen/ui-moose-movie-web-2`, on the "Moose Movie Next" project board. One branch + one PR per task, PR body contains `Closes #N`.

## Global Constraints

- **Language:** everything in the repo is English — code, comments, docs, commit messages, issues, PRs. Vietnamese appears only in `src/messages/vi.json` and in test data that deliberately exercises Vietnamese input.
- Package manager: **pnpm** (`packageManager` pinned in `package.json`; `pnpm-workspace.yaml` holds `allowBuilds`). Never use npm or yarn to install — they create a second lockfile. `engines.node` = `>=20.9`; CI uses Node 24 with `pnpm/action-setup`. Task 1 was executed with npm and migrated to pnpm afterwards; its commands below are historical.
- TypeScript `strict: true`; alias `@/*` → `src/*`.
- Only one required env var: `TMDB_READ_TOKEN`. Optional: `NEXT_PUBLIC_SITE_URL` (default `http://localhost:3000`).
- `pnpm build` prerenders Home (ISR, `revalidate = 3600`) and therefore calls TMDB: the build needs `TMDB_READ_TOKEN` (and, locally, a network that reaches TMDB, e.g. Cloudflare WARP). CI must pass the secret to the build step, not only to E2E. Home is ISR; data failures are caught per row/hero (inline row error, no hero) and the error state may be cached until the next revalidation (≤ 1h) — never throw from a prerendered Server Component, it fails the build.
- Every file in `src/lib/tmdb/` starts with `import 'server-only';`. The token never gets a `NEXT_PUBLIC_` prefix.
- The layout owns the single `<main>` landmark; pages render container `<div>`s, never their own `<main>`.
  The layout `<main>` is a block container; never make it a flex/grid container — centred page containers with `mx-auto` inside a flex parent shrink to fit-content and carousels then overflow the viewport.
- Locales: `vi` (default), `en`. TMDB mapping: `vi → vi-VN`, `en → en-US`.
- Revalidate: lists/trending `3600`; detail/person/videos `86400`; genres `604800`; search/discover `600`.
- TMDB page limit: `MAX_PAGE = 500`. Server Actions accept `page` in `2..500`.
- TMDB fetch timeout: `8000` ms. On 429: wait `Retry-After` up to `2000` ms, retry exactly once.
- Image sizes: cast `w185`, card `w342`, detail poster `w780`, backdrop `w1280`. `next.config` uses a global custom loader (`images.loader: 'custom'`, `loaderFile: './src/lib/tmdb-image-loader.ts'`) instead of Vercel image optimization: it rewrites the size segment of `image.tmdb.org/t/p/{size}/…` to the smallest TMDB width ≥ the requested width (`original` above `w1280`), and `deviceSizes`/`imageSizes` are exactly the TMDB widths `92, 154, 185, 300, 342, 500, 780, 1280`, so `sizes` produces real srcsets. Non-TMDB images (local logo/placeholders, YouTube thumbnails) pass through unchanged and are rendered with `unoptimized`.
- Image placeholders are local SVGs in `public/` — no external placeholder services.
- `"use client"` only on interactive leaf components; never in `layout.tsx` or `page.tsx`.
- Next.js 16: page `params` and `searchParams` are `Promise`s — always `await` them. Middleware lives in `src/proxy.ts`.
- Theme: `dark` by default, `light` available, `enableSystem={false}`.
- Font: `next/font/google` **Be Vietnam Pro** (subsets `latin`, `vietnamese`).
- Budget: Lighthouse mobile Performance ≥ 0.9 (warn), SEO = 1, Accessibility ≥ 0.95; JS per page (Lighthouse `resource-summary:script:size`, gzip): error above 250KB, warn above 200KB. Measured baseline in Task 21: ~240KB, of which ~131KB is the Next.js/React framework, so the original 150KB target was not reachable without removing the layout's interactive pieces; the 200KB target is tracked in https://github.com/MooseNguyen/ui-moose-movie-web-2/issues/46.
- Coverage ≥ 80% (lines) for `src/lib/**` and `src/features/**`.
- Discover `sort` in the URL uses neutral keys `popularity.desc | vote_average.desc | release_date.desc | title.asc`, mapped to TMDB params per media type (spec 4.4).
- Every UI string lives in `src/messages/{vi,en}.json`; both files have the same key set. Component tests render with the `en` locale unless the test is about Vietnamese.
- Commit messages follow Conventional Commits and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` when written by Claude.

## Review Focus

1. **Missing image/title from TMDB** (`null` poster, TV without `first_air_date`, empty name) → card still renders with a placeholder and `year = null`, no crash. Tests in Task 3 and Task 8.
2. **Search terms with Vietnamese diacritics / special characters** (`người nhện`, `a/b`, `50%`) → URL encoded correctly and the search page receives the exact string. Test in Task 16.
3. **`multi` search mixing people and media** → people render `PersonCard`, media render `MediaCard`, unknown `mediaType` items are dropped. Test in Task 3.
4. **Corrupt or wrongly shaped localStorage** under `moose-favorites` → store starts empty, no crash. Test in Task 9.
5. **Rapid "Load more" clicks or switching tabs while loading** → no duplicate action calls, stale results never appended to the new list. Test in Task 11.

---

## Phase 0 — Foundation

### Task 1: Project scaffold + test tooling

**Files:**
- Create: the full `create-next-app` scaffold (`package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `src/app/*`, `postcss.config.mjs`)
- Create: `.prettierrc`, `.env.example`, `vitest.config.mts`, `tests/setup.ts`, `tests/stubs/empty.ts`
- Create: `src/lib/env.ts`, `src/lib/utils.ts`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Produces: `getEnv(): { TMDB_READ_TOKEN: string; SITE_URL: string }` (parsed once then cached; throws an `Error` mentioning `TMDB_READ_TOKEN` when missing); `resetEnvCache(): void` (tests only); `cn(...inputs: ClassValue[]): string`.
- Produces: scripts `npm run test`, `npm run test:coverage`, `npm run typecheck`, `npm run lint`, `npm run format`.

- [ ] **Step 1: Scaffold**

Run in `D:/MOOSE/Front-end/Projects/Moose-Movie-Next`:
`npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --use-npm --yes`
If the CLI refuses because the folder is not empty: scaffold into a sibling temp folder and move every file (except `.git`) here.
Expected: `npm run dev` serves the default page at `http://localhost:3000`.

- [ ] **Step 2: Install dependencies**

```bash
npm i zod server-only clsx tailwind-merge next-intl next-themes zustand embla-carousel-react embla-carousel-autoplay
npm i -D vitest @vitest/coverage-v8 @vitejs/plugin-react vite-tsconfig-paths jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom msw prettier prettier-plugin-tailwindcss
```

- [ ] **Step 3: Configure**

- `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`, `"typecheck": "tsc --noEmit"`, `"format": "prettier --write ."`; `"engines": { "node": ">=20.9" }`.
- `vitest.config.mts`: plugins `react()`, `tsconfigPaths()`; `test.environment = 'jsdom'`; `setupFiles = ['tests/setup.ts']`; `exclude` adds `tests/e2e/**`; `resolve.alias['server-only'] = 'tests/stubs/empty.ts'`; coverage `include: ['src/lib/**', 'src/features/**']`, `thresholds: { lines: 80 }`.
- `tests/setup.ts`: import `@testing-library/jest-dom/vitest`.
- `.prettierrc`: `singleQuote: true`, `semi: true`, `trailingComma: 'es5'`, `printWidth: 80`, tailwind plugin.
- `.env.example`: `TMDB_READ_TOKEN=` and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
- `next.config.ts`: `images: { unoptimized: true, remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org' }, { protocol: 'https', hostname: 'i.ytimg.com' }] }`.

- [ ] **Step 4: Write the failing env test**

```ts
// src/lib/env.test.ts
describe('getEnv', () => {
  beforeEach(() => resetEnvCache());
  it('throws a message naming TMDB_READ_TOKEN when missing', () => {
    vi.stubEnv('TMDB_READ_TOKEN', '');
    expect(() => getEnv()).toThrow(/TMDB_READ_TOKEN/);
  });
  it('returns token and default SITE_URL', () => {
    vi.stubEnv('TMDB_READ_TOKEN', 'abc');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(getEnv()).toEqual({ TMDB_READ_TOKEN: 'abc', SITE_URL: 'http://localhost:3000' });
  });
});
```

- [ ] **Step 5: Run it to see it fail**

Run: `npm run test -- src/lib/env.test.ts` — Expected: FAIL (module does not exist).

- [ ] **Step 6: Implement `getEnv`, `resetEnvCache` in `src/lib/env.ts` (Zod `z.string().min(1)`; `SITE_URL` from `NEXT_PUBLIC_SITE_URL` when non-empty) and `cn` in `src/lib/utils.ts` (`twMerge(clsx(inputs))`)**

- [ ] **Step 7: Verify**

Run: `npm run test && npm run typecheck && npm run lint` — Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app with Vitest, Prettier and env validation"
```

---

## Phase 1 — TMDB data layer

### Task 2: `tmdbFetch` + `TmdbError`

**Files:**
- Create: `src/lib/tmdb/errors.ts`, `src/lib/tmdb/client.ts`, `src/lib/tmdb/constants.ts`
- Create: `tests/msw/server.ts` (shared MSW `setupServer()`; `beforeAll/afterEach/afterAll` registered in `tests/setup.ts`, `onUnhandledRequest: 'error'`)
- Test: `src/lib/tmdb/client.test.ts`

**Interfaces:**
- Consumes: `getEnv()` (Task 1).
- Produces:
  - `type Locale = 'vi' | 'en'`; `type MediaType = 'movie' | 'tv'`
  - `constants.ts`: `TMDB_BASE_URL = 'https://api.themoviedb.org/3'`, `MAX_PAGE = 500`, `REVALIDATE = { list: 3600, detail: 86400, genres: 604800, search: 600 } as const`, `MOVIE_LISTS = ['popular','top_rated','upcoming','now_playing'] as const`, `TV_LISTS = ['popular','top_rated','on_the_air','airing_today'] as const`, `SEARCH_TYPES = ['multi','movie','tv','person'] as const`, `LOCALES = ['vi','en'] as const`.
  - `toTmdbLanguage(locale: Locale): 'vi-VN' | 'en-US'`
  - `class TmdbError extends Error { kind: 'not_found' | 'rate_limit' | 'network' | 'server' | 'invalid_response'; status: number | null; path: string }`
  - `tmdbFetch<T>(path: string, opts: { schema: z.ZodType<T>; locale?: Locale; params?: Record<string, string | number | undefined>; revalidate: number; tags?: string[]; timeoutMs?: number }): Promise<T>`

- [ ] **Step 1: Write failing tests** (MSW handlers on `https://api.themoviedb.org/3/*`)

```ts
it('sends bearer token and language, drops undefined params', async () => { /* handler captures the request */
  await tmdbFetch('/movie/popular', { schema: z.object({ page: z.number() }), locale: 'vi', params: { page: 2, region: undefined }, revalidate: 60 });
  expect(captured.headers.get('authorization')).toBe('Bearer test-token');
  expect(captured.url.searchParams.get('language')).toBe('vi-VN');
  expect(captured.url.searchParams.get('page')).toBe('2');
  expect(captured.url.searchParams.has('region')).toBe(false);
});
it('maps 404 to TmdbError kind not_found', /* rejects with { kind: 'not_found', status: 404 } */);
it('retries once after 429 then succeeds', /* 429 + Retry-After: 0, then 200 → resolves; handler hit exactly twice */);
it('throws rate_limit when 429 repeats', /* two 429s → kind 'rate_limit'; hit exactly twice */);
it('maps 500 to kind server', ...);
it('maps timeout to kind network', /* handler delay 'infinite', timeoutMs: 50 */);
it('maps schema mismatch to kind invalid_response', /* body {page:'x'} */);
```

- [ ] **Step 2: Run to see them fail** — `pnpm test src/lib/tmdb/client.test.ts` → FAIL.

- [ ] **Step 3: Implement** `tmdbFetch` in `client.ts`: `fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs ?? 8000), next: { revalidate, tags } })`; wait `min(Number(Retry-After)*1000, 2000)` before the retry; `schema.safeParse` — on failure `console.error('[tmdb]', path, issues)` then throw `invalid_response`. This is the only log point of the data layer.

- [ ] **Step 4: Run to see them pass** — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(tmdb): add typed tmdbFetch with timeout, retry and error mapping"`

### Task 3: Schemas, normalized types, images

**Files:**
- Create: `src/lib/tmdb/types.ts`, `src/lib/tmdb/schemas.ts`, `src/lib/tmdb/normalize.ts`, `src/lib/images.ts` (moved out of `tmdb/` in Task 8: pure URL builder, no `server-only`, so client components can use it)
- Create: `public/placeholder-poster.svg`, `public/placeholder-profile.svg`, `public/placeholder-backdrop.svg`
- Create: `tests/fixtures/movie-popular.json`, `tv-popular.json`, `search-multi.json`, `movie-detail.json`, `tv-detail.json`, `person-detail.json` (real TMDB responses, trimmed to ~3 items; manually add one item without `poster_path` and one TV item without `first_air_date`)
- Test: `src/lib/tmdb/normalize.test.ts`, `src/lib/images.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `MediaItem = { id: number; mediaType: MediaType; title: string; originalTitle: string; overview: string; posterPath: string | null; backdropPath: string | null; year: number | null; voteAverage: number; voteCount: number; genreIds: number[] }`
  - `PersonSummary = { id: number; mediaType: 'person'; name: string; profilePath: string | null; knownForDepartment: string | null }`
  - `GridItem = MediaItem | PersonSummary`
  - `Paginated<T> = { items: T[]; page: number; totalPages: number }` (`totalPages` clamped to ≤ `MAX_PAGE`)
  - `Genre = { id: number; name: string }`; `CastMember = { id: number; name: string; character: string; profilePath: string | null }`; `Video = { key: string; name: string; type: 'Trailer' | 'Teaser'; official: boolean }`
  - `MediaDetail = MediaItem & { tagline: string | null; genres: Genre[]; releaseDate: string | null; runtime: number | null; seasons: number | null; episodes: number | null; companies: string[]; cast: CastMember[]; videos: Video[]; related: MediaItem[]; overviewIsFallback: boolean }`
  - `PersonDetail = { id: number; name: string; profilePath: string | null; knownForDepartment: string | null; birthday: string | null; deathday: string | null; placeOfBirth: string | null; biography: string; biographyIsFallback: boolean; credits: MediaItem[] }`
- Produces (`schemas.ts`): `rawMovieSchema`, `rawTvSchema`, `rawMultiItemSchema`, `rawPersonSummarySchema`, `pageSchema(item)`, `rawMovieDetailSchema`, `rawTvDetailSchema`, `rawPersonDetailSchema`, `rawVideosSchema`, `rawGenresSchema`. Optional fields `.nullable().catch(null)`, arrays `.catch([])`, numbers `.catch(0)`, strings `.catch('')`; required: `id`, `page`, `results`, `total_pages`.
- Produces (`normalize.ts`):
  - `toMediaItem(raw: RawMovie | RawTv, mediaType: MediaType): MediaItem`
  - `toGridItems(raw: RawMultiItem[]): GridItem[]` — drops items whose `media_type` is not movie/tv/person
  - `toPaginated<R, T>(raw: { page: number; total_pages: number; results: R[] }, map: (r: R[]) => T[]): Paginated<T>` — dedupes by `mediaType+id`, clamps `totalPages` to ≤ 500
  - `pickVideos(raw: RawVideo[]): Video[]` — only `site === 'YouTube'`, `type` in Trailer/Teaser, official first, max 6
  - `toMediaDetail(raw, mediaType, fallbackOverview?: string): MediaDetail` — first 12 cast, 3 companies, `related` = recommendations, falling back to similar when empty
  - `toPersonDetail(raw, fallbackBiography?: string): PersonDetail` — credits from `combined_credits.cast`, deduped, sorted by `popularity` descending
- Produces (`images.ts`): `type ImageSize = 'w185' | 'w342' | 'w780' | 'w1280' | 'original'`; `tmdbImage(path: string | null, size: ImageSize, kind?: 'poster' | 'profile' | 'backdrop'): string` → `https://image.tmdb.org/t/p/{size}{path}` or `/placeholder-{kind}.svg` (default `poster`).

- [ ] **Step 1: Write failing tests**

```ts
it('normalizes movie and tv to the same shape', () => {
  const m = toMediaItem(movieFixture.results[0], 'movie');
  const t = toMediaItem(tvFixture.results[0], 'tv');
  expect(m).toMatchObject({ mediaType: 'movie', title: expect.any(String), year: expect.any(Number) });
  expect(t.title).toBe(tvFixture.results[0].name);
});
it('returns year null and posterPath null when missing', ...);
it('keeps person and media from multi search, drops unknown media_type', () => {
  const items = toGridItems([...multiFixture.results, { id: 1, media_type: 'collection' }]);
  expect(items.map((i) => i.mediaType)).not.toContain('collection');
  expect(items.some((i) => i.mediaType === 'person')).toBe(true);
});
it('dedupes pages and clamps totalPages to 500', /* total_pages: 40000 → 500 */);
it('pickVideos keeps YouTube trailers/teasers, official first, max 6', ...);
it('toMediaDetail uses similar when recommendations empty and sets overviewIsFallback', ...);
it('toPersonDetail dedupes credits and sorts by popularity desc', ...);
// images.test.ts
expect(tmdbImage('/a.jpg', 'w342')).toBe('https://image.tmdb.org/t/p/w342/a.jpg');
expect(tmdbImage(null, 'w185', 'profile')).toBe('/placeholder-profile.svg');
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement the signatures above.** `Raw*` types come from `z.infer` on the schemas.
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(tmdb): add zod schemas, normalized media types and image helpers"`

### Task 4: Discover params

**Files:**
- Create: `src/features/discover/params.ts`
- Test: `src/features/discover/params.test.ts`

**Interfaces:**
- Produces:
  - `DISCOVER_SORTS = ['popularity.desc','vote_average.desc','release_date.desc','title.asc'] as const`; `type DiscoverSort`
  - `type DiscoverParams = { type: MediaType; genres: number[]; year: number | null; sort: DiscoverSort }`
  - `DEFAULT_DISCOVER: DiscoverParams = { type: 'movie', genres: [], year: null, sort: 'popularity.desc' }`
  - `parseDiscoverParams(sp: Record<string, string | string[] | undefined>, now?: Date): DiscoverParams` — invalid values → that field's default; `year` within `1950..now.getFullYear()`; `genres` positive integers only, deduped, sorted ascending
  - `serializeDiscoverParams(p: DiscoverParams): string` — query string omitting fields equal to the default; `genres` comma-joined
  - `toTmdbDiscoverQuery(p: DiscoverParams): Record<string, string | number>` — movie: `release_date.desc → primary_release_date.desc`, `title.asc → title.asc`, year → `primary_release_year`; tv: `release_date.desc → first_air_date.desc`, `title.asc → name.asc`, year → `first_air_date_year`; `with_genres` comma-joined; `vote_average.desc` adds `'vote_count.gte': 200`

- [ ] **Step 1: Write failing tests**

```ts
it('falls back per field on invalid input', () => {
  expect(parseDiscoverParams({ type: 'anime', year: '1800', sort: 'x', genres: '28,abc,-1,28' }, new Date('2026-10-04')))
    .toEqual({ type: 'movie', genres: [28], year: null, sort: 'popularity.desc' });
});
it('round-trips', () => {
  const p = { type: 'tv', genres: [16, 35], year: 2024, sort: 'vote_average.desc' } as const;
  expect(parseDiscoverParams(Object.fromEntries(new URLSearchParams(serializeDiscoverParams(p))))).toEqual(p);
});
it('serializes defaults to empty string', () => expect(serializeDiscoverParams(DEFAULT_DISCOVER)).toBe(''));
it('maps tv sort and year to TMDB keys, adds vote_count.gte for rating', ...);
```

- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(discover): parse, serialize and map discover URL params"`

### Task 5: Public API functions

**Files:**
- Create: `src/lib/tmdb/api.ts`
- Test: `src/lib/tmdb/api.test.ts`

**Interfaces:**
- Consumes: `tmdbFetch`, schemas, normalize (Tasks 2–3), `toTmdbDiscoverQuery` (Task 4).
- Produces:
  - `getTrending(locale: Locale): Promise<MediaItem[]>` — `/trending/all/week`, movie/tv only, first 5, `REVALIDATE.list`
  - `getList(mediaType: MediaType, list: string, page: number, locale: Locale): Promise<Paginated<MediaItem>>` — `/{mediaType}/{list}`
  - `getDetail(mediaType: MediaType, id: number, locale: Locale): Promise<MediaDetail>` — `append_to_response=credits,videos,recommendations,similar`; when `locale === 'vi'` and the overview is empty → fetch `/{mediaType}/{id}` in `en` for the overview, `overviewIsFallback = true`
  - `getVideos(mediaType: MediaType, id: number, locale: Locale): Promise<Video[]>` — with `include_video_language={lang},en,null`
  - `search(type: SearchType, q: string, page: number, locale: Locale): Promise<Paginated<GridItem>>` — `/search/{type}`, `REVALIDATE.search`
  - `discover(p: DiscoverParams, page: number, locale: Locale): Promise<Paginated<MediaItem>>`
  - `getGenres(mediaType: MediaType, locale: Locale): Promise<Genre[]>`
  - `getPerson(id: number, locale: Locale): Promise<PersonDetail>` — `append_to_response=combined_credits`, `en` biography fallback like `getDetail`
  - `getPopularIds(mediaType: MediaType): Promise<number[]>` — pages 1–5 of `popular` (100 ids), locale `en`

- [ ] **Step 1: Write failing tests (MSW returns fixtures)**

```ts
it('getTrending filters people and returns 5', ...);
it('getDetail fetches en overview when vi overview is empty', /* 2 requests; overviewIsFallback true */);
it('getDetail does not refetch when overview present', /* 1 request */);
it('getDetail propagates not_found', /* 404 → TmdbError kind not_found */);
it('discover sends mapped query', /* check searchParams sort_by, with_genres, vote_count.gte */);
it('search encodes Vietnamese query', /* q = 'người nhện' → searchParams.get('query') === 'người nhện' */);
```

- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(tmdb): add public API functions with locale fallback"`

### Task 6: Server Actions

**Files:**
- Create: `src/lib/actions/media.ts` (`'use server'`)
- Test: `src/lib/actions/media.test.ts`

**Interfaces:**
- Consumes: Tasks 4–5.
- Produces:
  - `type ActionError = 'invalid_input' | 'not_found' | 'rate_limit' | 'network' | 'unknown'`; `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }`
  - `loadMoreList(base: { mediaType: MediaType; list: string; locale: Locale }, page: number): Promise<ActionResult<Paginated<MediaItem>>>`
  - `loadMoreSearch(base: { type: SearchType; q: string; locale: Locale }, page: number): Promise<ActionResult<Paginated<GridItem>>>`
  - `loadMoreDiscover(base: { query: string; locale: Locale }, page: number): Promise<ActionResult<Paginated<MediaItem>>>` — `query` is the string from `serializeDiscoverParams`, re-parsed with `parseDiscoverParams`
  - `getTrailer(input: { mediaType: MediaType; id: number; locale: Locale }): Promise<ActionResult<Video | null>>`
  - The `(base, page)` signature lets the client use `action.bind(null, base)` → `(page: number) => Promise<ActionResult<…>>`.
- Validate with Zod: `page` int 2..500; `list` in `MOVIE_LISTS`/`TV_LISTS` for its `mediaType`; `type` in `SEARCH_TYPES`; `q` trimmed 1..100 chars; `id` positive int; `locale` in `LOCALES`. Map `TmdbError.kind` to `ActionError` (`server`/`invalid_response` → `unknown`). Never throw.

- [ ] **Step 1: Write failing tests**

```ts
it('rejects page 1 and 501 without calling TMDB', async () => {
  expect(await loadMoreList({ mediaType: 'movie', list: 'popular', locale: 'vi' }, 501)).toEqual({ ok: false, error: 'invalid_input' });
  expect(requestCount).toBe(0);
});
it('rejects tv list name on movie', /* list 'on_the_air' with movie → invalid_input */);
it('rejects empty/whitespace q', ...);
it('returns ok with data', ...);
it('maps 429 twice to rate_limit', ...);
it('getTrailer returns null when no videos', ...);
```

- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS; `pnpm test:coverage` meets the 80% threshold.**
- [ ] **Step 5: Commit** — `git commit -m "feat(actions): add validated load-more and trailer server actions"`

---

## Phase 2 — App shell

### Task 7: i18n, theme, shared layout

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/navigation.ts`, `src/i18n/request.ts`, `src/proxy.ts`
- Create: `src/messages/vi.json`, `src/messages/en.json`
- Create: `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx` (temporary: heading only), `src/app/[locale]/error.tsx`, `src/app/[locale]/not-found.tsx`, `src/app/[locale]/[...rest]/page.tsx` (calls `notFound()`). There is deliberately no `[locale]/loading.tsx`: a locale-level Suspense boundary would stream the shell first and turn `notFound()` into HTTP 200 (soft 404). Each page task adds its own route-level `loading.tsx`.
- Create: `src/components/providers.tsx` (ThemeProvider + Toaster), `src/components/layout/Header.tsx`, `MobileNav.tsx`, `Footer.tsx`, `LocaleSwitcher.tsx`, `ThemeToggle.tsx`, `NavLinks.tsx`
- Create: `src/components/ui/*` via `pnpm dlx shadcn@latest init` then `pnpm dlx shadcn@latest add button dialog alert-dialog sheet select tabs carousel skeleton sonner badge dropdown-menu`
- Create: `tests/utils/render.tsx`
- Delete: default `src/app/page.tsx`, `src/app/layout.tsx` (replace with a minimal root layout if next-intl requires one)
- Test: `src/messages/messages.test.ts`, `src/components/layout/NavLinks.test.tsx`

**Interfaces:**
- Produces:
  - `routing = defineRouting({ locales: ['vi', 'en'], defaultLocale: 'vi' })`; `Link`, `useRouter`, `usePathname`, `redirect` from `createNavigation(routing)` in `navigation.ts`
  - Message namespaces: `common`, `nav`, `home`, `list`, `search`, `discover`, `detail`, `person`, `favorites`, `errors`, `footer`
  - `isActivePath(pathname: string, href: string): boolean` (exported from `NavLinks.tsx`) — `/` matches only exactly; other hrefs match themselves and nested routes
  - `renderWithIntl(ui: ReactElement, locale?: Locale): RenderResult` in `tests/utils/render.tsx` (wraps `NextIntlClientProvider` with the real messages; default locale `en`)
- Layout: `<html lang={locale} suppressHydrationWarning>`, Be Vietnam Pro font, locale resolved from `next/root-params` in `src/i18n/request.ts` (no `setRequestLocale` calls; Next 16.3+), `generateStaticParams` returns both locales; invalid locale → `notFound()`. Header is transparent and gains a background when `scrollY > 80` (client `useEffect` + state, no `classList`). Footer: "This product uses the TMDB API but is not endorsed or certified by TMDB." with a link to `https://www.themoviedb.org` (the TMDB logo can be downloaded manually from TMDB's attribution page into `public/tmdb-logo.svg`). `error.tsx` is a client component with a button calling `reset()`.

- [ ] **Step 1: Write failing tests**

```ts
// messages.test.ts — flattened key sets of vi.json and en.json must be equal
expect(flatKeys(vi)).toEqual(flatKeys(en));
// NavLinks.test.tsx
expect(isActivePath('/movie/123', '/movie')).toBe(true);
expect(isActivePath('/movie', '/')).toBe(false);
expect(isActivePath('/', '/')).toBe(true);
```

- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Manual check** — `pnpm dev`: `/` redirects to `/vi`; `/en` shows English text; switching locale keeps the path; switching theme does not flash; `/vi/does-not-exist` shows the 404 page; at 360px the menu is in a Sheet.
- [ ] **Step 6: Commit** — `git commit -m "feat(app): add i18n routing, theme, header, footer and route states"`

---

## Phase 3 — Shared components

### Task 8: MediaCard, PersonCard, MediaGrid, MediaCarousel

**Files:**
- Create: `src/components/media/MediaCard.tsx`, `PersonCard.tsx`, `MediaGrid.tsx`, `GridItemCard.tsx`, `MediaCarousel.tsx`, `MediaRowSkeleton.tsx`, `ErrorBoundary.tsx`
- Test: `src/components/media/MediaCard.test.tsx`

**Interfaces:**
- Consumes: `MediaItem`, `PersonSummary`, `GridItem`, `tmdbImage` (Task 3); `Link` (Task 7).
- Produces:
  - `MediaCard({ item, priority?, action? }: { item: MediaItem; priority?: boolean; action?: ReactNode })` — Server Component; links to `/{mediaType}/{id}`; image `w342`, `alt = item.title`; shows the year (hidden when `null`) and the rating rounded to 1 decimal; `action` is the slot for `FavoriteButton`
  - `PersonCard({ person }: { person: PersonSummary })` — links to `/person/{id}`, image `w185` of kind `profile`
  - `GridItemCard({ item }: { item: GridItem })` — picks PersonCard or MediaCard (`action` slot left empty; Task 9 plugs in FavoriteButton)
  - `MediaGrid({ children })` — grid `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`
  - `MediaCarousel({ children, label }: { children: ReactNode; label: string })` — client, scrolling only (Embla via shadcn `Carousel`, `slidesToScroll: 'auto'`), wraps each child in a slide, prev/next buttons with translated names; it does not import MediaCard — Tasks 12/14 pass server-rendered cards as children
  - `ErrorBoundary({ fallback, children })` — client class component

- [ ] **Step 1: Write the failing test**

```ts
it('links to the right media type and shows placeholder when poster missing', () => {
  renderWithIntl(<MediaCard item={{ ...tvItem, posterPath: null, year: null }} />);
  expect(screen.getByRole('link')).toHaveAttribute('href', '/en/tv/' + tvItem.id);
  expect(screen.getByRole('img')).toHaveAttribute('src', '/placeholder-poster.svg');
  expect(screen.queryByText('null')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): add media and person cards, grid and carousel"`

### Task 9: Favorites store + FavoriteButton

**Files:**
- Create: `src/features/favorites/store.ts`, `src/features/favorites/FavoriteButton.tsx`, `src/features/favorites/FavoritesHydrator.tsx`
- Modify: `src/components/providers.tsx` (render `<FavoritesHydrator />`)
- Modify: `src/components/media/GridItemCard.tsx` (pass `FavoriteButton` into the `action` slot)
- Test: `src/features/favorites/store.test.ts`, `src/features/favorites/FavoriteButton.test.tsx`

**Interfaces:**
- Produces:
  - `type FavoriteItem = { id: number; mediaType: MediaType; title: string; posterPath: string | null; voteAverage: number; year: number | null; addedAt: number }`
  - `useFavorites` (Zustand + `persist`, `name: 'moose-favorites'`, `version: 1`, `skipHydration: true`, storage = `createJSONStorage(safeStorage)`) with state `{ items: FavoriteItem[]; hasHydrated: boolean; storageAvailable: boolean }` and actions `toggle(item: Omit<FavoriteItem, 'addedAt'>)`, `remove(mediaType, id)`, `clear()`
  - `isFavorite(state, mediaType, id): boolean`; `selectSorted(state, filter: 'all' | MediaType): FavoriteItem[]` (newest first)
  - `safeStorage(): StateStorage` — uses `localStorage` when a test read/write succeeds, otherwise an in-memory Map and sets `storageAvailable = false`
  - `FavoritesHydrator` — client; in `useEffect` calls `useFavorites.persist.rehydrate()`, listens to `storage` events for key `moose-favorites` to rehydrate again, and toasts once when `storageAvailable === false`
  - `FavoriteButton({ item }: { item: Omit<FavoriteItem, 'addedAt'> })` — `aria-pressed`, `aria-label` from `favorites.add` / `favorites.remove`; before `hasHydrated` shows a neutral, `disabled` state
- Persist `migrate`/`merge`: data with the wrong shape (parsed with Zod) → `items: []`.

- [ ] **Step 1: Write failing tests**

```ts
it('toggle adds then removes, no duplicates', ...);
it('selectSorted returns newest first and filters by type', ...);
it('starts empty when stored JSON is corrupt', async () => {
  localStorage.setItem('moose-favorites', 'not json');
  await useFavorites.persist.rehydrate();
  expect(useFavorites.getState().items).toEqual([]);
});
it('starts empty when stored shape is wrong', /* {"state":{"items":[{"foo":1}]},"version":1} */);
it('falls back to memory when localStorage throws', /* vi.spyOn(Storage.prototype,'setItem').mockImplementation(() => { throw new Error() }) */);
// FavoriteButton.test.tsx
it('toggles aria-pressed after hydration', ...);
```

- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(favorites): add persisted favorites store and button"`

### Task 10: TrailerButton/TrailerDialog + VideoLiteEmbed

**Files:**
- Create: `src/components/media/TrailerButton.tsx`, `TrailerDialog.tsx`, `VideoLiteEmbed.tsx`
- Test: `src/components/media/TrailerDialog.test.tsx`, `src/components/media/VideoLiteEmbed.test.tsx`

**Interfaces:**
- Consumes: `getTrailer` (Task 6), shadcn `Dialog`.
- Produces:
  - `TrailerButton({ mediaType, id, title, onOpenChange? }: { mediaType: MediaType; id: number; title: string; onOpenChange?: (open: boolean) => void })` — client; owns `open`; imports `TrailerDialog` statically (Radix Dialog is already in every bundle via the header Sheet, so `next/dynamic` would save nothing; the Server Action fetch is what stays lazy) and passes its button as the dialog `trigger` so focus returns to it on close
  - `TrailerDialog({ mediaType, id, title, open, onOpenChange })` — calls `getTrailer` when opened; loading → Skeleton; video → iframe `https://www.youtube-nocookie.com/embed/{key}?autoplay=1`, `title={title}`, `aspect-video`; `data: null` → `detail.noTrailer` text; error → `errors.generic` + retry button. Closing removes the iframe from the DOM.
  - `VideoLiteEmbed({ video }: { video: Video })` — thumbnail button `https://i.ytimg.com/vi/{key}/hqdefault.jpg` with `aria-label` = video name; the iframe renders only after click

- [ ] **Step 1: Write failing tests**

```ts
it('renders no iframe until opened, removes it on close', ...);
it('shows no-trailer message when action returns null', /* vi.mock('@/lib/actions/media') */);
it('VideoLiteEmbed renders iframe only after click', ...);
```

- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): add lazy trailer dialog and lite YouTube embed"`

### Task 11: LoadMoreGrid

**Files:**
- Create: `src/components/media/LoadMoreGrid.tsx`
- Test: `src/components/media/LoadMoreGrid.test.tsx`

**Interfaces:**
- Consumes: `ActionResult`, `Paginated`, `GridItem` (Tasks 3, 6); `GridItemCard`, `MediaGrid` (Task 8).
- Produces: `LoadMoreGrid({ initial, loadMore }: { initial: Paginated<GridItem>; loadMore: (page: number) => Promise<ActionResult<Paginated<GridItem>>> })` — client; `useTransition`; button disabled while `isPending`; appends new items deduped by `mediaType+id`; hides the button when `page >= totalPages`; on error shows an `errors.*` message + retry button and keeps existing items. The parent page must pass a `key` (e.g. `${list}` or the query string) so switching lists resets state. Late responses are ignored via a request-counter ref (`requestId`) so stale results are never appended.

- [ ] **Step 1: Write failing tests**

```ts
it('appends next page and hides button on last page', ...);
it('does not call loadMore twice on rapid double click', async () => {
  await user.dblClick(screen.getByRole('button', { name: /load more/i }));
  expect(loadMore).toHaveBeenCalledTimes(1);
});
it('shows retry on error and keeps existing items', ...);
it('dedupes items returned twice', ...);
it('ignores a response that resolves after unmount/rerender with new key', ...);
```

- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): add load-more grid with dedupe and error retry"`

---

## Phase 4 — Pages

Every page in this phase: `await`s `params`/`searchParams`; does not call `setRequestLocale` (the locale comes from `next/root-params` via `src/i18n/request.ts`); has a `generateMetadata` (Task 19 adds hreflang via `buildMetadata` — until then `title` and `description` are enough). Verify manually with `pnpm dev`, and `pnpm build` must succeed.

### Task 12: Home

**Files:**
- Create: `src/app/[locale]/page.tsx` (replaces the placeholder), `src/components/media/HeroSlider.tsx`, `src/components/media/MediaRow.tsx`
- Test: `src/components/media/HeroSlider.test.tsx`

**Interfaces:**
- Consumes: `getTrending`, `getList` (Task 5); `MediaCarousel`, `ErrorBoundary`, `MediaRowSkeleton` (Task 8); `TrailerButton` (Task 10); `FavoriteButton` (Task 9).
- Produces:
  - `HeroSlider({ items }: { items: MediaItem[] })` — client; Embla `loop`, plugin `Autoplay({ delay: 5000, stopOnMouseEnter: true, stopOnInteraction: false })`; stops autoplay on `TrailerButton.onOpenChange(true)` and resumes on close; navigation dots have `aria-label`; first slide image `w1280` with `fetchPriority="high"`, other slides lazy; the Details button links to `/{mediaType}/{id}` of the right type; includes `TrailerButton` and `FavoriteButton`.
  - `MediaRow({ title, href, mediaType, list, locale })` — async Server Component; renders `MediaCarousel`; "See all" link to `/{mediaType}?list={list}`
- Page: `HeroSlider` + 6 `MediaRow`s (movie: `popular`, `top_rated`, `upcoming`; tv: `popular`, `top_rated`, `on_the_air`), each wrapped in `<ErrorBoundary fallback={…}><Suspense fallback={<MediaRowSkeleton/>}>`. `MediaRow` catches its own `getList` failure (inline `role="status"` error) and the page renders without the hero if `getTrending` fails; the ErrorBoundary is only a client-side safety net (thrown Server Component errors fail the ISR prerender).

- [ ] **Step 1: Write failing tests** — `HeroSlider` with a tv item: the Details button has `href` `/en/tv/{id}`; exactly 5 navigation dots.
- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Manual check** — slider advances every 5s, pauses on hover and while a trailer is open; ESC closes the trailer; a failing `/tv/on_the_air` fetch (server-side) shows the inline error in that row only.
- [ ] **Step 6: Commit** — `git commit -m "feat(home): add hero slider and media rows"`

### Task 13: List pages `/[mediaType]`

**Files:**
- Create: `src/app/[locale]/[mediaType]/page.tsx`, `src/app/[locale]/[mediaType]/loading.tsx`, `src/components/media/ListTabs.tsx`
- Create: `src/lib/route-params.ts`
- Test: `src/lib/route-params.test.ts`

**Interfaces:**
- Produces (`route-params.ts`): `parseMediaType(v: string): MediaType | null`; `parseListName(mediaType: MediaType, v: string | undefined): string` (invalid → `'popular'`); `parsePositiveId(v: string): number | null` (digit-only positive integers, no leading zero)
- Page: invalid `mediaType` → `notFound()`; tabs are `Link`s changing `?list=`; renders `<LoadMoreGrid key={list} initial={…} loadMore={loadMoreList.bind(null, { mediaType, list, locale })} />`.

- [ ] **Step 1: Write failing tests** — `parseMediaType('anime') === null`; `parseListName('tv', 'upcoming') === 'popular'`; `parsePositiveId('12abc') === null`; `parsePositiveId('0') === null`; `parsePositiveId('550') === 550`.
- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Manual check** — `/vi/movie?list=top_rated` selects the right tab; "Load more" appends; switching tab goes back to page 1; `/vi/anime` → 404.
- [ ] **Step 6: Commit** — `git commit -m "feat(list): add movie/tv list pages with tabs and load more"`

### Task 14: Detail `/[mediaType]/[id]`

**Files:**
- Create: `src/app/[locale]/[mediaType]/[id]/page.tsx` (NO route-level `loading.tsx` at or above `[id]`: resolve existence and `notFound()` before streaming so missing items return HTTP 404; use `<Suspense>` only around secondary sections)
- Create: `src/components/detail/DetailHero.tsx`, `CastList.tsx`, `VideoList.tsx`
- Test: `src/components/detail/DetailHero.test.tsx`

**Interfaces:**
- Consumes: `getDetail` (Task 5); `parseMediaType`, `parsePositiveId` (Task 13); `TrailerButton`, `VideoLiteEmbed` (Task 10); `FavoriteButton` (Task 9); `MediaCarousel` (Task 8).
- Produces: `DetailHero({ detail }: { detail: MediaDetail })` — shows the original title when it differs from `title`; genres are `Link`s to `/discover?type={mediaType}&genres={id}`; movies show `runtime` as `Xh Ym`, tv shows season/episode counts; `(English)` label when `overviewIsFallback`. `CastList({ cast })`, `VideoList({ videos })` — sections hidden when empty.
- Page: `generateStaticParams` returns `[]`; `TmdbError.kind === 'not_found'` or invalid params → `notFound()`; `generateMetadata` uses the `w1280` backdrop as the OG image. `getDetail` is wrapped in `React.cache` so metadata and page share one call.

- [ ] **Step 1: Write failing tests** — genre link `href` is `/en/discover?type=movie&genres=28`; runtime 135 → `2h 15m`; TV shows the season count; `(English)` appears only when `overviewIsFallback`.
- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Manual check** — `/vi/movie/550`, `/vi/tv/1399`, `/vi/movie/abc` (404), `/vi/movie/999999999` (404); Network tab: no YouTube iframe before clicking.
- [ ] **Step 6: Commit** — `git commit -m "feat(detail): add movie/tv detail page with cast, videos and related"`

### Task 15: Person `/person/[id]`

**Files:**
- Create: `src/app/[locale]/person/[id]/page.tsx` (NO route-level `loading.tsx` at or above `[id]`: resolve existence and `notFound()` before streaming; `<Suspense>` only around secondary sections), `src/components/person/PersonBio.tsx`, `src/components/person/PersonCredits.tsx`, `src/components/person/age.ts`
- Test: `src/components/person/PersonCredits.test.tsx`, `src/components/person/age.test.ts`

**Interfaces:**
- Consumes: `getPerson` (Task 5), `parsePositiveId` (Task 13).
- Produces: `calcAge(birthday: string, deathday: string | null, now?: Date): number` (in `age.ts`); `PersonBio({ text, isFallback })` — client, clamped to 6 lines + "Show more"/"Show less" when longer than 600 characters; `PersonCredits({ credits })` — client, All / Movies / TV tabs filtered on the client.

- [ ] **Step 1: Write failing tests** — `calcAge('1990-10-05', null, new Date('2026-10-04')) === 35`; `calcAge('1950-01-01', '2000-06-01') === 50`; the "TV" filter keeps only items with `mediaType === 'tv'`.
- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(person): add person page with bio and filmography"`

### Task 16: Search

**Files:**
- Create: `src/app/[locale]/search/page.tsx`, `src/components/media/SearchBox.tsx`
- Modify: `src/components/layout/Header.tsx` (add a search icon that opens SearchBox)
- Test: `src/components/media/SearchBox.test.tsx`

**Interfaces:**
- Consumes: `search` (Task 5), `loadMoreSearch` (Task 6), `LoadMoreGrid` (Task 11).
- Produces: `SearchBox({ defaultValue?, type? }: { defaultValue?: string; type?: SearchType })` — client `<form role="search">`; submit calls `router.push({ pathname: '/search', query: { q: trimmed, type } })` (so next-intl encodes it); nothing is pushed when the trimmed string is empty.
- Page: no `q` → prompt to enter a keyword; with `q` → tabs `multi | movie | tv | person`; no results → `search.empty` with the keyword; `LoadMoreGrid key={type + q}`; metadata `robots: { index: false }`.

- [ ] **Step 1: Write failing tests**

```ts
it('pushes encoded Vietnamese query on Enter', async () => {
  await user.type(screen.getByRole('searchbox'), '  người nhện {enter}');
  expect(push).toHaveBeenCalledWith({ pathname: '/search', query: { q: 'người nhện', type: 'multi' } });
});
it('does not push for whitespace only', ...);
it('Enter outside the input does nothing', /* keyup Enter on document.body → push not called */);
```

- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Manual check** — search `người nhện`, `a/b`, `50%`: the page loads correctly and the input shows the exact string again.
- [ ] **Step 6: Commit** — `git commit -m "feat(search): add multi-type search with load more"`

### Task 17: Discover

**Files:**
- Create: `src/app/[locale]/discover/page.tsx`, `src/features/discover/DiscoverFilters.tsx`
- Test: `src/features/discover/DiscoverFilters.test.tsx`

**Interfaces:**
- Consumes: `parseDiscoverParams`, `serializeDiscoverParams` (Task 4); `discover`, `getGenres` (Task 5); `loadMoreDiscover` (Task 6).
- Produces: `DiscoverFilters({ value, genres }: { value: DiscoverParams; genres: Genre[] })` — client; every change calls `router.push('/discover?' + serializeDiscoverParams(next))`; changing `type` clears `genres`; genre buttons are toggles with `aria-pressed`; year Select from the current year down to 1950; "Clear filters" pushes `/discover`.
- Page: `LoadMoreGrid key={serializeDiscoverParams(value)} loadMore={loadMoreDiscover.bind(null, { query, locale })}`.

- [ ] **Step 1: Write failing tests** — clicking genre 28 with `[12]` selected → push `/discover?genres=12,28`; switching type to tv → push `/discover?type=tv`; "Clear filters" → push `/discover`.
- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(discover): add URL-driven discover filters"`

### Task 18: Favorites page

**Files:**
- Create: `src/app/[locale]/favorites/page.tsx`, `src/features/favorites/FavoritesView.tsx`
- Test: `src/features/favorites/FavoritesView.test.tsx`

**Interfaces:**
- Consumes: `useFavorites`, `selectSorted` (Task 9); `MediaGrid`, `MediaCard` (Task 8). `FavoriteItem` is converted to `MediaItem` for the card (`overview: ''`, `originalTitle: title`, `backdropPath: null`, `voteCount: 0`, `genreIds: []`).
- Produces: `FavoritesView()` — client; skeleton before hydration; All/Movies/TV tabs; remove button per item; "Clear all" via `AlertDialog`; empty list → prompt + link to `/discover`. Page: metadata `robots: { index: false }`.

- [ ] **Step 1: Write failing tests** — empty state shows a link to `/en/discover`; "Clear all" clears only after confirmation; the TV tab shows only tv items.
- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Manual check** — with 2 tabs open, adding a favorite in tab A updates tab B; works in a private window.
- [ ] **Step 6: Commit** — `git commit -m "feat(favorites): add favorites page"`

### Task 19: SEO

**Files:**
- Create: `src/lib/seo.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/components/JsonLd.tsx`
- Modify: every page's `generateMetadata` (use `buildMetadata`); Detail and Person pages render `<JsonLd>`
- Test: `src/lib/seo.test.ts`

**Interfaces:**
- Consumes: `getEnv().SITE_URL` (Task 1); `getPopularIds` (Task 5).
- Produces:
  - `buildMetadata({ locale, path, title, description, image?, noIndex? }): Metadata` — `alternates.canonical = {SITE_URL}/{locale}{path}`, `alternates.languages = { vi: …, en: …, 'x-default': {SITE_URL}/vi{path} }`, `openGraph` + `twitter` (`summary_large_image`) when `image` is given
  - `movieJsonLd(detail: MediaDetail, url: string)` (`@type` = `Movie` or `TVSeries`, with `aggregateRating` when `voteCount > 0`); `personJsonLd(person: PersonDetail, url: string)`
  - `JsonLd({ data })` — `<script type="application/ld+json">`, replacing `<` with `\u003c` for safety
  - `sitemap()`: `/`, `/movie`, `/tv`, `/discover` × 2 locales + 100 popular movies + 100 popular tv, with `alternates.languages`; `revalidate` 86400
  - `robots()`: allow `/`, disallow `/*/search` and `/*/favorites`, point to the sitemap

- [ ] **Step 1: Write failing tests** — `buildMetadata({ locale: 'en', path: '/movie/550', … }).alternates.languages.vi === '{SITE_URL}/vi/movie/550'`; `movieJsonLd` for tv → `@type === 'TVSeries'`; `JsonLd` escapes `</script>`.
- [ ] **Step 2: Run → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Manual check** — `/sitemap.xml` and `/robots.txt` are valid; view-source of a Detail page shows `hreflang` and JSON-LD.
- [ ] **Step 6: Commit** — `git commit -m "feat(seo): add metadata helpers, sitemap, robots and JSON-LD"`

---

## Phase 5 — Quality & release

### Task 20: Playwright E2E

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/home-detail.spec.ts`, `trailer.spec.ts`, `search.spec.ts`, `discover.spec.ts`, `favorites-locale.spec.ts`
- Modify: `package.json` (`"e2e": "playwright test"`), add minimal `data-testid`s if needed (`media-card`, `hero`)

**Interfaces:**
- Config: `webServer: { command: 'pnpm build && pnpm start', port: 3000, reuseExistingServer: !process.env.CI }`; projects `chromium` and `mobile` (Pixel 7); `use.baseURL = 'http://localhost:3000'`.

- [ ] **Step 1: Install** — `pnpm add -D @playwright/test && pnpm exec playwright install chromium`
- [ ] **Step 2: Write the 5 scenarios from spec section 7.3.** Assertions check structure only (card count > 0, heading present, URL changed), never specific titles.
- [ ] **Step 2b: No horizontal scroll.** On Home, a list page and a Detail page, at 360px and 1280px viewports, assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.
- [ ] **Step 3: Run** — `pnpm e2e` (needs `TMDB_READ_TOKEN` in `.env.local`). Expected: 5 scenarios PASS on both projects. Also assert that `/vi/does-not-exist` returns HTTP 404 (guards against soft 404s).
- [ ] **Step 4: Commit** — `git commit -m "test(e2e): add Playwright smoke tests"`

### Task 21: CI, performance budget, README

**Files:**
- Modify: `.github/workflows/ci.yml` (the `check` job already exists — added early in issue #38 so every PR from Task 15 on is checked; the `e2e` job was added in Task 20)
- Create: `lighthouserc.json`, `.github/dependabot.yml`, `README.md` (Dependabot replaced the planned `renovate.json`, see below)

**Interfaces:**
- `ci.yml`: the existing job `check` (issue #38: `pull_request` + `push` to `main`; Node 24; `pnpm/action-setup`; `pnpm install --frozen-lockfile`; `lint` → `typecheck` → `test:coverage` → empty-token guard → `build` with `TMDB_READ_TOKEN: ${{ secrets.TMDB_READ_TOKEN }}`) stays. Job `e2e` (needs `check`; Playwright with `TMDB_READ_TOKEN: ${{ secrets.TMDB_READ_TOKEN }}`, report uploaded on failure) already exists since Task 20. Add job `lighthouse` (needs `check`) running `pnpm dlx @lhci/cli autorun`.
- App-level fail-fast env check at build time (a missing token must fail `pnpm build`, not only CI).
- `lighthouserc.json`: `startServerCommand: 'pnpm start'`; URLs `/vi`, `/vi/movie`, `/vi/movie/550`; mobile preset; assertions `categories:performance ≥ 0.9`, `categories:seo ≥ 1`, `categories:accessibility ≥ 0.95`, `resource-summary:script:size` `maxNumericValue: 153600`.
- ~~`renovate.json`~~ → **Dependabot** (`.github/dependabot.yml`): `npm` + `github-actions`, weekly Monday 06:00 Asia/Ho_Chi_Minh, `cooldown.default-days: 1`, minor/patch devDependencies grouped into one PR. Chosen over Renovate because it is built into GitHub (no app to install or grant repo access to), its config is one small file, and `cooldown` matches pnpm's `minimumReleaseAge`; Renovate's richer grouping/automerge is not needed for a single-maintainer portfolio repo.
- Lighthouse: `@lhci/cli` pinned as a devDependency (`pnpm lhci`), reports written to `.lighthouseci/` (filesystem, git-ignored, uploaded as a CI artifact), never to temporary public storage. Script budget as in Global Constraints (error 250KB, warn 200KB).
- README: description, screenshots, demo link, CI badge, `cp .env.example .env.local` + how to get a TMDB token, pnpm scripts, folder structure, TMDB attribution.

- [ ] **Step 1: Write the files above.**
- [ ] **Step 2: Run locally** — `pnpm build && pnpm dlx @lhci/cli autorun`. Expected: every assertion PASS. On failure fix the actual cause (hero image not prioritized, `"use client"` too broad, iframe loaded early…) instead of loosening the budget.
- [ ] **Step 3: Commit** — `git commit -m "ci: add Lighthouse job and Dependabot"` and `git commit -m "docs: rewrite README with screenshots"`
- [ ] **Step 4 (done by the user):** (the `TMDB_READ_TOKEN` repository secret already exists since issue #38) import the repo into Vercel and set `TMDB_READ_TOKEN` and `NEXT_PUBLIC_SITE_URL` (required for production: the build fails on `VERCEL_ENV=production` without it); add `TMDB_READ_TOKEN` again under Settings → Secrets and variables → **Dependabot** (Dependabot-triggered workflows cannot read Actions secrets, so the token guard and build would fail on every Dependabot PR); confirm CI is green and the preview deploy works.
