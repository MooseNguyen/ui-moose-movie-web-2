# Moose Movie Next — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây ứng dụng duyệt phim/TV bằng Next.js 16 dùng dữ liệu TMDB, gồm Home, danh sách, Search, Discover, Detail, Person, Favorites, i18n vi/en, deploy được lên Vercel.

**Architecture:** Server-first: Server Components fetch TMDB qua `lib/tmdb` (server-only, cache bằng `fetch` revalidate, Zod validate, chuẩn hoá về `MediaItem`). Tương tác (slider, trailer, tải thêm, favorites, filter) là Client Components ở tầng lá; "Tải thêm" gọi Server Actions. next-intl điều khiển route `/[locale]`.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, next-themes, Embla Carousel, next-intl v4, Zod v4, Zustand v5, Vitest + Testing Library + MSW v2, Playwright, Lighthouse CI, GitHub Actions.

**Spec:** `docs/specs/2026-10-04-moose-movie-next-design.md`

## Global Constraints

- Package manager: **npm** (máy local không có pnpm). `engines.node` = `>=20.9`; CI dùng Node 24.
- TypeScript `strict: true`; alias `@/*` → `src/*`.
- Chỉ một biến môi trường bắt buộc: `TMDB_READ_TOKEN`. Tuỳ chọn: `NEXT_PUBLIC_SITE_URL` (mặc định `http://localhost:3000`).
- Mọi file trong `src/lib/tmdb/` có dòng đầu `import 'server-only';`. Token không bao giờ có tiền tố `NEXT_PUBLIC_`.
- Locale: `vi` (mặc định), `en`. Map sang TMDB: `vi → vi-VN`, `en → en-US`.
- Revalidate: danh sách/trending `3600`; detail/person/videos `86400`; genres `604800`; search/discover `600`.
- Giới hạn trang TMDB: `MAX_PAGE = 500`. Server Action nhận `page` trong `2..500`.
- Timeout fetch TMDB: `8000` ms. 429: chờ `Retry-After` tối đa `2000` ms, thử lại đúng 1 lần.
- Kích thước ảnh: cast `w185`, card `w342`, poster detail `w780`, backdrop `w1280`. `next.config` đặt `images.unoptimized: true` (không dùng tối ưu ảnh của Vercel).
- Placeholder ảnh là SVG nội bộ trong `public/` — không dùng dịch vụ ngoài.
- `"use client"` chỉ ở component lá có tương tác; không bao giờ ở `layout.tsx` hoặc `page.tsx`.
- Next.js 16: `params` và `searchParams` của page là `Promise` — luôn `await`. Middleware nằm ở `src/proxy.ts`.
- Theme: mặc định `dark`, có `light`, `enableSystem={false}`.
- Font: `next/font/google` **Be Vietnam Pro** (subset `latin`, `vietnamese`).
- Ngân sách: Lighthouse mobile Performance ≥ 0.9, SEO = 1, Accessibility ≥ 0.95; JS mỗi trang ≤ 150KB (đã nén).
- Coverage ≥ 80% (lines) cho `src/lib/**` và `src/features/**`.
- Discover `sort` trên URL dùng khoá trung tính `popularity.desc | vote_average.desc | release_date.desc | title.asc`, được map sang tham số TMDB theo loại (làm rõ mục 4.4 của spec).
- Mọi chuỗi UI nằm trong `src/messages/{vi,en}.json`; hai file có cùng tập key.
- Commit message theo Conventional Commits, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` khi do Claude tạo.

## Review Focus

1. **Ảnh/tên thiếu từ TMDB** (poster `null`, TV không có `first_air_date`, tên rỗng) → card vẫn hiển thị với placeholder và `year = null`, không crash. Test thuộc Task 3 và Task 8.
2. **Từ khoá search có dấu tiếng Việt / ký tự đặc biệt** (`người nhện`, `a/b`, `50%`) → URL được encode đúng, trang search nhận lại đúng chuỗi. Test thuộc Task 16.
3. **Search `multi` trả lẫn person và media** → person hiển thị `PersonCard`, media hiển thị `MediaCard`, item `mediaType` lạ bị bỏ. Test thuộc Task 3.
4. **localStorage chứa dữ liệu hỏng hoặc sai cấu trúc** cho key `moose-favorites` → store khởi động với danh sách rỗng, không crash. Test thuộc Task 9.
5. **Bấm "Tải thêm" liên tục hoặc đổi tab khi đang tải** → không gọi action trùng, không nối kết quả cũ vào danh sách mới. Test thuộc Task 11.

---

## Phase 0 — Nền móng

### Task 1: Scaffold dự án + công cụ test

**Files:**
- Create: toàn bộ scaffold của `create-next-app` (`package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `src/app/*`, `postcss.config.mjs`)
- Create: `.prettierrc`, `.env.example`, `vitest.config.mts`, `tests/setup.ts`, `tests/stubs/empty.ts`
- Create: `src/lib/env.ts`, `src/lib/utils.ts`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Produces: `getEnv(): { TMDB_READ_TOKEN: string; SITE_URL: string }` (parse một lần rồi cache; ném `Error` có chữ `TMDB_READ_TOKEN` khi thiếu); `resetEnvCache(): void` (chỉ cho test); `cn(...inputs: ClassValue[]): string`.
- Produces: lệnh `npm run test`, `npm run test:coverage`, `npm run typecheck`, `npm run lint`, `npm run format`.

- [ ] **Step 1: Scaffold**

Run trong `D:/MOOSE/Front-end/Projects/Moose-Movie-Next`:
`npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*" --use-npm --yes`
Nếu CLI từ chối vì thư mục không rỗng: scaffold vào thư mục tạm cạnh đó rồi chuyển toàn bộ file (trừ `.git`) vào đây.
Expected: `npm run dev` mở được trang mặc định ở `http://localhost:3000`.

- [ ] **Step 2: Cài dependency**

```bash
npm i zod server-only clsx tailwind-merge next-intl next-themes zustand embla-carousel-react embla-carousel-autoplay
npm i -D vitest @vitest/coverage-v8 @vitejs/plugin-react vite-tsconfig-paths jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom msw prettier prettier-plugin-tailwindcss
```

- [ ] **Step 3: Cấu hình**

- `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`, `"typecheck": "tsc --noEmit"`, `"format": "prettier --write ."`; `"engines": { "node": ">=20.9" }`.
- `vitest.config.mts`: plugins `react()`, `tsconfigPaths()`; `test.environment = 'jsdom'`; `setupFiles = ['tests/setup.ts']`; `exclude` thêm `tests/e2e/**`; `resolve.alias['server-only'] = 'tests/stubs/empty.ts'`; coverage `include: ['src/lib/**', 'src/features/**']`, `thresholds: { lines: 80 }`.
- `tests/setup.ts`: import `@testing-library/jest-dom/vitest`.
- `.prettierrc`: `singleQuote: true`, `semi: true`, `trailingComma: 'es5'`, `printWidth: 80`, plugin tailwind.
- `.env.example`: `TMDB_READ_TOKEN=` và `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
- `next.config.ts`: `images: { unoptimized: true, remotePatterns: [{ protocol: 'https', hostname: 'image.tmdb.org' }, { protocol: 'https', hostname: 'i.ytimg.com' }] }`.

- [ ] **Step 4: Viết test thất bại cho env**

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

- [ ] **Step 5: Chạy test để thấy fail**

Run: `npm run test -- src/lib/env.test.ts` — Expected: FAIL (module chưa tồn tại).

- [ ] **Step 6: Implement `getEnv`, `resetEnvCache` trong `src/lib/env.ts` (Zod `z.string().min(1)`; `SITE_URL` lấy `NEXT_PUBLIC_SITE_URL` nếu khác rỗng) và `cn` trong `src/lib/utils.ts` (`twMerge(clsx(inputs))`)**

- [ ] **Step 7: Xác minh**

Run: `npm run test && npm run typecheck && npm run lint` — Expected: tất cả PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app with Vitest, Prettier and env validation"
```

---

## Phase 1 — Lớp dữ liệu TMDB

### Task 2: `tmdbFetch` + `TmdbError`

**Files:**
- Create: `src/lib/tmdb/errors.ts`, `src/lib/tmdb/client.ts`, `src/lib/tmdb/constants.ts`
- Create: `tests/msw/server.ts` (MSW `setupServer()` dùng chung; `beforeAll/afterEach/afterAll` đăng ký trong `tests/setup.ts`, `onUnhandledRequest: 'error'`)
- Test: `src/lib/tmdb/client.test.ts`

**Interfaces:**
- Consumes: `getEnv()` (Task 1).
- Produces:
  - `type Locale = 'vi' | 'en'`; `type MediaType = 'movie' | 'tv'`
  - `constants.ts`: `TMDB_BASE_URL = 'https://api.themoviedb.org/3'`, `MAX_PAGE = 500`, `REVALIDATE = { list: 3600, detail: 86400, genres: 604800, search: 600 } as const`, `MOVIE_LISTS = ['popular','top_rated','upcoming','now_playing'] as const`, `TV_LISTS = ['popular','top_rated','on_the_air','airing_today'] as const`, `SEARCH_TYPES = ['multi','movie','tv','person'] as const`, `LOCALES = ['vi','en'] as const`.
  - `toTmdbLanguage(locale: Locale): 'vi-VN' | 'en-US'`
  - `class TmdbError extends Error { kind: 'not_found' | 'rate_limit' | 'network' | 'server' | 'invalid_response'; status: number | null; path: string }`
  - `tmdbFetch<T>(path: string, opts: { schema: z.ZodType<T>; locale?: Locale; params?: Record<string, string | number | undefined>; revalidate: number; tags?: string[]; timeoutMs?: number }): Promise<T>`

- [ ] **Step 1: Viết test thất bại** (MSW handler trên `https://api.themoviedb.org/3/*`)

```ts
it('sends bearer token and language, drops undefined params', async () => { /* handler ghi lại request */
  await tmdbFetch('/movie/popular', { schema: z.object({ page: z.number() }), locale: 'vi', params: { page: 2, region: undefined }, revalidate: 60 });
  expect(captured.headers.get('authorization')).toBe('Bearer test-token');
  expect(captured.url.searchParams.get('language')).toBe('vi-VN');
  expect(captured.url.searchParams.get('page')).toBe('2');
  expect(captured.url.searchParams.has('region')).toBe(false);
});
it('maps 404 to TmdbError kind not_found', /* expect rejects { kind: 'not_found', status: 404 } */);
it('retries once after 429 then succeeds', /* 429 + Retry-After: 0, rồi 200 → resolve; handler gọi đúng 2 lần */);
it('throws rate_limit when 429 repeats', /* 2 lần 429 → kind 'rate_limit'; gọi đúng 2 lần */);
it('maps 500 to kind server', ...);
it('maps timeout to kind network', /* handler delay 'infinite', timeoutMs: 50 */);
it('maps schema mismatch to kind invalid_response', /* body {page:'x'} */);
```

- [ ] **Step 2: Chạy test để thấy fail** — `npm run test -- src/lib/tmdb/client.test.ts` → FAIL.

- [ ] **Step 3: Implement** `tmdbFetch` trong `client.ts`: `fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs ?? 8000), next: { revalidate, tags } })`; chờ `min(Number(Retry-After)*1000, 2000)` trước khi thử lại; `schema.safeParse` — lỗi thì `console.error('[tmdb]', path, issues)` rồi ném `invalid_response`. Đây là chỗ log duy nhất của lớp dữ liệu.

- [ ] **Step 4: Chạy test để thấy pass** — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(tmdb): add typed tmdbFetch with timeout, retry and error mapping"`

### Task 3: Schemas, kiểu chuẩn hoá, ảnh

**Files:**
- Create: `src/lib/tmdb/types.ts`, `src/lib/tmdb/schemas.ts`, `src/lib/tmdb/normalize.ts`, `src/lib/tmdb/images.ts`
- Create: `public/placeholder-poster.svg`, `public/placeholder-profile.svg`, `public/placeholder-backdrop.svg`
- Create: `tests/fixtures/movie-popular.json`, `tv-popular.json`, `search-multi.json`, `movie-detail.json`, `tv-detail.json`, `person-detail.json` (response thật từ TMDB, có thể cắt bớt còn 3 item; thêm thủ công 1 item thiếu `poster_path` và 1 TV thiếu `first_air_date`)
- Test: `src/lib/tmdb/normalize.test.ts`, `src/lib/tmdb/images.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `MediaItem = { id: number; mediaType: MediaType; title: string; originalTitle: string; overview: string; posterPath: string | null; backdropPath: string | null; year: number | null; voteAverage: number; voteCount: number; genreIds: number[] }`
  - `PersonSummary = { id: number; mediaType: 'person'; name: string; profilePath: string | null; knownForDepartment: string | null }`
  - `GridItem = MediaItem | PersonSummary`
  - `Paginated<T> = { items: T[]; page: number; totalPages: number }` (`totalPages` đã kẹp ≤ `MAX_PAGE`)
  - `Genre = { id: number; name: string }`; `CastMember = { id: number; name: string; character: string; profilePath: string | null }`; `Video = { key: string; name: string; type: 'Trailer' | 'Teaser'; official: boolean }`
  - `MediaDetail = MediaItem & { tagline: string | null; genres: Genre[]; releaseDate: string | null; runtime: number | null; seasons: number | null; episodes: number | null; companies: string[]; cast: CastMember[]; videos: Video[]; related: MediaItem[]; overviewIsFallback: boolean }`
  - `PersonDetail = { id: number; name: string; profilePath: string | null; knownForDepartment: string | null; birthday: string | null; deathday: string | null; placeOfBirth: string | null; biography: string; biographyIsFallback: boolean; credits: MediaItem[] }`
- Produces (`schemas.ts`): `rawMovieSchema`, `rawTvSchema`, `rawMultiItemSchema`, `rawPersonSummarySchema`, `pageSchema(item)`, `rawMovieDetailSchema`, `rawTvDetailSchema`, `rawPersonDetailSchema`, `rawVideosSchema`, `rawGenresSchema`. Field phụ `.nullable().catch(null)`, mảng `.catch([])`, số `.catch(0)`, chuỗi `.catch('')`; bắt buộc: `id`, `page`, `results`, `total_pages`.
- Produces (`normalize.ts`):
  - `toMediaItem(raw: RawMovie | RawTv, mediaType: MediaType): MediaItem`
  - `toGridItems(raw: RawMultiItem[]): GridItem[]` — bỏ item `media_type` không thuộc movie/tv/person
  - `toPaginated<R, T>(raw: { page: number; total_pages: number; results: R[] }, map: (r: R[]) => T[]): Paginated<T>` — loại trùng `mediaType+id`, kẹp `totalPages` ≤ 500
  - `pickVideos(raw: RawVideo[]): Video[]` — chỉ `site === 'YouTube'`, `type` ∈ Trailer/Teaser, official trước, tối đa 6
  - `toMediaDetail(raw, mediaType, fallbackOverview?: string): MediaDetail` — cast 12 người đầu, companies 3, `related` = recommendations, rỗng thì similar
  - `toPersonDetail(raw, fallbackBiography?: string): PersonDetail` — credits từ `combined_credits.cast`, loại trùng, sắp xếp `popularity` giảm dần
- Produces (`images.ts`): `type ImageSize = 'w185' | 'w342' | 'w780' | 'w1280' | 'original'`; `tmdbImage(path: string | null, size: ImageSize, kind?: 'poster' | 'profile' | 'backdrop'): string` → `https://image.tmdb.org/t/p/{size}{path}` hoặc `/placeholder-{kind}.svg` (mặc định `poster`).

- [ ] **Step 1: Viết test thất bại**

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

- [ ] **Step 2: Chạy test để thấy fail** → FAIL.
- [ ] **Step 3: Implement theo các signature trên.** Kiểu `Raw*` lấy bằng `z.infer` từ schema.
- [ ] **Step 4: Chạy test để thấy pass** → PASS.
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
  - `parseDiscoverParams(sp: Record<string, string | string[] | undefined>, now?: Date): DiscoverParams` — giá trị sai → mặc định của field đó; `year` trong `1950..now.getFullYear()`; `genres` chỉ số nguyên dương, loại trùng, sắp xếp tăng dần
  - `serializeDiscoverParams(p: DiscoverParams): string` — query string bỏ field bằng mặc định, `genres` nối bằng dấu phẩy
  - `toTmdbDiscoverQuery(p: DiscoverParams): Record<string, string | number>` — movie: `release_date.desc → primary_release_date.desc`, `title.asc → title.asc`, year → `primary_release_year`; tv: `release_date.desc → first_air_date.desc`, `title.asc → name.asc`, year → `first_air_date_year`; `with_genres` nối dấu phẩy; `vote_average.desc` thêm `'vote_count.gte': 200`

- [ ] **Step 1: Viết test thất bại**

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

- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(discover): parse, serialize and map discover URL params"`

### Task 5: Các hàm API public

**Files:**
- Create: `src/lib/tmdb/api.ts`
- Test: `src/lib/tmdb/api.test.ts`

**Interfaces:**
- Consumes: `tmdbFetch`, schemas, normalize (Task 2–3), `toTmdbDiscoverQuery` (Task 4).
- Produces:
  - `getTrending(locale: Locale): Promise<MediaItem[]>` — `/trending/all/week`, chỉ movie/tv, 5 item đầu, `REVALIDATE.list`
  - `getList(mediaType: MediaType, list: string, page: number, locale: Locale): Promise<Paginated<MediaItem>>` — `/{mediaType}/{list}`
  - `getDetail(mediaType: MediaType, id: number, locale: Locale): Promise<MediaDetail>` — `append_to_response=credits,videos,recommendations,similar`; nếu `locale === 'vi'` và overview rỗng → gọi thêm `/{mediaType}/{id}` với `en` để lấy overview, `overviewIsFallback = true`
  - `getVideos(mediaType: MediaType, id: number, locale: Locale): Promise<Video[]>` — kèm `include_video_language={lang},en,null`
  - `search(type: SearchType, q: string, page: number, locale: Locale): Promise<Paginated<GridItem>>` — `/search/{type}`, `REVALIDATE.search`
  - `discover(p: DiscoverParams, page: number, locale: Locale): Promise<Paginated<MediaItem>>`
  - `getGenres(mediaType: MediaType, locale: Locale): Promise<Genre[]>`
  - `getPerson(id: number, locale: Locale): Promise<PersonDetail>` — `append_to_response=combined_credits`, fallback biography `en` giống `getDetail`
  - `getPopularIds(mediaType: MediaType): Promise<number[]>` — trang 1–5 của `popular` (100 id), locale `en`

- [ ] **Step 1: Viết test thất bại (MSW trả fixture)**

```ts
it('getTrending filters people and returns 5', ...);
it('getDetail fetches en overview when vi overview is empty', /* 2 request; overviewIsFallback true */);
it('getDetail does not refetch when overview present', /* 1 request */);
it('getDetail propagates not_found', /* 404 → TmdbError kind not_found */);
it('discover sends mapped query', /* kiểm tra searchParams sort_by, with_genres, vote_count.gte */);
it('search encodes Vietnamese query', /* q = 'người nhện' → searchParams.get('query') === 'người nhện' */);
```

- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(tmdb): add public API functions with locale fallback"`

### Task 6: Server Actions

**Files:**
- Create: `src/lib/actions/media.ts` (`'use server'`)
- Test: `src/lib/actions/media.test.ts`

**Interfaces:**
- Consumes: Task 4–5.
- Produces:
  - `type ActionError = 'invalid_input' | 'not_found' | 'rate_limit' | 'network' | 'unknown'`; `type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }`
  - `loadMoreList(base: { mediaType: MediaType; list: string; locale: Locale }, page: number): Promise<ActionResult<Paginated<MediaItem>>>`
  - `loadMoreSearch(base: { type: SearchType; q: string; locale: Locale }, page: number): Promise<ActionResult<Paginated<GridItem>>>`
  - `loadMoreDiscover(base: { query: string; locale: Locale }, page: number): Promise<ActionResult<Paginated<MediaItem>>>` — `query` là chuỗi từ `serializeDiscoverParams`, parse lại bằng `parseDiscoverParams`
  - `getTrailer(input: { mediaType: MediaType; id: number; locale: Locale }): Promise<ActionResult<Video | null>>`
  - Chữ ký `(base, page)` để client dùng `action.bind(null, base)` → `(page: number) => Promise<ActionResult<…>>`.
- Validate bằng Zod: `page` int 2..500; `list` thuộc `MOVIE_LISTS`/`TV_LISTS` theo `mediaType`; `type` thuộc `SEARCH_TYPES`; `q` trim 1..100 ký tự; `id` int dương; `locale` thuộc `LOCALES`. `TmdbError.kind` map sang `ActionError` (`server`/`invalid_response` → `unknown`). Không throw.

- [ ] **Step 1: Viết test thất bại**

```ts
it('rejects page 1 and 501 without calling TMDB', async () => {
  expect(await loadMoreList({ mediaType: 'movie', list: 'popular', locale: 'vi' }, 501)).toEqual({ ok: false, error: 'invalid_input' });
  expect(requestCount).toBe(0);
});
it('rejects tv list name on movie', /* list 'on_the_air' với movie → invalid_input */);
it('rejects empty/whitespace q', ...);
it('returns ok with data', ...);
it('maps 429 twice to rate_limit', ...);
it('getTrailer returns null when no videos', ...);
```

- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS; `npm run test:coverage` đạt ngưỡng 80%.**
- [ ] **Step 5: Commit** — `git commit -m "feat(actions): add validated load-more and trailer server actions"`

---

## Phase 2 — Khung ứng dụng

### Task 7: i18n, theme, layout chung

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/navigation.ts`, `src/i18n/request.ts`, `src/proxy.ts`
- Create: `src/messages/vi.json`, `src/messages/en.json`
- Create: `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx` (tạm: tiêu đề), `src/app/[locale]/loading.tsx`, `src/app/[locale]/error.tsx`, `src/app/[locale]/not-found.tsx`, `src/app/[locale]/[...rest]/page.tsx` (gọi `notFound()`)
- Create: `src/components/providers.tsx` (ThemeProvider + Toaster), `src/components/layout/Header.tsx`, `MobileNav.tsx`, `Footer.tsx`, `LocaleSwitcher.tsx`, `ThemeToggle.tsx`, `NavLinks.tsx`
- Create: `src/components/ui/*` qua `npx shadcn@latest init` rồi `npx shadcn@latest add button dialog alert-dialog sheet select tabs carousel skeleton sonner badge dropdown-menu`
- Create: `tests/utils/render.tsx`
- Delete: `src/app/page.tsx`, `src/app/layout.tsx` mặc định (thay bằng root layout tối thiểu nếu next-intl yêu cầu)
- Test: `src/messages/messages.test.ts`, `src/components/layout/NavLinks.test.tsx`

**Interfaces:**
- Produces:
  - `routing = defineRouting({ locales: ['vi', 'en'], defaultLocale: 'vi' })`; `Link`, `useRouter`, `usePathname`, `redirect` từ `createNavigation(routing)` trong `navigation.ts`
  - Namespace message: `common`, `nav`, `home`, `list`, `search`, `discover`, `detail`, `person`, `favorites`, `errors`, `footer`
  - `isActivePath(pathname: string, href: string): boolean` (export từ `NavLinks.tsx`) — `/` chỉ khớp chính xác; các href khác khớp chính nó và route con
  - `renderWithIntl(ui: ReactElement, locale?: Locale): RenderResult` trong `tests/utils/render.tsx` (bọc `NextIntlClientProvider` với messages thật)
- Layout: `<html lang={locale} suppressHydrationWarning>`, font Be Vietnam Pro, `setRequestLocale(locale)`, `generateStaticParams` trả về 2 locale; locale không hợp lệ → `notFound()`. Header trong suốt, thêm nền khi `scrollY > 80` (client `useEffect` + state, không dùng `classList`). Footer: dòng "This product uses the TMDB API but is not endorsed or certified by TMDB." kèm link `https://www.themoviedb.org` (logo TMDB tải thủ công từ trang attribution của TMDB vào `public/tmdb-logo.svg` nếu muốn). `error.tsx` là client component có nút gọi `reset()`.

- [ ] **Step 1: Viết test thất bại**

```ts
// messages.test.ts — tập key phẳng của vi.json và en.json phải bằng nhau
expect(flatKeys(vi)).toEqual(flatKeys(en));
// NavLinks.test.tsx
expect(isActivePath('/movie/123', '/movie')).toBe(true);
expect(isActivePath('/movie', '/')).toBe(false);
expect(isActivePath('/', '/')).toBe(true);
```

- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Kiểm tra thủ công** — `npm run dev`: `/` chuyển sang `/vi`; `/en` hiện chữ tiếng Anh; đổi ngôn ngữ giữ nguyên đường dẫn; đổi theme không nháy; `/vi/khong-ton-tai` ra trang 404; ở 360px menu nằm trong Sheet.
- [ ] **Step 6: Commit** — `git commit -m "feat(app): add i18n routing, theme, header, footer and route states"`

---

## Phase 3 — Component dùng chung

### Task 8: MediaCard, PersonCard, MediaGrid, MediaCarousel

**Files:**
- Create: `src/components/media/MediaCard.tsx`, `PersonCard.tsx`, `MediaGrid.tsx`, `GridItemCard.tsx`, `MediaCarousel.tsx`, `MediaRowSkeleton.tsx`, `ErrorBoundary.tsx`
- Test: `src/components/media/MediaCard.test.tsx`

**Interfaces:**
- Consumes: `MediaItem`, `PersonSummary`, `GridItem`, `tmdbImage` (Task 3); `Link` (Task 7).
- Produces:
  - `MediaCard({ item, priority?, action? }: { item: MediaItem; priority?: boolean; action?: ReactNode })` — Server Component; link `/{mediaType}/{id}`; ảnh `w342`, `alt = item.title`; hiện năm (ẩn nếu `null`) và điểm làm tròn 1 chữ số; `action` là slot cho `FavoriteButton`
  - `PersonCard({ person }: { person: PersonSummary })` — link `/person/{id}`, ảnh `w185` kiểu `profile`
  - `GridItemCard({ item }: { item: GridItem })` — chọn PersonCard hoặc MediaCard (slot `action` để trống; Task 9 gắn FavoriteButton vào)
  - `MediaGrid({ children })` — grid `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`
  - `MediaCarousel({ items }: { items: MediaItem[] })` — client, Embla qua shadcn `Carousel`, `slidesToScroll: 'auto'`, nút prev/next có `aria-label`
  - `ErrorBoundary({ fallback, children })` — client class component

- [ ] **Step 1: Viết test thất bại**

```ts
it('links to the right media type and shows placeholder when poster missing', () => {
  renderWithIntl(<MediaCard item={{ ...tvItem, posterPath: null, year: null }} />);
  expect(screen.getByRole('link')).toHaveAttribute('href', '/vi/tv/' + tvItem.id);
  expect(screen.getByRole('img')).toHaveAttribute('src', '/placeholder-poster.svg');
  expect(screen.queryByText('null')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): add media and person cards, grid and carousel"`

### Task 9: Favorites store + FavoriteButton

**Files:**
- Create: `src/features/favorites/store.ts`, `src/features/favorites/FavoriteButton.tsx`, `src/features/favorites/FavoritesHydrator.tsx`
- Modify: `src/components/providers.tsx` (render `<FavoritesHydrator />`)
- Modify: `src/components/media/GridItemCard.tsx` (truyền `FavoriteButton` vào slot `action`)
- Test: `src/features/favorites/store.test.ts`, `src/features/favorites/FavoriteButton.test.tsx`

**Interfaces:**
- Produces:
  - `type FavoriteItem = { id: number; mediaType: MediaType; title: string; posterPath: string | null; voteAverage: number; year: number | null; addedAt: number }`
  - `useFavorites` (Zustand + `persist`, `name: 'moose-favorites'`, `version: 1`, `skipHydration: true`, storage = `createJSONStorage(safeStorage)`) với state `{ items: FavoriteItem[]; hasHydrated: boolean; storageAvailable: boolean }` và action `toggle(item: Omit<FavoriteItem, 'addedAt'>)`, `remove(mediaType, id)`, `clear()`
  - `isFavorite(state, mediaType, id): boolean`; `selectSorted(state, filter: 'all' | MediaType): FavoriteItem[]` (mới nhất trước)
  - `safeStorage(): StateStorage` — dùng `localStorage` nếu đọc/ghi thử được, nếu không thì Map trong bộ nhớ và đặt `storageAvailable = false`
  - `FavoritesHydrator` — client; trong `useEffect` gọi `useFavorites.persist.rehydrate()`, lắng nghe sự kiện `storage` cho key `moose-favorites` để rehydrate lại, và toast một lần khi `storageAvailable === false`
  - `FavoriteButton({ item }: { item: Omit<FavoriteItem, 'addedAt'> })` — `aria-pressed`, `aria-label` theo `favorites.add` / `favorites.remove`; trước khi `hasHydrated` thì hiện trạng thái trung tính, `disabled`
- Persist `migrate`/`merge`: dữ liệu không đúng cấu trúc (parse bằng Zod) → `items: []`.

- [ ] **Step 1: Viết test thất bại**

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

- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(favorites): add persisted favorites store and button"`

### Task 10: TrailerButton/TrailerDialog + VideoLiteEmbed

**Files:**
- Create: `src/components/media/TrailerButton.tsx`, `TrailerDialog.tsx`, `VideoLiteEmbed.tsx`
- Test: `src/components/media/TrailerDialog.test.tsx`, `src/components/media/VideoLiteEmbed.test.tsx`

**Interfaces:**
- Consumes: `getTrailer` (Task 6), shadcn `Dialog`.
- Produces:
  - `TrailerButton({ mediaType, id, title, onOpenChange? }: { mediaType: MediaType; id: number; title: string; onOpenChange?: (open: boolean) => void })` — client; quản lý `open`; `TrailerDialog` được nạp bằng `next/dynamic` khi `open` lần đầu
  - `TrailerDialog({ mediaType, id, title, open, onOpenChange })` — khi mở thì gọi `getTrailer`; đang tải → Skeleton; có video → iframe `https://www.youtube-nocookie.com/embed/{key}?autoplay=1`, `title={title}`, tỉ lệ `aspect-video`; `data: null` → chữ `detail.noTrailer`; lỗi → `errors.generic` + nút thử lại. Khi đóng thì iframe bị gỡ khỏi DOM.
  - `VideoLiteEmbed({ video }: { video: Video })` — nút thumbnail `https://i.ytimg.com/vi/{key}/hqdefault.jpg` có `aria-label` = tên video; bấm mới render iframe

- [ ] **Step 1: Viết test thất bại**

```ts
it('renders no iframe until opened, removes it on close', ...);
it('shows no-trailer message when action returns null', /* vi.mock('@/lib/actions/media') */);
it('VideoLiteEmbed renders iframe only after click', ...);
```

- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): add lazy trailer dialog and lite YouTube embed"`

### Task 11: LoadMoreGrid

**Files:**
- Create: `src/components/media/LoadMoreGrid.tsx`
- Test: `src/components/media/LoadMoreGrid.test.tsx`

**Interfaces:**
- Consumes: `ActionResult`, `Paginated`, `GridItem` (Task 3, 6); `GridItemCard`, `MediaGrid` (Task 8).
- Produces: `LoadMoreGrid({ initial, loadMore }: { initial: Paginated<GridItem>; loadMore: (page: number) => Promise<ActionResult<Paginated<GridItem>>> })` — client; `useTransition`; nút disable khi `isPending`; nối item mới và loại trùng `mediaType+id`; ẩn nút khi `page >= totalPages`; lỗi → thông báo theo `errors.*` + nút thử lại, giữ item đã có. Trang cha bắt buộc truyền `key` (ví dụ `${list}` hoặc query string) để đổi danh sách là reset state. Bỏ qua kết quả về muộn bằng ref đếm request (`requestId`) để không nối kết quả cũ.

- [ ] **Step 1: Viết test thất bại**

```ts
it('appends next page and hides button on last page', ...);
it('does not call loadMore twice on rapid double click', async () => {
  await user.dblClick(screen.getByRole('button', { name: /tải thêm/i }));
  expect(loadMore).toHaveBeenCalledTimes(1);
});
it('shows retry on error and keeps existing items', ...);
it('dedupes items returned twice', ...);
it('ignores a response that resolves after unmount/rerender with new key', ...);
```

- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(ui): add load-more grid with dedupe and error retry"`

---

## Phase 4 — Các trang

Mỗi trang trong phase này: `params`/`searchParams` được `await`; gọi `setRequestLocale(locale)`; có `generateMetadata` dùng `buildMetadata` (Task 19 sẽ bổ sung hreflang — trước đó chỉ cần `title`, `description`). Xác minh thủ công bằng `npm run dev` và `npm run build` không lỗi.

### Task 12: Home

**Files:**
- Create: `src/app/[locale]/page.tsx` (thay bản tạm), `src/components/media/HeroSlider.tsx`, `src/components/media/MediaRow.tsx`
- Test: `src/components/media/HeroSlider.test.tsx`

**Interfaces:**
- Consumes: `getTrending`, `getList` (Task 5); `MediaCarousel`, `ErrorBoundary`, `MediaRowSkeleton` (Task 8); `TrailerButton` (Task 10); `FavoriteButton` (Task 9).
- Produces:
  - `HeroSlider({ items }: { items: MediaItem[] })` — client; Embla `loop`, plugin `Autoplay({ delay: 5000, stopOnMouseEnter: true, stopOnInteraction: false })`; dừng autoplay khi `TrailerButton.onOpenChange(true)`, chạy lại khi đóng; chấm điều hướng có `aria-label`; slide đầu ảnh `w1280` với `fetchPriority="high"`, các slide khác lazy; nút Chi tiết link `/{mediaType}/{id}` theo đúng loại; có `TrailerButton` và `FavoriteButton`.
  - `MediaRow({ title, href, mediaType, list, locale })` — Server Component async; render `MediaCarousel`; link "Xem tất cả" tới `/{mediaType}?list={list}`
- Page: `HeroSlider` + 6 `MediaRow` (movie: `popular`, `top_rated`, `upcoming`; tv: `popular`, `top_rated`, `on_the_air`), mỗi row bọc `<ErrorBoundary fallback={…}><Suspense fallback={<MediaRowSkeleton/>}>`.

- [ ] **Step 1: Viết test thất bại** — `HeroSlider` với item tv: nút Chi tiết có `href` `/vi/tv/{id}`; có đúng 5 chấm điều hướng.
- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Kiểm tra thủ công** — slider tự chạy 5s, dừng khi hover và khi mở trailer; ESC đóng trailer; trên DevTools chặn request tới `/tv/on_the_air` thì chỉ row đó hiện lỗi.
- [ ] **Step 6: Commit** — `git commit -m "feat(home): add hero slider and media rows"`

### Task 13: Trang danh sách `/[mediaType]`

**Files:**
- Create: `src/app/[locale]/[mediaType]/page.tsx`, `src/app/[locale]/[mediaType]/loading.tsx`, `src/components/media/ListTabs.tsx`
- Create: `src/lib/route-params.ts`
- Test: `src/lib/route-params.test.ts`

**Interfaces:**
- Produces (`route-params.ts`): `parseMediaType(v: string): MediaType | null`; `parseListName(mediaType: MediaType, v: string | undefined): string` (sai → `'popular'`); `parsePositiveId(v: string): number | null` (chỉ chuỗi số nguyên dương, không số 0 đứng đầu)
- Page: `mediaType` sai → `notFound()`; tab là `Link` đổi `?list=`; render `<LoadMoreGrid key={list} initial={…} loadMore={loadMoreList.bind(null, { mediaType, list, locale })} />`.

- [ ] **Step 1: Viết test thất bại** — `parseMediaType('anime') === null`; `parseListName('tv', 'upcoming') === 'popular'`; `parsePositiveId('12abc') === null`; `parsePositiveId('0') === null`; `parsePositiveId('550') === 550`.
- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Kiểm tra thủ công** — `/vi/movie?list=top_rated` đúng tab; "Tải thêm" nối thêm; đổi tab thì về lại trang 1; `/vi/anime` → 404.
- [ ] **Step 6: Commit** — `git commit -m "feat(list): add movie/tv list pages with tabs and load more"`

### Task 14: Detail `/[mediaType]/[id]`

**Files:**
- Create: `src/app/[locale]/[mediaType]/[id]/page.tsx`, `loading.tsx`
- Create: `src/components/detail/DetailHero.tsx`, `CastList.tsx`, `VideoList.tsx`
- Test: `src/components/detail/DetailHero.test.tsx`

**Interfaces:**
- Consumes: `getDetail` (Task 5); `parseMediaType`, `parsePositiveId` (Task 13); `TrailerButton`, `VideoLiteEmbed` (Task 10); `FavoriteButton` (Task 9); `MediaCarousel` (Task 8).
- Produces: `DetailHero({ detail }: { detail: MediaDetail })` — hiện tên gốc khi khác `title`; thể loại là `Link` tới `/discover?type={mediaType}&genres={id}`; movie hiện `runtime` dạng `Xh Ym`, tv hiện số season/tập; nhãn `(English)` khi `overviewIsFallback`. `CastList({ cast })`, `VideoList({ videos })` — ẩn section khi mảng rỗng.
- Page: `generateStaticParams` trả `[]`; `TmdbError.kind === 'not_found'` hoặc tham số sai → `notFound()`; `generateMetadata` dùng backdrop `w1280` làm ảnh OG. Hàm `getDetail` được bọc `React.cache` để metadata và page dùng chung một lần gọi.

- [ ] **Step 1: Viết test thất bại** — genre link có `href` `/vi/discover?type=movie&genres=28`; runtime 135 → `2h 15m`; TV hiện số season; `(English)` chỉ xuất hiện khi `overviewIsFallback`.
- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Kiểm tra thủ công** — `/vi/movie/550`, `/vi/tv/1399`, `/vi/movie/abc` (404), `/vi/movie/999999999` (404); Network tab: không có iframe YouTube nào trước khi bấm.
- [ ] **Step 6: Commit** — `git commit -m "feat(detail): add movie/tv detail page with cast, videos and related"`

### Task 15: Person `/person/[id]`

**Files:**
- Create: `src/app/[locale]/person/[id]/page.tsx`, `loading.tsx`, `src/components/person/PersonBio.tsx`, `src/components/person/PersonCredits.tsx`
- Test: `src/components/person/PersonCredits.test.tsx`, `src/components/person/age.test.ts`

**Interfaces:**
- Consumes: `getPerson` (Task 5), `parsePositiveId` (Task 13).
- Produces: `calcAge(birthday: string, deathday: string | null, now?: Date): number` (đặt trong `src/components/person/age.ts`); `PersonBio({ text, isFallback })` — client, rút gọn 6 dòng + nút "Xem thêm"/"Thu gọn" khi dài hơn 600 ký tự; `PersonCredits({ credits })` — client, tab Tất cả / Phim / TV lọc phía client.

- [ ] **Step 1: Viết test thất bại** — `calcAge('1990-10-05', null, new Date('2026-10-04')) === 35`; `calcAge('1950-01-01', '2000-06-01') === 50`; lọc "TV" chỉ còn item `mediaType === 'tv'`.
- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(person): add person page with bio and filmography"`

### Task 16: Search

**Files:**
- Create: `src/app/[locale]/search/page.tsx`, `src/components/media/SearchBox.tsx`
- Modify: `src/components/layout/Header.tsx` (thêm icon mở SearchBox)
- Test: `src/components/media/SearchBox.test.tsx`

**Interfaces:**
- Consumes: `search` (Task 5), `loadMoreSearch` (Task 6), `LoadMoreGrid` (Task 11).
- Produces: `SearchBox({ defaultValue?, type? }: { defaultValue?: string; type?: SearchType })` — client `<form role="search">`; submit gọi `router.push({ pathname: '/search', query: { q: trimmed, type } })` (để next-intl encode); chuỗi rỗng sau khi trim thì không push.
- Page: không có `q` → gợi ý nhập từ khoá; có `q` → tab `multi | movie | tv | person`; không có kết quả → `search.empty` kèm từ khoá; `LoadMoreGrid key={type + q}`; metadata `robots: { index: false }`.

- [ ] **Step 1: Viết test thất bại**

```ts
it('pushes encoded Vietnamese query on Enter', async () => {
  await user.type(screen.getByRole('searchbox'), '  người nhện {enter}');
  expect(push).toHaveBeenCalledWith({ pathname: '/search', query: { q: 'người nhện', type: 'multi' } });
});
it('does not push for whitespace only', ...);
it('Enter outside the input does nothing', /* keyup Enter trên document.body → push không được gọi */);
```

- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Kiểm tra thủ công** — tìm `người nhện`, `a/b`, `50%`: trang tải đúng và ô input hiện lại đúng chuỗi.
- [ ] **Step 6: Commit** — `git commit -m "feat(search): add multi-type search with load more"`

### Task 17: Discover

**Files:**
- Create: `src/app/[locale]/discover/page.tsx`, `src/features/discover/DiscoverFilters.tsx`
- Test: `src/features/discover/DiscoverFilters.test.tsx`

**Interfaces:**
- Consumes: `parseDiscoverParams`, `serializeDiscoverParams` (Task 4); `discover`, `getGenres` (Task 5); `loadMoreDiscover` (Task 6).
- Produces: `DiscoverFilters({ value, genres }: { value: DiscoverParams; genres: Genre[] })` — client; mỗi thay đổi gọi `router.push('/discover?' + serializeDiscoverParams(next))`; đổi `type` thì xoá `genres`; nút thể loại là toggle có `aria-pressed`; Select năm từ năm hiện tại về 1950; nút "Xoá bộ lọc" push `/discover`.
- Page: `LoadMoreGrid key={serializeDiscoverParams(value)} loadMore={loadMoreDiscover.bind(null, { query, locale })}`.

- [ ] **Step 1: Viết test thất bại** — bấm genre 28 khi đang chọn `[12]` → push `/discover?genres=12,28`; đổi type sang tv → push `/discover?type=tv`; "Xoá bộ lọc" → push `/discover`.
- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Commit** — `git commit -m "feat(discover): add URL-driven discover filters"`

### Task 18: Trang Favorites

**Files:**
- Create: `src/app/[locale]/favorites/page.tsx`, `src/features/favorites/FavoritesView.tsx`
- Test: `src/features/favorites/FavoritesView.test.tsx`

**Interfaces:**
- Consumes: `useFavorites`, `selectSorted` (Task 9); `MediaGrid`, `MediaCard` (Task 8). `FavoriteItem` được đổi sang `MediaItem` cho card (`overview: ''`, `originalTitle: title`, `backdropPath: null`, `voteCount: 0`, `genreIds: []`).
- Produces: `FavoritesView()` — client; trước khi hydrate hiện skeleton; tab Tất cả/Phim/TV; nút xoá từng mục; "Xoá tất cả" qua `AlertDialog`; danh sách rỗng → lời nhắc + link `/discover`. Page: metadata `robots: { index: false }`.

- [ ] **Step 1: Viết test thất bại** — rỗng hiện link `/vi/discover`; "Xoá tất cả" chỉ xoá sau khi xác nhận; tab TV chỉ hiện item tv.
- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Kiểm tra thủ công** — mở 2 tab, thêm favorite ở tab A thì tab B cập nhật; chế độ ẩn danh vẫn dùng được.
- [ ] **Step 6: Commit** — `git commit -m "feat(favorites): add favorites page"`

### Task 19: SEO

**Files:**
- Create: `src/lib/seo.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/components/JsonLd.tsx`
- Modify: `generateMetadata` của mọi page (dùng `buildMetadata`); page Detail và Person render `<JsonLd>`
- Test: `src/lib/seo.test.ts`

**Interfaces:**
- Consumes: `getEnv().SITE_URL` (Task 1); `getPopularIds` (Task 5).
- Produces:
  - `buildMetadata({ locale, path, title, description, image?, noIndex? }): Metadata` — `alternates.canonical = {SITE_URL}/{locale}{path}`, `alternates.languages = { vi: …, en: …, 'x-default': {SITE_URL}/vi{path} }`, `openGraph` + `twitter` (`summary_large_image`) khi có `image`
  - `movieJsonLd(detail: MediaDetail, url: string)` (`@type` = `Movie` hoặc `TVSeries`, kèm `aggregateRating` khi `voteCount > 0`); `personJsonLd(person: PersonDetail, url: string)`
  - `JsonLd({ data })` — `<script type="application/ld+json">`, thay `<` thành `\u003c` để an toàn
  - `sitemap()`: `/`, `/movie`, `/tv`, `/discover` × 2 locale + 100 movie + 100 tv popular, có `alternates.languages`; `revalidate` 86400
  - `robots()`: cho phép `/`, chặn `/*/search` và `/*/favorites`, trỏ tới sitemap

- [ ] **Step 1: Viết test thất bại** — `buildMetadata({ locale: 'en', path: '/movie/550', … }).alternates.languages.vi === '{SITE_URL}/vi/movie/550'`; `movieJsonLd` với tv → `@type === 'TVSeries'`; `JsonLd` escape `</script>`.
- [ ] **Step 2: Chạy → FAIL.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Chạy → PASS.**
- [ ] **Step 5: Kiểm tra thủ công** — `/sitemap.xml`, `/robots.txt` hợp lệ; view-source trang Detail có `hreflang` và JSON-LD.
- [ ] **Step 6: Commit** — `git commit -m "feat(seo): add metadata helpers, sitemap, robots and JSON-LD"`

---

## Phase 5 — Chất lượng & phát hành

### Task 20: E2E Playwright

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/home-detail.spec.ts`, `trailer.spec.ts`, `search.spec.ts`, `discover.spec.ts`, `favorites-locale.spec.ts`
- Modify: `package.json` (`"e2e": "playwright test"`), thêm `data-testid` tối thiểu nếu cần (`media-card`, `hero`)

**Interfaces:**
- Config: `webServer: { command: 'npm run build && npm run start', port: 3000, reuseExistingServer: !process.env.CI }`; project `chromium` và `mobile` (Pixel 7); `use.baseURL = 'http://localhost:3000'`.

- [ ] **Step 1: Cài** — `npm i -D @playwright/test && npx playwright install chromium`
- [ ] **Step 2: Viết 5 kịch bản theo spec mục 7.3.** Assertion chỉ kiểm tra cấu trúc (số card > 0, có heading, URL đổi), không kiểm tra tên phim cụ thể.
- [ ] **Step 3: Chạy** — `npm run e2e` (cần `TMDB_READ_TOKEN` trong `.env.local`). Expected: 5 kịch bản PASS trên cả 2 project.
- [ ] **Step 4: Commit** — `git commit -m "test(e2e): add Playwright smoke tests"`

### Task 21: CI, ngân sách hiệu năng, README

**Files:**
- Create: `.github/workflows/ci.yml`, `lighthouserc.json`, `renovate.json`, `README.md`

**Interfaces:**
- `ci.yml` (trigger: `pull_request`, `push` lên `main`; Node 24; `npm ci`): job `check` chạy `lint` → `typecheck` → `test:coverage` → `build`; job `e2e` (needs `check`) chạy Playwright với `TMDB_READ_TOKEN: ${{ secrets.TMDB_READ_TOKEN }}`, upload report khi fail; job `lighthouse` (needs `check`) chạy `npx @lhci/cli autorun`.
- `lighthouserc.json`: `startServerCommand: 'npm run start'`; URL `/vi`, `/vi/movie`, `/vi/movie/550`; preset mobile; assertions `categories:performance ≥ 0.9`, `categories:seo ≥ 1`, `categories:accessibility ≥ 0.95`, `resource-summary:script:size` `maxNumericValue: 153600`.
- `renovate.json`: `extends: ['config:recommended']`, `schedule: ['before 6am on monday']`, gộp các devDependency minor/patch.
- README: mô tả, ảnh chụp màn hình, link demo, badge CI, `cp .env.example .env.local` + lấy token tại TMDB, các lệnh npm, cấu trúc thư mục, dòng ghi nguồn TMDB.

- [ ] **Step 1: Viết các file trên.**
- [ ] **Step 2: Chạy local** — `npm run build && npx @lhci/cli autorun`. Expected: mọi assertion PASS. Nếu fail, sửa đúng nguyên nhân (ảnh hero chưa ưu tiên, `"use client"` quá rộng, iframe tải sớm…) chứ không nới ngân sách.
- [ ] **Step 3: Commit** — `git commit -m "ci: add CI workflow, Lighthouse budgets, Renovate and README"`
- [ ] **Step 4 (người dùng tự làm):** tạo repo GitHub, push; thêm secret `TMDB_READ_TOKEN`; import repo vào Vercel, đặt env `TMDB_READ_TOKEN` và `NEXT_PUBLIC_SITE_URL`; xác nhận CI xanh và preview deploy chạy.
