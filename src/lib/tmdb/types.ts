import 'server-only';
import type { MediaType } from './constants';

export type MediaItem = {
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  year: number | null;
  voteAverage: number;
  voteCount: number;
  genreIds: number[];
};

export type PersonSummary = {
  id: number;
  mediaType: 'person';
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
};

export type GridItem = MediaItem | PersonSummary;

export type Paginated<T> = { items: T[]; page: number; totalPages: number };

export type Genre = { id: number; name: string };

export type CastMember = {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
};

export type Video = {
  key: string;
  name: string;
  type: 'Trailer' | 'Teaser';
  official: boolean;
};

export type MediaDetail = MediaItem & {
  tagline: string | null;
  genres: Genre[];
  releaseDate: string | null;
  runtime: number | null;
  seasons: number | null;
  episodes: number | null;
  companies: string[];
  cast: CastMember[];
  videos: Video[];
  related: MediaItem[];
  overviewIsFallback: boolean;
};

export type PersonDetail = {
  id: number;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  biography: string;
  biographyIsFallback: boolean;
  credits: MediaItem[];
};
