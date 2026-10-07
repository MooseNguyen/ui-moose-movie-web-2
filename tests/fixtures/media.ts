import type { MediaItem, PersonSummary } from '@/lib/tmdb/types';

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
