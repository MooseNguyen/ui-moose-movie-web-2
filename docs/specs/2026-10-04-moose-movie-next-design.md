# Moose Movie Next — Design Spec

- **Ngày:** 2026-10-04
- **Trạng thái:** Chờ review
- **Tham chiếu:** repo cũ `Moose-Movie-Web` (CRA + React 17, 2021–2023)

## 1. Mục tiêu & phạm vi

### 1.1 Mục tiêu
Xây lại ứng dụng duyệt phim/TV series "Moose Movie" bằng Next.js và stack hiện đại, làm **dự án portfolio** để học công nghệ mới và trình bày với nhà tuyển dụng. Giữ toàn bộ chức năng bản cũ, sửa các điểm yếu của bản cũ và bổ sung 4 tính năng mới.

### 1.2 Tiêu chí thành công
- Đầy đủ chức năng ở mục 4, deploy công khai trên Vercel.
- Lighthouse mobile: Performance ≥ 90, SEO = 100, Accessibility ≥ 95.
- Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1.
- First Load JS < 150KB (gzip) mỗi route (theo output `next build`).
- CI xanh: lint, typecheck, unit/component test, build, E2E.
- Coverage ≥ 80% cho `src/lib/` và `src/features/`.

### 1.3 Điểm yếu bản cũ cần khắc phục
| Vấn đề bản cũ | Cách giải quyết |
|---|---|
| CRA đã deprecated, không chạy được trên Node mới | Next.js 16 |
| SPA client-only, SEO kém | Server Components, `generateMetadata`, sitemap, JSON-LD |
| API key hardcode, lộ ở client | Read Access Token chỉ ở server (`server-only`) |
| Thao tác DOM thủ công (modal trailer, header) | React state + Radix Dialog |
| `movie.title \|\| movie.name` rải rác, không có kiểu | TypeScript + `MediaItem` chuẩn hoá |
| 5 iframe YouTube tải sẵn ở trang Detail | Lite embed: chỉ tải iframe khi bấm |
| Load More không reset page khi đổi category/search | State gắn với key danh sách, reset về trang 1 |
| Hero luôn link sang `/movie` | Link theo `mediaType` |
| Search bắt Enter trên toàn `document` | Form submit trong ô input |
| `className="null"` khi không truyền class | `cn()` (clsx + tailwind-merge) |
| Placeholder via.placeholder.com đã chết | SVG placeholder nội bộ |
| Không có test | Vitest + Testing Library + Playwright |

### 1.4 Tính năng mới
1. Favorites/Watchlist lưu localStorage.
2. Discover: lọc theo thể loại / năm / sắp xếp, filter lưu trên URL.
3. Trang diễn viên (Person).
4. Đa ngôn ngữ vi/en (UI + dữ liệu TMDB).

### 1.5 Ngoài phạm vi
Đăng nhập, database, bình luận/đánh giá của user, xem phim thật, PWA offline, đồng bộ TMDB account, trang chi tiết từng season/tập TV.

## 2. Tech stack

| Lớp | Công nghệ | Lý do chính |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | SSR/ISR cho SEO, chuẩn ngành, thay CRA |
| UI runtime | React 19 | Server Components, Server Actions, `useTransition` |
| Ngôn ngữ | TypeScript (strict) | Bắt lỗi dữ liệu TMDB lúc viết code |
| Styling | Tailwind CSS v4 | Zero-runtime, CSS chỉ gồm class đang dùng |
| Components | shadcn/ui (Radix) | Accessibility sẵn, code nằm trong repo |
| Theme | next-themes | Dark mặc định + Light, chống nháy màu |
| Carousel | Embla Carousel (+ Autoplay) | ~7KB, carousel chính thức của shadcn |
| i18n | next-intl | Hỗ trợ RSC, route `/[locale]`, hreflang |
| Validation | Zod (v4) | Validate response TMDB, env, URL params, input Server Action |
| Client state | Zustand + `persist` | Favorites, ~1KB |
| Lint/format | ESLint (flat config) + Prettier | |
| Test | Vitest, Testing Library, MSW, Playwright | |
| Deploy/CI | Vercel, GitHub Actions, Renovate/Dependabot | |

**Tiêu chí chọn (theo thứ tự ưu tiên):** (1) giải quyết đúng vấn đề bản cũ, (2) hiệu năng cho người dùng cuối, (3) tương thích RSC/Next.js 16, (4) giá trị học tập và trên CV, (5) độ trưởng thành và bảo trì, (6) chi phí bằng 0, (7) YAGNI.

## 3. Kiến trúc

### 3.1 Luồng dữ liệu
```
Browser ──> Next.js (Vercel)
             ├─ Server Components ──> lib/tmdb (fetch + cache + Zod) ──> api.themoviedb.org
             ├─ Server Actions (Tải thêm) ──> lib/tmdb
             └─ Client Components (carousel, trailer dialog, favorites, search box, filters)
Ảnh: <img>/next/image (unoptimized) ──> image.tmdb.org (size có sẵn của TMDB)
```
Token TMDB không bao giờ được gửi xuống client.

### 3.2 Cấu trúc thư mục
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
  proxy.ts                  # next-intl locale detection (Next.js 16 đổi tên middleware.ts → proxy.ts)
tests/
  fixtures/                 # JSON response mẫu từ TMDB
  e2e/                      # Playwright
```

### 3.3 Ranh giới Server / Client
- Mặc định là Server Component. `"use client"` chỉ đặt ở component lá có tương tác: `HeroSlider`, `MediaCarousel`, `TrailerDialog`, `VideoLiteEmbed`, `FavoriteButton`, `FavoritesView`, `LoadMoreGrid`, `SearchBox`, `DiscoverFilters`, `LocaleSwitcher`, `ThemeToggle`, `MobileNav`.
- Không đặt `"use client"` ở layout hoặc page.
- `TrailerDialog` được import động (`next/dynamic`), chỉ tải khi mở.

## 4. Chức năng chi tiết

### 4.0 Thành phần chung
- **Header:** logo; menu Home · Movies · TV Series · Discover · Favorites; icon search; LocaleSwitcher (vi/en); ThemeToggle. Trong suốt ở đầu trang, có nền khi cuộn > 80px. Mobile: menu trong `Sheet`. Mục đang active được highlight, kể cả route con.
- **Footer:** logo, link mạng xã hội, ghi nguồn TMDB kèm logo (bắt buộc theo điều khoản TMDB).
- **i18n:** route `/vi/...`, `/en/...`; mặc định `vi`; `/` tự chọn theo `Accept-Language`. Đổi ngôn ngữ giữ nguyên trang hiện tại. Map locale sang TMDB: `vi → vi-VN`, `en → en-US`.
- **Theme:** mặc định dark, có light; lưu lựa chọn của user.
- **Trạng thái:** mỗi route có `loading.tsx` (skeleton theo layout trang), `error.tsx` (thông báo + nút "Thử lại"), `not-found.tsx`.
- **MediaCard:** poster (placeholder nếu thiếu), tên, năm, điểm, FavoriteButton; link `/{locale}/{mediaType}/{id}`.

### 4.1 Home `/[locale]`
- **Hero slider:** 5 item từ `/trending/all/week` (chỉ lấy movie/tv). Autoplay 5s, dừng khi hover hoặc khi trailer đang mở. Có mũi tên, chấm điều hướng, vuốt trên mobile. Mỗi slide: backdrop, poster, tên, điểm, overview cắt 3 dòng, nút **Chi tiết**, **Trailer**, **Yêu thích**. Ảnh backdrop của slide đầu được ưu tiên tải.
- **6 carousel:** Trending Movies (`movie/popular`), Top Rated Movies, Upcoming Movies, Popular TV, Top Rated TV, On Air TV. Mỗi hàng có link "Xem tất cả" đến `/[mediaType]?list=...`.
- **Trailer:** Dialog chứa iframe YouTube, chỉ tạo khi mở; đóng bằng ESC / click ngoài / nút X; đóng thì gỡ iframe. Video lấy khi bấm (Server Action `getTrailer`). Không có trailer thì hiện thông báo "Chưa có trailer" trong dialog.
- Mỗi carousel stream độc lập qua `<Suspense>` + error boundary riêng.

### 4.2 Danh sách `/[locale]/[mediaType]`
- `mediaType ∈ {movie, tv}`, ngoài ra trả 404.
- Tab `?list=`:
  - movie: `popular` (mặc định) | `top_rated` | `upcoming` | `now_playing`
  - tv: `popular` (mặc định) | `top_rated` | `on_the_air` | `airing_today`
  - Giá trị sai → dùng mặc định.
- Grid: 2 cột (<640px), 3 (≥640), 4 (≥768), 5 (≥1024), 6 (≥1280).
- Trang 1 render ở server; "Tải thêm" gọi Server Action. Đổi tab → reset về trang 1 (component `LoadMoreGrid` có `key` theo tham số danh sách). Ẩn nút khi `page >= min(totalPages, 500)`. Loại item trùng `id`.

### 4.3 Search `/[locale]/search?q=&type=`
- `SearchBox` là `<form>`; submit (Enter/nút) chuyển đến URL search. Trim chuỗi; chuỗi rỗng không submit.
- `type ∈ {multi (mặc định), movie, tv, person}` hiển thị dạng tab.
- Kết quả person hiển thị `PersonCard` → `/person/[id]`.
- Có "Tải thêm"; trạng thái rỗng "Không tìm thấy kết quả cho '…'"; khi không có `q` thì hiện gợi ý nhập từ khoá.
- `noindex`.

### 4.4 Discover `/[locale]/discover`
- Tham số URL: `type` (movie|tv, mặc định movie), `genres` (danh sách id, phân cách dấu phẩy), `year` (1950..năm hiện tại), `sort`:
  - `popularity.desc` (mặc định), `vote_average.desc`, `primary_release_date.desc` (tv: `first_air_date.desc`), `title.asc` (tv: `name.asc`).
- Khi `sort = vote_average.desc` tự thêm `vote_count.gte=200`.
- `features/discover/params.ts` parse bằng Zod: giá trị không hợp lệ bị bỏ qua và dùng mặc định. `serialize(parse(x))` ổn định (round-trip).
- Danh sách thể loại từ `/genre/{type}/list` theo locale.
- Đổi filter → `router.push` URL mới (Back hoạt động), reset trang 1. Nút "Xoá bộ lọc". Có "Tải thêm".
- Link thể loại ở trang Detail → `/discover?type=...&genres=<id>`.

### 4.5 Detail `/[locale]/[mediaType]/[id]`
- Một request: `/{type}/{id}?append_to_response=credits,videos,recommendations,similar`.
- **Hero:** backdrop (mờ) làm nền, poster, tên (+ tên gốc nếu khác), tagline, overview, thể loại (link Discover), ngày phát hành, thời lượng (movie) hoặc số season/tập (tv), điểm + số vote, tối đa 3 studio, nút Trailer và Yêu thích.
- **Cast:** 12 người đầu, ảnh + tên + vai; link Person; carousel.
- **Video:** tối đa 6 video YouTube loại Trailer/Teaser, ưu tiên `official`; hiển thị thumbnail, bấm mới tải iframe (`VideoLiteEmbed`). Không có video thì ẩn section.
- **Liên quan:** carousel từ `recommendations`; rỗng thì dùng `similar`; cả hai rỗng thì ẩn section.
- **Fallback ngôn ngữ:** locale `vi` mà `overview` rỗng → gọi bản `en-US` lấy overview, hiển thị kèm nhãn "(English)".
- **SEO:** `generateMetadata` (title, description, OG image = backdrop `w1280`), JSON-LD `Movie` / `TVSeries`.
- TMDB 404 hoặc `id` không phải số nguyên dương → `notFound()`.

### 4.6 Person `/[locale]/person/[id]`
- Request: `/person/{id}?append_to_response=combined_credits`.
- Ảnh, tên, `known_for_department`, ngày sinh, nơi sinh, tuổi; ngày mất nếu có.
- Tiểu sử rút gọn + "Xem thêm"; bản `vi` rỗng → fallback `en` như Detail.
- Phim tham gia: `combined_credits.cast`, bỏ trùng theo `mediaType+id`, sắp xếp theo `popularity` giảm dần; lọc Tất cả | Phim | TV phía client.
- `generateMetadata` + JSON-LD `Person`. Không tồn tại → 404.

### 4.7 Favorites `/[locale]/favorites`
- Store Zustand, persist localStorage key `moose-favorites`, version 1.
- Mục lưu: `{ id, mediaType, title, posterPath, voteAverage, year, addedAt }` (đủ để hiển thị, không gọi API).
- API store: `toggle(item)`, `remove(mediaType, id)`, `clear()`, `isFavorite(mediaType, id)`. Khoá duy nhất là `mediaType+id`.
- `FavoriteButton` có ở MediaCard, Hero, Detail; dùng `aria-pressed`; cập nhật đồng bộ mọi nơi.
- Trang Favorites: sắp xếp theo `addedAt` giảm dần, lọc Movie | TV, xoá từng mục, "Xoá tất cả" (có AlertDialog xác nhận), trạng thái rỗng kèm link Discover.
- Không lệch hydration: chỉ đọc store sau khi mount (cờ `hasHydrated`); trước đó nút tim hiển thị trạng thái trung tính.
- Đồng bộ giữa nhiều tab qua sự kiện `storage`.
- localStorage không khả dụng → fallback bộ nhớ, hiển thị toast thông báo một lần.
- `noindex`.

### 4.8 SEO
- `generateMetadata` cho mọi trang; `alternates.languages` (hreflang) cho vi/en.
- `sitemap.ts`: trang tĩnh (Home, Movies, TV, Discover) × 2 locale + top 100 movie và top 100 tv popular.
- `robots.ts`: cho phép tất cả, chặn `/*/search` và `/*/favorites`.

### 4.9 Yêu cầu phi chức năng
- **Hiệu năng:** theo mục 1.2. Ảnh TMDB dùng size có sẵn (`w185` cast, `w342` card, `w780` poster detail, `w1280` backdrop), có `sizes`, lazy-load (trừ ảnh hero đầu tiên). Không dùng tối ưu ảnh của Vercel cho ảnh TMDB. Font qua `next/font`.
- **Accessibility:** điều hướng bàn phím, focus ring rõ, `alt` cho mọi ảnh, `aria-label` cho icon button, tương phản AA ở cả hai theme.
- **Responsive:** 360px–1920px, không có cuộn ngang.

## 5. Lớp dữ liệu

### 5.1 Env
`TMDB_READ_TOKEN` (bắt buộc) — validate bằng Zod trong `lib/env.ts`, thiếu thì báo lỗi rõ ràng. Có `.env.example`.

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
- Header `Authorization: Bearer ${TMDB_READ_TOKEN}`, tham số `language`.
- `AbortSignal.timeout(8000)`.
- `next: { revalidate, tags }`.
- Parse response bằng `schema`.
- Toàn bộ `lib/tmdb` có `import 'server-only'`.

### 5.3 Kiểu chuẩn hoá
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
`MediaDetail` (mở rộng `MediaItem`: tagline, genres, runtime | seasons/episodes, companies, cast, videos, related) và `PersonDetail` định nghĩa riêng.

Schema "dễ tính": field phụ dùng `.nullable().catch(null)`, mảng `.catch([])`; chỉ field cốt lõi (`id`, `results`, `page`) là bắt buộc.

### 5.4 Hàm public (`lib/tmdb/api.ts`)
`getTrending(locale)`, `getList(mediaType, list, page, locale)`, `getDetail(mediaType, id, locale)`, `getVideos(mediaType, id, locale)`, `search(type, q, page, locale)`, `discover(params, page, locale)`, `getGenres(mediaType, locale)`, `getPerson(id, locale)`, `getPopularIds(mediaType)` (cho sitemap).

### 5.5 Cache
| Dữ liệu | revalidate |
|---|---|
| Trending, danh sách | 3600s |
| Detail, Person, Videos | 86400s |
| Genres | 604800s |
| Search, Discover | 600s |

Trang Detail/Person: ISR theo yêu cầu (tạo khi có truy cập đầu tiên, `generateStaticParams` trả mảng rỗng).

### 5.6 Server Actions (`lib/actions/media.ts`)
`loadMoreList`, `loadMoreSearch`, `loadMoreDiscover`, `getTrailer`.
- Input validate bằng Zod: `page` 2..500, enum cho `mediaType`/`list`/`type`/`sort`, `q` 1..100 ký tự.
- Trả `{ ok: true, data } | { ok: false, error: 'invalid_input' | 'not_found' | 'rate_limit' | 'network' | 'unknown' }`, không throw.
- Client gọi qua `useTransition`; nút disable khi đang tải.

## 6. Xử lý lỗi
| Tình huống | Xử lý |
|---|---|
| TMDB 404 / tham số route không hợp lệ | `notFound()` |
| 429 | Chờ `Retry-After` (tối đa 2s), thử lại 1 lần; vẫn lỗi → như 5xx |
| 5xx, timeout, lỗi mạng | Ném `TmdbError(status, path)` → `error.tsx` có nút "Thử lại" (`reset()`) |
| Lỗi một carousel ở Home | Error boundary riêng; các phần khác vẫn hiển thị |
| Zod parse thất bại | Log server (path + issues) → như 5xx |
| Ảnh thiếu | SVG placeholder nội bộ |
| localStorage bị chặn | Store trong bộ nhớ + toast một lần |
| Không có trailer | Dialog hiển thị "Chưa có trailer" |
| Server Action lỗi | Thông báo dưới grid + nút "Thử lại", giữ nguyên item đã có |

Log tập trung trong `tmdbFetch`; không dùng `console.log` rải rác.

## 7. Test

### 7.1 Unit (Vitest)
- `normalize.ts`: movie/tv → `MediaItem`, thiếu ảnh, thiếu ngày.
- `schemas.ts`: fixtures thật trong `tests/fixtures/`, kể cả thiếu field.
- `client.ts` (MSW): header, `language`, 404, 429 retry, 5xx, timeout.
- `features/discover/params.ts`: parse giá trị sai, round-trip.
- `features/favorites/store.ts`: toggle, không trùng, sắp xếp, localStorage lỗi.
- `images.ts`: URL theo size, `null` → placeholder.
- Server Actions: input không hợp lệ → `invalid_input`, không gọi TMDB.

### 7.2 Component (Vitest + Testing Library)
`FavoriteButton`, `LoadMoreGrid`, `SearchBox`, `TrailerDialog`/`VideoLiteEmbed`, `DiscoverFilters`.

### 7.3 E2E (Playwright, TMDB thật, token từ GitHub Secrets)
1. Home → hero hiển thị → bấm một card → Detail có tên, cast.
2. Mở trailer → iframe xuất hiện → ESC đóng dialog.
3. Search "batman" → có kết quả → "Tải thêm" làm tăng số card.
4. Discover chọn thể loại → URL đổi → reload vẫn giữ filter.
5. Thêm favorite → `/favorites` có mục đó → reload vẫn còn; đổi vi/en giữ nguyên trang.

Assertion kiểm tra cấu trúc, không kiểm tra tên phim cụ thể.

### 7.4 Coverage
≥ 80% cho `src/lib/` và `src/features/`.

## 8. CI/CD
- GitHub Actions trên mỗi PR và push `main`: `lint` → `typecheck` → `vitest --coverage` → `next build` (kiểm tra First Load JS < 150KB) → Playwright trên bản build.
- Vercel: preview cho mỗi PR, production khi merge `main`. Env `TMDB_READ_TOKEN` cấu hình trên Vercel và GitHub Secrets.
- Renovate hoặc Dependabot cập nhật dependency hằng tuần.
- README: mô tả, ảnh chụp màn hình, link demo, badge CI, hướng dẫn chạy local, ghi nguồn TMDB.
