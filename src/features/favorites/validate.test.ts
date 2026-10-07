import { isFavoriteItem } from './validate';

const valid = {
  id: 603,
  mediaType: 'movie',
  title: 'The Matrix',
  posterPath: '/p.jpg',
  voteAverage: 8.2,
  year: 1999,
  addedAt: 1_700_000_000_000,
};

describe('isFavoriteItem', () => {
  it('accepts a valid item, null posterPath/year, and ignores extra fields', () => {
    expect(isFavoriteItem(valid)).toBe(true);
    expect(isFavoriteItem({ ...valid, posterPath: null, year: null })).toBe(
      true
    );
    expect(isFavoriteItem({ ...valid, extra: 'x' })).toBe(true);
    expect(isFavoriteItem({ ...valid, mediaType: 'tv' })).toBe(true);
  });

  it.each([
    ['id zero', { id: 0 }],
    ['id negative', { id: -1 }],
    ['id fractional', { id: 1.5 }],
    ['id string', { id: '1' }],
    ['id NaN', { id: NaN }],
    ['mediaType person', { mediaType: 'person' }],
    ['mediaType missing', { mediaType: undefined }],
    ['title empty', { title: '' }],
    ['title number', { title: 5 }],
    ['posterPath number', { posterPath: 5 }],
    ['posterPath undefined', { posterPath: undefined }],
    ['voteAverage NaN', { voteAverage: NaN }],
    ['voteAverage Infinity', { voteAverage: Infinity }],
    ['voteAverage string', { voteAverage: '8' }],
    ['year fractional', { year: 1999.5 }],
    ['year string', { year: '1999' }],
    ['year undefined', { year: undefined }],
    ['addedAt NaN', { addedAt: NaN }],
    ['addedAt string', { addedAt: '1' }],
    ['addedAt missing', { addedAt: undefined }],
  ])('rejects %s', (_name, patch) => {
    expect(isFavoriteItem({ ...valid, ...patch })).toBe(false);
  });

  it.each([null, undefined, 'str', 42, true, [], [valid], () => valid])(
    'rejects non-object input %#',
    (input) => {
      expect(isFavoriteItem(input)).toBe(false);
    }
  );

  it('rejects an empty object', () => {
    expect(isFavoriteItem({})).toBe(false);
  });
});
