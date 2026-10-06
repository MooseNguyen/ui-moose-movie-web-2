// @vitest-environment node
import movieDetailFixture from '../../../tests/fixtures/movie-detail.json';
import moviePopularFixture from '../../../tests/fixtures/movie-popular.json';
import personDetailFixture from '../../../tests/fixtures/person-detail.json';
import searchMultiFixture from '../../../tests/fixtures/search-multi.json';
import tvDetailFixture from '../../../tests/fixtures/tv-detail.json';
import tvPopularFixture from '../../../tests/fixtures/tv-popular.json';
import {
  pageSchema,
  rawGenresSchema,
  rawMovieDetailSchema,
  rawMovieSchema,
  rawMultiItemSchema,
  rawPersonDetailSchema,
  rawTvDetailSchema,
  rawTvSchema,
  rawVideoSchema,
} from './schemas';
import {
  pickVideos,
  toGridItems,
  toMediaDetail,
  toMediaItem,
  toPaginated,
  toPersonDetail,
} from './normalize';

const movies = pageSchema(rawMovieSchema).parse(moviePopularFixture);
const shows = pageSchema(rawTvSchema).parse(tvPopularFixture);
const multi = pageSchema(rawMultiItemSchema).parse(searchMultiFixture);
const movieDetail = rawMovieDetailSchema.parse(movieDetailFixture);
const tvDetail = rawTvDetailSchema.parse(tvDetailFixture);
const personDetail = rawPersonDetailSchema.parse(personDetailFixture);

function video(over: Record<string, unknown>) {
  return rawVideoSchema.parse({
    key: 'k',
    name: 'n',
    site: 'YouTube',
    type: 'Trailer',
    ...over,
  });
}

describe('toMediaItem', () => {
  it('normalizes movie and tv to the same shape', () => {
    const m = toMediaItem(movies.results[0], 'movie');
    const t = toMediaItem(shows.results[0], 'tv');
    expect(m).toMatchObject({
      mediaType: 'movie',
      title: movies.results[0].title,
      year: expect.any(Number),
    });
    expect(t).toMatchObject({ mediaType: 'tv', year: expect.any(Number) });
    expect(t.title).toBe(shows.results[0].name);
    expect(Object.keys(t).sort()).toEqual(Object.keys(m).sort());
  });

  it('derives year from the date prefix', () => {
    const raw = rawMovieSchema.parse({ id: 1, release_date: '1999-10-15' });
    expect(toMediaItem(raw, 'movie').year).toBe(1999);
  });

  it('returns posterPath null when poster_path is missing', () => {
    const noPoster = movies.results.find((r) => r.id === 999001)!;
    expect(toMediaItem(noPoster, 'movie').posterPath).toBeNull();
  });

  it.each([
    ['12ab', null],
    ['0000-00-00', null],
    ['', null],
    ['1999-10-15', 1999],
  ])('parses year from %j as %j', (date, year) => {
    const raw = rawMovieSchema.parse({ id: 3, release_date: date });
    expect(toMediaItem(raw, 'movie').year).toBe(year);
  });

  it('returns year null when the date is missing or empty', () => {
    const noDate = shows.results.find((r) => r.id === 999002)!;
    expect(toMediaItem(noDate, 'tv').year).toBeNull();
    const empty = rawMovieSchema.parse({ id: 2, release_date: '' });
    expect(toMediaItem(empty, 'movie').year).toBeNull();
  });
});

describe('schemas', () => {
  it('apply defaults for missing optional fields', () => {
    expect(rawMovieSchema.parse({ id: 5 })).toMatchObject({
      title: '',
      overview: '',
      poster_path: null,
      vote_average: 0,
      genre_ids: [],
    });
  });

  it('reject payloads without the required fields', () => {
    expect(rawMovieSchema.safeParse({}).success).toBe(false);
    expect(
      pageSchema(rawMovieSchema).safeParse({ page: 1, total_pages: 1 }).success
    ).toBe(false);
  });

  it('parses genres', () => {
    expect(
      rawGenresSchema.parse({ genres: [{ id: 1, name: 'Drama' }] }).genres
    ).toHaveLength(1);
  });
});

describe('toGridItems', () => {
  it('keeps person and media from multi search, drops unknown media_type', () => {
    const unknown = rawMultiItemSchema.parse({
      id: 1,
      media_type: 'collection',
    });
    const items = toGridItems([...multi.results, unknown]);
    expect(items.map((i) => i.mediaType)).not.toContain('collection');
    expect(items.some((i) => i.mediaType === 'person')).toBe(true);
    expect(items).toHaveLength(multi.results.length);
    const person = items.find((i) => i.mediaType === 'person');
    expect(person).toMatchObject({
      name: expect.any(String),
      knownForDepartment: 'Acting',
    });
  });
});

describe('toPaginated', () => {
  it('dedupes by mediaType and id', () => {
    const dup = [movies.results[0], movies.results[0], movies.results[1]];
    const page = toPaginated({ page: 1, total_pages: 3, results: dup }, (rs) =>
      rs.map((r) => toMediaItem(r, 'movie'))
    );
    expect(page.items.map((i) => i.id)).toEqual([
      movies.results[0].id,
      movies.results[1].id,
    ]);
    expect(page).toMatchObject({ page: 1, totalPages: 3 });
  });

  it('keeps the same id when media types differ', () => {
    const a = toMediaItem(rawMovieSchema.parse({ id: 7 }), 'movie');
    const b = toMediaItem(rawTvSchema.parse({ id: 7 }), 'tv');
    const page = toPaginated(
      { page: 1, total_pages: 1, results: [a, b] },
      (rs) => rs
    );
    expect(page.items).toHaveLength(2);
  });

  it('clamps totalPages to 500', () => {
    const page = toPaginated(
      { page: 1, total_pages: 40000, results: [] },
      () => []
    );
    expect(page.totalPages).toBe(500);
  });
});

describe('pickVideos', () => {
  it('keeps YouTube trailers/teasers only, official first', () => {
    const picked = pickVideos(movieDetail.videos.results);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((v) => ['Trailer', 'Teaser'].includes(v.type))).toBe(
      true
    );
    expect(picked.map((v) => v.key)).not.toContain('vimeo1');
  });

  it('caps at 6', () => {
    const many = Array.from({ length: 9 }, (_, i) => video({ key: `k${i}` }));
    expect(pickVideos(many)).toHaveLength(6);
  });

  it('orders official before unofficial and filters other sites and types', () => {
    const picked = pickVideos([
      video({ key: 'a', official: false }),
      video({ key: 'b', official: true, type: 'Teaser' }),
      video({ key: 'c', site: 'Vimeo', official: true }),
      video({ key: 'd', type: 'Featurette', official: true }),
    ]);
    expect(picked.map((v) => v.key)).toEqual(['b', 'a']);
  });
});

describe('toMediaDetail', () => {
  it('maps a movie detail', () => {
    const d = toMediaDetail(movieDetail, 'movie');
    expect(d).toMatchObject({
      id: movieDetail.id,
      mediaType: 'movie',
      title: movieDetail.title,
      overviewIsFallback: false,
      seasons: null,
      episodes: null,
    });
    expect(d.genres.length).toBeGreaterThan(0);
    expect(d.companies.length).toBeLessThanOrEqual(3);
    expect(d.releaseDate).toBe(movieDetail.release_date);
    expect(d.cast).toHaveLength(12);
    expect(d.videos.length).toBeLessThanOrEqual(6);
    expect(d.related).toHaveLength(movieDetail.recommendations.results.length);
  });

  it('maps a tv detail with seasons and episodes', () => {
    const d = toMediaDetail(tvDetail, 'tv');
    expect(d).toMatchObject({
      mediaType: 'tv',
      title: tvDetail.name,
      seasons: tvDetail.number_of_seasons,
      episodes: tvDetail.number_of_episodes,
      releaseDate: tvDetail.first_air_date,
    });
    expect(d.runtime).toBeNull();
  });

  it('uses similar when recommendations are empty', () => {
    const raw = { ...movieDetail, recommendations: { results: [] } };
    const d = toMediaDetail(raw, 'movie');
    expect(d.related).toHaveLength(movieDetail.similar.results.length);
    expect(d.related.length).toBeGreaterThan(0);
  });

  it('uses the fallback overview only when the overview is empty', () => {
    const empty = { ...movieDetail, overview: '' };
    expect(toMediaDetail(empty, 'movie', 'Fallback text')).toMatchObject({
      overview: 'Fallback text',
      overviewIsFallback: true,
    });
    expect(toMediaDetail(empty, 'movie')).toMatchObject({
      overview: '',
      overviewIsFallback: false,
    });
    expect(
      toMediaDetail(movieDetail, 'movie', 'Fallback text').overviewIsFallback
    ).toBe(false);
  });
});

describe('toPersonDetail', () => {
  it('dedupes credits and sorts by popularity desc', () => {
    const rawCredits = personDetail.combined_credits.cast;
    expect(rawCredits.length).toBeGreaterThan(
      new Set(rawCredits.map((c) => c.id)).size
    );
    const d = toPersonDetail(personDetail);
    const ids = d.credits.map((c) => `${c.mediaType}:${c.id}`);
    expect(new Set(ids).size).toBe(ids.length);
    const popularity = (id: number, type: string) =>
      rawCredits.find((c) => c.id === id && c.media_type === type)!.popularity;
    const pops = d.credits.map((c) => popularity(c.id, c.mediaType));
    expect(pops).toEqual([...pops].sort((a, b) => b - a));
    expect(d).toMatchObject({
      id: 287,
      biographyIsFallback: false,
      knownForDepartment: 'Acting',
    });
  });

  it('reads tv credits from the tv fields', () => {
    const tvCredit = rawMultiItemSchema.parse({
      id: 1399,
      media_type: 'tv',
      name: 'Show Name',
      first_air_date: '2011-04-17',
      popularity: 1,
    });
    const raw = {
      ...personDetail,
      combined_credits: { cast: [tvCredit] },
    };
    expect(toPersonDetail(raw).credits[0]).toMatchObject({
      mediaType: 'tv',
      title: 'Show Name',
      year: 2011,
    });
  });

  it('uses the fallback biography when empty', () => {
    const empty = { ...personDetail, biography: '' };
    expect(toPersonDetail(empty, 'Fallback bio')).toMatchObject({
      biography: 'Fallback bio',
      biographyIsFallback: true,
    });
    expect(toPersonDetail(empty).biographyIsFallback).toBe(false);
  });
});
