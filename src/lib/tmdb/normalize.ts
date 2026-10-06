import 'server-only';
import { MAX_PAGE, type MediaType } from './constants';
import type {
  RawMovie,
  RawMovieDetail,
  RawMultiItem,
  RawPersonDetail,
  RawTv,
  RawTvDetail,
  RawVideo,
} from './schemas';
import type {
  CastMember,
  GridItem,
  MediaDetail,
  MediaItem,
  Paginated,
  PersonDetail,
  Video,
} from './types';

const MAX_VIDEOS = 6;
const MAX_CAST = 12;
const MAX_COMPANIES = 3;

function toYear(date: string | null): number | null {
  const match = /^(\d{4})/.exec(date ?? '');
  const year = match ? Number.parseInt(match[1], 10) : 0;
  return year > 0 ? year : null;
}

// Multi-search results and person credits carry both movie and tv fields,
// so the caller's mediaType (not the object's shape) decides which ones to read.
function pickTexts(raw: RawMovie | RawTv, mediaType: MediaType) {
  if (mediaType === 'tv' && 'name' in raw) {
    return {
      title: raw.name,
      originalTitle: raw.original_name,
      date: raw.first_air_date,
    };
  }
  if ('title' in raw) {
    return {
      title: raw.title,
      originalTitle: raw.original_title,
      date: raw.release_date,
    };
  }
  return { title: '', originalTitle: '', date: null };
}

export function toMediaItem(
  raw: RawMovie | RawTv,
  mediaType: MediaType
): MediaItem {
  const { title, originalTitle, date } = pickTexts(raw, mediaType);
  return {
    id: raw.id,
    mediaType,
    title,
    originalTitle,
    overview: raw.overview,
    posterPath: raw.poster_path,
    backdropPath: raw.backdrop_path,
    year: toYear(date),
    voteAverage: raw.vote_average,
    voteCount: raw.vote_count,
    genreIds: raw.genre_ids,
  };
}

export function toGridItems(raw: RawMultiItem[]): GridItem[] {
  const items: GridItem[] = [];
  for (const r of raw) {
    if (r.media_type === 'movie' || r.media_type === 'tv') {
      items.push(toMediaItem(r, r.media_type));
    } else if (r.media_type === 'person') {
      items.push({
        id: r.id,
        mediaType: 'person',
        name: r.name,
        profilePath: r.profile_path,
        knownForDepartment: r.known_for_department,
      });
    }
  }
  return items;
}

function dedupe<T extends { id: number; mediaType: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.mediaType}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function toPaginated<R, T extends { id: number; mediaType: string }>(
  raw: { page: number; total_pages: number; results: R[] },
  map: (results: R[]) => T[]
): Paginated<T> {
  return {
    items: dedupe(map(raw.results)),
    page: raw.page,
    totalPages: Math.min(raw.total_pages, MAX_PAGE),
  };
}

export function pickVideos(raw: RawVideo[]): Video[] {
  const videos: Video[] = [];
  for (const v of raw) {
    if (v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) {
      videos.push({
        key: v.key,
        name: v.name,
        type: v.type,
        official: v.official,
      });
    }
  }
  // Array#sort is stable, so TMDB's order is kept within each group.
  return videos
    .sort((a, b) => Number(b.official) - Number(a.official))
    .slice(0, MAX_VIDEOS);
}

export function toMediaDetail(
  raw: RawMovieDetail | RawTvDetail,
  mediaType: MediaType,
  fallbackOverview?: string
): MediaDetail {
  // 'in' only narrows the type; mediaType decides which fields apply.
  const movieRaw = mediaType === 'movie' && 'runtime' in raw ? raw : null;
  const tvRaw = mediaType === 'tv' && 'episode_run_time' in raw ? raw : null;
  const base = toMediaItem(raw, mediaType);
  const useFallback = raw.overview.trim() === '' && !!fallbackOverview;
  const recommendations = raw.recommendations.results;
  const relatedRaw =
    recommendations.length > 0 ? recommendations : raw.similar.results;
  const cast: CastMember[] = raw.credits.cast.slice(0, MAX_CAST).map((c) => ({
    id: c.id,
    name: c.name,
    character: c.character,
    profilePath: c.profile_path,
  }));

  return {
    ...base,
    overview: useFallback ? fallbackOverview : base.overview,
    overviewIsFallback: useFallback,
    tagline: raw.tagline || null,
    genres: raw.genres,
    releaseDate: pickTexts(raw, mediaType).date || null,
    runtime: movieRaw ? movieRaw.runtime : (tvRaw?.episode_run_time[0] ?? null),
    seasons: tvRaw ? tvRaw.number_of_seasons : null,
    episodes: tvRaw ? tvRaw.number_of_episodes : null,
    companies: raw.production_companies
      .slice(0, MAX_COMPANIES)
      .map((c) => c.name),
    cast,
    videos: pickVideos(raw.videos.results),
    related: relatedRaw.map((r) => toMediaItem(r, mediaType)),
  };
}

export function toPersonDetail(
  raw: RawPersonDetail,
  fallbackBiography?: string
): PersonDetail {
  const useFallback = raw.biography.trim() === '' && !!fallbackBiography;
  const credits = raw.combined_credits.cast
    .filter((c) => c.media_type === 'movie' || c.media_type === 'tv')
    .map((c) => ({
      popularity: c.popularity,
      item: toMediaItem(c, c.media_type === 'tv' ? 'tv' : 'movie'),
    }));
  const sorted = credits
    .sort((a, b) => b.popularity - a.popularity)
    .map((c) => c.item);

  return {
    id: raw.id,
    name: raw.name,
    profilePath: raw.profile_path,
    knownForDepartment: raw.known_for_department,
    birthday: raw.birthday,
    deathday: raw.deathday,
    placeOfBirth: raw.place_of_birth,
    biography: useFallback ? fallbackBiography : raw.biography,
    biographyIsFallback: useFallback,
    credits: dedupe(sorted),
  };
}
