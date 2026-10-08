import type { MediaDetail, MediaItem, PersonSummary } from '@/lib/tmdb/types';

export const tvItem: MediaItem = {
  id: 1399,
  mediaType: 'tv',
  title: 'Game of Thrones',
  originalTitle: 'Game of Thrones',
  overview: 'Seven noble families fight for control of Westeros.',
  posterPath: '/poster.jpg',
  backdropPath: null,
  year: 2011,
  voteAverage: 7.3456,
  voteCount: 1200,
  genreIds: [18],
};

export const person: PersonSummary = {
  id: 287,
  mediaType: 'person',
  name: 'Brad Pitt',
  profilePath: null,
  knownForDepartment: 'Acting',
};

export const movieDetail: MediaDetail = {
  id: 550,
  mediaType: 'movie',
  title: 'Fight Club',
  originalTitle: 'Fight Club',
  overview: 'An insomniac office worker forms an underground fight club.',
  posterPath: '/poster550.jpg',
  backdropPath: '/backdrop550.jpg',
  year: 1999,
  voteAverage: 8.438,
  voteCount: 30000,
  genreIds: [28, 18],
  tagline: 'Mischief. Mayhem. Soap.',
  genres: [
    { id: 28, name: 'Action' },
    { id: 18, name: 'Drama' },
  ],
  releaseDate: '1999-10-15',
  runtime: 135,
  seasons: null,
  episodes: null,
  companies: [
    'Fox 2000 Pictures',
    'Regency Enterprises',
    'Linson Films',
    'Taurus Film',
  ],
  cast: [
    {
      id: 819,
      name: 'Edward Norton',
      character: 'Narrator',
      profilePath: null,
    },
    {
      id: 287,
      name: 'Brad Pitt',
      character: 'Tyler Durden',
      profilePath: '/brad.jpg',
    },
  ],
  videos: [
    { key: 'yt550', name: 'Official Trailer', type: 'Trailer', official: true },
  ],
  related: [{ ...tvItem, id: 807, mediaType: 'movie', title: 'Se7en' }],
  overviewIsFallback: false,
};

export const tvDetail: MediaDetail = {
  ...movieDetail,
  id: 1399,
  mediaType: 'tv',
  title: 'Game of Thrones',
  originalTitle: 'Game of Thrones',
  runtime: 60,
  seasons: 8,
  episodes: 73,
  releaseDate: '2011-04-17',
};
