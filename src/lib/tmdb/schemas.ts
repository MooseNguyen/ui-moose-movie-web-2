import 'server-only';
import { z } from 'zod';

const str = () => z.string().catch('');
const num = () => z.number().catch(0);
const nullableStr = () => z.string().nullable().catch(null);
const nullableNum = () => z.number().nullable().catch(null);

export const rawMovieSchema = z.object({
  id: z.number(),
  title: str(),
  original_title: str(),
  overview: str(),
  poster_path: nullableStr(),
  backdrop_path: nullableStr(),
  release_date: nullableStr(),
  vote_average: num(),
  vote_count: num(),
  genre_ids: z.array(z.number()).catch([]),
});

export const rawTvSchema = z.object({
  id: z.number(),
  name: str(),
  original_name: str(),
  overview: str(),
  poster_path: nullableStr(),
  backdrop_path: nullableStr(),
  first_air_date: nullableStr(),
  vote_average: num(),
  vote_count: num(),
  genre_ids: z.array(z.number()).catch([]),
});

export const rawPersonSummarySchema = z.object({
  id: z.number(),
  name: str(),
  profile_path: nullableStr(),
  known_for_department: nullableStr(),
});

// A multi-search result or a person credit: movie, tv and person fields in one shape,
// discriminated by `media_type`.
export const rawMultiItemSchema = z.object({
  ...rawMovieSchema.shape,
  ...rawTvSchema.shape,
  ...rawPersonSummarySchema.shape,
  media_type: str(),
  popularity: num(),
});

export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    page: z.number(),
    total_pages: z.number(),
    total_results: num(),
    results: z.array(item),
  });

export const rawGenreSchema = z.object({ id: z.number(), name: str() });
export const rawGenresSchema = z.object({
  genres: z.array(rawGenreSchema).catch([]),
});

export const rawVideoSchema = z.object({
  key: str(),
  name: str(),
  site: str(),
  type: str(),
  official: z.boolean().catch(false),
});
export const rawVideosSchema = z.object({
  results: z.array(rawVideoSchema).catch([]),
});

const rawCastSchema = z.object({
  id: z.number(),
  name: str(),
  character: str(),
  profile_path: nullableStr(),
});

const rawCompanySchema = z.object({ name: str() });

const related = <T extends z.ZodType>(item: T) =>
  z.object({ results: z.array(item).catch([]) }).catch({ results: [] });

const detailExtras = {
  tagline: nullableStr(),
  genres: z.array(rawGenreSchema).catch([]),
  production_companies: z.array(rawCompanySchema).catch([]),
  credits: z
    .object({ cast: z.array(rawCastSchema).catch([]) })
    .catch({ cast: [] }),
  videos: rawVideosSchema.catch({ results: [] }),
};

export const rawMovieDetailSchema = rawMovieSchema.extend({
  ...detailExtras,
  runtime: nullableNum(),
  recommendations: related(rawMovieSchema),
  similar: related(rawMovieSchema),
});

export const rawTvDetailSchema = rawTvSchema.extend({
  ...detailExtras,
  episode_run_time: z.array(z.number()).catch([]),
  number_of_seasons: nullableNum(),
  number_of_episodes: nullableNum(),
  recommendations: related(rawTvSchema),
  similar: related(rawTvSchema),
});

export const rawPersonDetailSchema = rawPersonSummarySchema.extend({
  birthday: nullableStr(),
  deathday: nullableStr(),
  place_of_birth: nullableStr(),
  biography: str(),
  combined_credits: z
    .object({ cast: z.array(rawMultiItemSchema).catch([]) })
    .catch({ cast: [] }),
});

export type RawMovie = z.infer<typeof rawMovieSchema>;
export type RawTv = z.infer<typeof rawTvSchema>;
export type RawMultiItem = z.infer<typeof rawMultiItemSchema>;
export type RawVideo = z.infer<typeof rawVideoSchema>;
export type RawMovieDetail = z.infer<typeof rawMovieDetailSchema>;
export type RawTvDetail = z.infer<typeof rawTvDetailSchema>;
export type RawPersonDetail = z.infer<typeof rawPersonDetailSchema>;
