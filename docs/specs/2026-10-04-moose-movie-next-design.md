# Moose Movie Next — Design Spec

- **Date:** 2026-10-04
- **Status:** Approved
- **Reference:** the original `Moose-Movie-Web` repo (CRA + React 17, 2021–2023)

## 1. Goals & scope

### 1.1 Goal
Rebuild the "Moose Movie" movie/TV browsing app with Next.js and a modern stack as a **portfolio project**: learn current technology and show it to employers. Keep every feature of the original, fix its weaknesses, and add 4 new features.

### 1.2 Success criteria
- All features in section 4 implemented and publicly deployed on Vercel.
- Lighthouse mobile: Performance ≥ 90, SEO = 100, Accessibility ≥ 95.
- Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1.
- First Load JS < 150KB (gzip) per route.
- Green CI: lint, typecheck, unit/component tests, build, E2E.
- Coverage ≥ 80% for `src/lib/` and `src/features/`.

### 1.3 Weaknesses of the original to fix
| Original problem | Fix |
|---|---|
| CRA is deprecated and fails on modern Node | Next.js 16 |
| Client-only SPA, poor SEO | Server Components, `generateMetadata`, sitemap, JSON-LD |
| Hardcoded API key exposed to the client | Read Access Token on the server only (`server-only`) |
| Manual DOM manipulation (trailer modal, header) | React state + Radix Dialog |
| `movie.title \|\| movie.name` everywhere, no types | TypeScript + normalized `MediaItem` |
| 5 YouTube iframes loaded eagerly on the detail page | Lite embed: iframe loads only on click |
| Load More does not reset the page when category/search changes | State keyed by list, resets to page 1 |
| Hero always links to `/movie` | Link by `mediaType` |
| Search listens for Enter on the whole `document` | Form submit inside the input |
| `className="null"` when no class is passed | `cn()` (clsx + tailwind-merge) |
| via.placeholder.com is dead | Local SVG placeholders |
| No tests | Vitest + Testing Library + Playwright |

### 1.4 New features
1. Favorites/Watchlist stored in localStorage.
2. Discover: filter by genre / year / sort, with filters kept in the URL.
3. Person (actor) page.
4. Internationalization vi/en (UI + TMDB data).

### 1.5 Out of scope
Authentication, database, user comments/reviews, actual video streaming, offline PWA, TMDB account sync, per-season/per-episode TV pages.

## 2. Tech stack

| Layer | Technology | Main reason |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | SSR/ISR for SEO, industry standard, replaces CRA |
| UI runtime | React 19 | Server Components, Server Actions, `useTransition` |
| Language | TypeScript (strict) | Catch TMDB data errors while coding |
| Styling | Tailwind CSS v4 | Zero runtime, CSS contains only used classes |
| Components | shadcn/ui (Radix) | Accessibility built in, code lives in the repo |
| Theme | In-house theme module (server-rendered anti-flash script + `useSyncExternalStore` hook) | Dark by default + Light, no color flash; replaced next-themes (unmaintained, React 19 dev warning) |
| Carousel | Embla Carousel (+ Autoplay) | ~7KB, shadcn's official carousel |
| i18n | next-intl | RSC support, `/[locale]` routes, hreflang |
| Validation | Zod (v4) | Validate TMDB responses, env, URL params, Server Action input |
| Client state | Zustand + `persist` | Favorites, ~1KB |
| Lint/format | ESLint (flat config) + Prettier | |
| Testing | Vitest, Testing Library, MSW, Playwright | |
| Deploy/CI | Vercel, GitHub Actions, Renovate/Dependabot | |

**Selection criteria (in priority order):** (1) solves a concrete problem of the original, (2) end-user performance, (3) RSC / Next.js 16 compatibility, (4) learning and CV value, (5) maturity and maintenance, (6) zero cost, (7) YAGNI.

## 3. Architecture

### 3.1 Data flow
```
Browser ──> Next.js (Vercel)
             ├─ Server Components ──> lib/tmdb (fetch + cache + Zod) ──> api.themoviedb.org
             ├─ Server Actions (Load more) ──> lib/tmdb
             └─ Client Components (carousel, trailer dialog, favorites, search box, filters)
Images: <img>/next/image (unoptimized) ──> image.tmdb.org (TMDB's own sizes)
```
The TMDB token is never sent to the client.

### 3.2 Folder structure
```
src/
  app/
    [locale]/
      layout.tsx            # Header, Footer, providers (theme, intl)
      page.tsx              # Home
      loading.tsx, error.tsx, not-found.tsx
      [mediaType]/page.tsx          # /movie, /tv
      [mediaType]/[id]/page.tsx     # Detail
      search/page.tsx
      discover/page.tsx
      person/[id]/page.tsx
      favorites/page.tsx
    sitemap.ts
    robots.ts
  components/
    ui/                     # shadcn (button, dialog, sheet, select, carousel, tabs, skeleton...)
    layout/                 # Header, MobileNav, Footer, LocaleSwitcher, ThemeToggle
    media/                  # MediaCard, MediaGrid, MediaCarousel, HeroSlider, TrailerDialog,
                            # VideoLiteEmbed, CastList, PersonCard, LoadMoreGrid, SearchBox
  features/
    favorites/              # store.ts, FavoriteButton.tsx, FavoritesView.tsx
    discover/               # params.ts (parse/serialize URL), DiscoverFilters.tsx
  lib/
    env.ts
    utils.ts                # cn()
    tmdb/                   # client.ts, schemas.ts, normalize.ts, api.ts, images.ts, errors.ts
    actions/media.ts        # Server Actions
  i18n/                     # routing.ts, request.ts, navigation.ts
  messages/                 # vi.json, en.json
  proxy.ts                  # next-intl locale detection (Next.js 16 renamed middleware.ts → proxy.ts)
tests/
  fixtures/                 # sample TMDB JSON responses
  e2e/                      # Playwright
```

### 3.3 Server / Client boundary
- Server Component by default. `"use client"` only on interactive leaf components: `HeroSlider`, `MediaCarousel`, `TrailerDialog`, `VideoLiteEmbed`, `FavoriteButton`, `FavoritesView`, `LoadMoreGrid`, `SearchBox`, `DiscoverFilters`, `LocaleSwitcher`, `ThemeToggle`, `MobileNav`.
- Never put `"use client"` in a layout or page.
- `TrailerDialog` is imported dynamically (`next/dynamic`) and loads only when opened.

## 4. Features

### 4.0 Shared elements
- **Header:** logo; nav Home · Movies · TV Series · Discover · Favorites; search icon; LocaleSwitcher (vi/en); ThemeToggle. Transparent at the top, solid background after scrolling > 80px. Mobile: menu in a `Sheet`. The active item is highlighted, including nested routes.
- **Footer:** logo, social links, TMDB attribution with logo (required by TMDB's terms).
- **i18n:** routes `/vi/...`, `/en/...`; default `vi`; `/` picks a locale from `Accept-Language`. Switching locale keeps the current page. Locale → TMDB mapping: `vi → vi-VN`, `en → en-US`.
- **Theme:** dark by default, light available; the choice is remembered.
- **States:** every route has `loading.tsx` (skeleton matching the page layout), `error.tsx` (message + "Try again"), `not-found.tsx`.
- **MediaCard:** poster (placeholder when missing), title, year, rating, FavoriteButton; links to `/{locale}/{mediaType}/{id}`.

### 4.1 Home `/[locale]`
- **Hero slider:** 5 items from `/trending/all/week` (movie/tv only). Autoplay 5s, pauses on hover or while a trailer is open. Arrows, dots, swipe on mobile. Each slide: backdrop, poster, title, rating, overview clamped to 3 lines, **Details**, **Trailer**, **Favorite** buttons. The first slide's backdrop is loaded with priority.
- **6 carousels:** Trending Movies (`movie/popular`), Top Rated Movies, Upcoming Movies, Popular TV, Top Rated TV, On Air TV. Each row has a "See all" link to `/[mediaType]?list=...`.
- **Trailer:** a Dialog with a YouTube iframe, created only when opened; closes on ESC / outside click / X; closing removes the iframe. The video is fetched on click (Server Action `getTrailer`). Without a trailer the dialog shows "No trailer available".
- Each carousel streams independently via `<Suspense>` + its own error boundary.

### 4.2 Lists `/[locale]/[mediaType]`
- `mediaType ∈ {movie, tv}`, otherwise 404.
- Tab `?list=`:
  - movie: `popular` (default) | `top_rated` | `upcoming` | `now_playing`
  - tv: `popular` (default) | `top_rated` | `on_the_air` | `airing_today`
  - Invalid value → default.
- Grid: 2 columns (<640px), 3 (≥640), 4 (≥768), 5 (≥1024), 6 (≥1280).
- Page 1 renders on the server; "Load more" calls a Server Action. Changing tab resets to page 1 (`LoadMoreGrid` is keyed by the list params). Hide the button when `page >= min(totalPages, 500)`. Drop items with a duplicate `id`.

### 4.3 Search `/[locale]/search?q=&type=`
- `SearchBox` is a `<form>`; submit (Enter/button) navigates to the search URL. Input is trimmed; empty input does not submit.
- `type ∈ {multi (default), movie, tv, person}` shown as tabs.
- Person results render a `PersonCard` → `/person/[id]`.
- "Load more"; empty state "No results for '…'"; a prompt when `q` is missing.
- `noindex`.

### 4.4 Discover `/[locale]/discover`
- URL params: `type` (movie|tv, default movie), `genres` (comma-separated ids), `year` (1950..current year), `sort`:
  - `popularity.desc` (default), `vote_average.desc`, `release_date.desc`, `title.asc` — neutral keys mapped per type to TMDB (`primary_release_date.desc` / `first_air_date.desc`, `title.asc` / `name.asc`).
- When `sort = vote_average.desc`, add `vote_count.gte=200`.
- `features/discover/params.ts` parses with Zod: invalid values are ignored and fall back to defaults. `serialize(parse(x))` is stable (round-trip).
- Genre list from `/genre/{type}/list` in the current locale.
- Changing a filter → `router.push` to the new URL (Back works), resets to page 1. "Clear filters" button. "Load more".
- Genre links on the Detail page → `/discover?type=...&genres=<id>`.

### 4.5 Detail `/[locale]/[mediaType]/[id]`
- One request: `/{type}/{id}?append_to_response=credits,videos,recommendations,similar`.
- **Hero:** blurred backdrop background, poster, title (+ original title if different), tagline, overview, genres (link to Discover), release date, runtime (movie) or seasons/episodes (tv), rating + vote count, up to 3 studios, Trailer and Favorite buttons.
- **Cast:** first 12 people, photo + name + character; links to Person; carousel.
- **Videos:** up to 6 YouTube Trailer/Teaser videos, `official` first; thumbnail shown, iframe loads on click (`VideoLiteEmbed`). No videos → section hidden.
- **Related:** carousel from `recommendations`; if empty use `similar`; if both empty hide the section.
- **Language fallback:** locale `vi` with an empty `overview` → fetch the `en-US` version for the overview, shown with an "(English)" label.
- **SEO:** `generateMetadata` (title, description, OG image = `w1280` backdrop), JSON-LD `Movie` / `TVSeries`.
- TMDB 404 or an `id` that is not a positive integer → `notFound()`.

### 4.6 Person `/[locale]/person/[id]`
- Request: `/person/{id}?append_to_response=combined_credits`.
- Photo, name, `known_for_department`, birthday, place of birth, age; date of death if any.
- Biography clamped + "Show more"; empty `vi` biography → `en` fallback as on Detail.
- Credits: `combined_credits.cast`, deduped by `mediaType+id`, sorted by `popularity` descending; All | Movies | TV filter on the client.
- `generateMetadata` + JSON-LD `Person`. Not found → 404.

### 4.7 Favorites `/[locale]/favorites`
- Zustand store, persisted to localStorage key `moose-favorites`, version 1.
- Stored item: `{ id, mediaType, title, posterPath, voteAverage, year, addedAt }` (enough to render without any API call).
- Store API: `toggle(item)`, `remove(mediaType, id)`, `clear()`, `isFavorite(mediaType, id)`. Unique key is `mediaType+id`.
- `FavoriteButton` on MediaCard, Hero, Detail; uses `aria-pressed`; stays in sync everywhere.
- Favorites page: sorted by `addedAt` descending, Movie | TV filter, remove one, "Clear all" (AlertDialog confirmation), empty state with a link to Discover.
- No hydration mismatch: read the store only after mount (`hasHydrated` flag); before that the heart shows a neutral state.
- Cross-tab sync via the `storage` event.
- localStorage unavailable → in-memory fallback, one-time toast.
- `noindex`.

### 4.8 SEO
- `generateMetadata` on every page; `alternates.languages` (hreflang) for vi/en.
- `sitemap.ts`: static pages (Home, Movies, TV, Discover) × 2 locales + top 100 popular movies and top 100 popular TV shows.
- `robots.ts`: allow everything, disallow `/*/search` and `/*/favorites`.

### 4.9 Non-functional requirements
- **Performance:** per section 1.2. TMDB images use their native sizes (`w185` cast, `w342` card, `w780` detail poster, `w1280` backdrop), with `sizes` and lazy loading (except the first hero image). Do not use Vercel image optimization for TMDB images. Fonts via `next/font`.
- **Accessibility:** keyboard navigation, visible focus ring, `alt` on every image, `aria-label` on icon buttons, AA contrast in both themes.
- **Responsive:** 360px–1920px, no horizontal scroll.

## 5. Data layer

### 5.1 Env
`TMDB_READ_TOKEN` (required) — validated with Zod in `lib/env.ts`; missing → clear error. Ships with `.env.example`.

### 5.2 `tmdbFetch`
```ts
tmdbFetch<T>(path: string, opts: {
  params?: Record<string, string | number | undefined>;
  locale: 'vi' | 'en';
  revalidate: number;
  tags?: string[];
  schema: z.ZodType<T>;
}): Promise<T>
```
- Header `Authorization: Bearer ${TMDB_READ_TOKEN}`, `language` param.
- `AbortSignal.timeout(8000)`.
- `next: { revalidate, tags }`.
- Response parsed with `schema`.
- Every file in `lib/tmdb` starts with `import 'server-only'`.

### 5.3 Normalized types
```ts
type MediaType = 'movie' | 'tv';
type MediaItem = {
  id: number; mediaType: MediaType;
  title: string; originalTitle: string; overview: string;
  posterPath: string | null; backdropPath: string | null;
  year: number | null; voteAverage: number; voteCount: number; genreIds: number[];
};
type Paginated<T> = { items: T[]; page: number; totalPages: number };
```
`MediaDetail` (extends `MediaItem`: tagline, genres, runtime | seasons/episodes, companies, cast, videos, related) and `PersonDetail` are defined separately.

Lenient schemas: optional fields use `.nullable().catch(null)`, arrays `.catch([])`; only core fields (`id`, `results`, `page`) are required.

### 5.4 Public functions (`lib/tmdb/api.ts`)
`getTrending(locale)`, `getList(mediaType, list, page, locale)`, `getDetail(mediaType, id, locale)`, `getVideos(mediaType, id, locale)`, `search(type, q, page, locale)`, `discover(params, page, locale)`, `getGenres(mediaType, locale)`, `getPerson(id, locale)`, `getPopularIds(mediaType)` (for the sitemap).

### 5.5 Caching
| Data | revalidate |
|---|---|
| Trending, lists | 3600s |
| Detail, Person, Videos | 86400s |
| Genres | 604800s |
| Search, Discover | 600s |

Detail/Person pages: on-demand ISR (generated on first visit, `generateStaticParams` returns an empty array).

### 5.6 Server Actions (`lib/actions/media.ts`)
`loadMoreList`, `loadMoreSearch`, `loadMoreDiscover`, `getTrailer`.
- Input validated with Zod: `page` 2..500, enums for `mediaType`/`list`/`type`/`sort`, `q` 1..100 characters.
- Return `{ ok: true, data } | { ok: false, error: 'invalid_input' | 'not_found' | 'rate_limit' | 'network' | 'unknown' }`, never throw.
- Called from the client via `useTransition`; the button is disabled while loading.

## 6. Error handling
| Situation | Handling |
|---|---|
| TMDB 404 / invalid route params | `notFound()` |
| 429 | Wait for `Retry-After` (max 2s), retry once; still failing → treat as 5xx |
| 5xx, timeout, network error | Throw `TmdbError(status, path)` → `error.tsx` with a "Try again" button (`reset()`) |
| One carousel on Home fails | Its own error boundary; everything else still renders |
| Zod parse failure | Log on the server (path + issues) → treat as 5xx |
| Missing image | Local SVG placeholder |
| localStorage blocked | In-memory store + one-time toast |
| No trailer | Dialog shows "No trailer available" |
| Server Action error | Message below the grid + "Try again", existing items kept |

Logging is centralized in `tmdbFetch`; no scattered `console.log`.

## 7. Testing

### 7.1 Unit (Vitest)
- `normalize.ts`: movie/tv → `MediaItem`, missing images, missing dates.
- `schemas.ts`: real fixtures in `tests/fixtures/`, including missing fields.
- `client.ts` (MSW): headers, `language`, 404, 429 retry, 5xx, timeout.
- `features/discover/params.ts`: invalid values, round-trip.
- `features/favorites/store.ts`: toggle, no duplicates, sorting, localStorage failure.
- `images.ts`: URL per size, `null` → placeholder.
- Server Actions: invalid input → `invalid_input`, no TMDB call.

### 7.2 Component (Vitest + Testing Library)
`FavoriteButton`, `LoadMoreGrid`, `SearchBox`, `TrailerDialog`/`VideoLiteEmbed`, `DiscoverFilters`.

### 7.3 E2E (Playwright, real TMDB, token from GitHub Secrets)
1. Home → hero visible → click a card → Detail shows title and cast.
2. Open trailer → iframe appears → ESC closes the dialog.
3. Search "batman" → results → "Load more" increases the card count.
4. Discover: pick a genre → URL changes → reload keeps the filter.
5. Add a favorite → `/favorites` shows it → still there after reload; switching vi/en keeps the page.

Assertions check structure, not specific movie titles.

### 7.4 Coverage
≥ 80% for `src/lib/` and `src/features/`.

## 8. CI/CD
- GitHub Actions on every PR and push to `main`: `lint` → `typecheck` → `vitest --coverage` → `next build` → Lighthouse CI (First Load JS < 150KB) → Playwright against the build.
- Vercel: preview per PR, production on merge to `main`. Env `TMDB_READ_TOKEN` configured on Vercel and in GitHub Secrets.
- Renovate or Dependabot updates dependencies weekly.
- README: description, screenshots, demo link, CI badge, local setup, TMDB attribution.
