// @vitest-environment node
import { delay, http, HttpResponse } from 'msw';
import { server } from '../../tests/msw/server';
import { detailCardModel, fetchPoster } from './og';

const POSTER = 'https://image.tmdb.org/t/p/w780/poster.jpg';

const detail = {
  title: 'Fight Club',
  year: 1999,
  genres: [
    { id: 18, name: 'Drama' },
    { id: 53, name: 'Thriller' },
    { id: 35, name: 'Comedy' },
    { id: 80, name: 'Crime' },
  ],
  voteAverage: 8.438,
  voteCount: 30000,
};

describe('detailCardModel', () => {
  it('joins the year and at most three genres', () => {
    expect(detailCardModel(detail, 'en').meta).toBe(
      '1999 · Drama · Thriller · Comedy'
    );
  });

  it('formats the rating with one decimal for the locale', () => {
    expect(detailCardModel(detail, 'en').rating).toBe('8.4');
    expect(detailCardModel(detail, 'vi').rating).toBe('8,4');
  });

  it('has no rating without votes, and no meta without year or genres', () => {
    const model = detailCardModel(
      { ...detail, year: null, genres: [], voteCount: 0 },
      'en'
    );

    expect(model.rating).toBeNull();
    expect(model.meta).toBe('');
  });

  it('shortens a very long title', () => {
    const { title } = detailCardModel(
      { ...detail, title: 'Một tựa phim rất dài '.repeat(10) },
      'vi'
    );

    expect(title.length).toBeLessThanOrEqual(70);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('fetchPoster', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('returns the poster as a data URL', async () => {
    server.use(
      http.get(
        POSTER,
        () =>
          new HttpResponse(new Uint8Array([1, 2, 3]), {
            headers: { 'Content-Type': 'image/jpeg' },
          })
      )
    );

    expect(await fetchPoster('/poster.jpg')).toBe(
      'data:image/jpeg;base64,AQID'
    );
  });

  it('does not fetch without a poster', async () => {
    expect(await fetchPoster(null)).toBeNull();
  });

  it.each([
    ['a 404', () => new HttpResponse(null, { status: 404 })],
    ['a network error', () => HttpResponse.error()],
    [
      'a non-image response',
      () =>
        new HttpResponse('<html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
    ],
  ])('returns null and logs on %s', async (_label, respond) => {
    server.use(http.get(POSTER, respond));

    expect(await fetchPoster('/poster.jpg')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('gives up after the timeout', async () => {
    server.use(
      http.get(POSTER, async () => {
        await delay('infinite');
        return new HttpResponse(null);
      })
    );

    const started = Date.now();
    expect(await fetchPoster('/poster.jpg', 50)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
