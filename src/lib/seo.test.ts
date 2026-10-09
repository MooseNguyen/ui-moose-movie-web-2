import {
  movieDetail,
  personDetail,
  tvDetail,
} from '../../tests/fixtures/media';
import { resetEnvCache } from './env';
import {
  absoluteUrl,
  buildMetadata,
  movieJsonLd,
  personJsonLd,
  siteUrl,
} from './seo';

const SITE = 'https://moose.example';

beforeEach(() => {
  resetEnvCache();
  vi.stubEnv('TMDB_READ_TOKEN', 'test-token');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe('siteUrl / absoluteUrl', () => {
  it('drops a trailing slash from the configured site URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', `${SITE}/`);
    resetEnvCache();
    expect(siteUrl()).toBe(SITE);
    expect(absoluteUrl('vi', '')).toBe(`${SITE}/vi`);
  });

  it('builds locale-prefixed URLs with an ordered query', () => {
    expect(absoluteUrl('en', '/movie/550')).toBe(`${SITE}/en/movie/550`);
    expect(absoluteUrl('en', '/discover', { year: '2020', type: 'tv' })).toBe(
      `${SITE}/en/discover?type=tv&year=2020`
    );
    expect(
      absoluteUrl('vi', '/search', new URLSearchParams('type=tv&q=a/b'))
    ).toBe(`${SITE}/vi/search?q=a%2Fb&type=tv`);
  });

  it('skips empty and undefined query values', () => {
    expect(absoluteUrl('en', '/movie', { list: undefined, x: '' })).toBe(
      `${SITE}/en/movie`
    );
  });
});

describe('buildMetadata', () => {
  const base = {
    locale: 'en',
    path: '/movie/550',
    title: 'Fight Club',
    description: 'An insomniac office worker.',
  } as const;

  it('points the alternates at every locale and x-default at vi', () => {
    const { alternates } = buildMetadata(base);

    expect(alternates?.canonical).toBe(`${SITE}/en/movie/550`);
    expect(alternates?.languages).toEqual({
      vi: `${SITE}/vi/movie/550`,
      en: `${SITE}/en/movie/550`,
      'x-default': `${SITE}/vi/movie/550`,
    });
  });

  it('keeps the query on the canonical and every alternate', () => {
    const { alternates } = buildMetadata({
      ...base,
      path: '/movie',
      query: { list: 'top_rated' },
    });

    expect(alternates?.canonical).toBe(`${SITE}/en/movie?list=top_rated`);
    expect(alternates?.languages).toEqual({
      vi: `${SITE}/vi/movie?list=top_rated`,
      en: `${SITE}/en/movie?list=top_rated`,
      'x-default': `${SITE}/vi/movie?list=top_rated`,
    });
  });

  it('uses the bare locale URL for home', () => {
    const { alternates } = buildMetadata({ ...base, locale: 'vi', path: '' });
    expect(alternates?.canonical).toBe(`${SITE}/vi`);
  });

  it('adds Open Graph and a summary card without an image', () => {
    const metadata = buildMetadata(base);

    expect(metadata.title).toBe('Fight Club');
    expect(metadata.description).toBe('An insomniac office worker.');
    expect(metadata.openGraph).toEqual({
      type: 'website',
      siteName: 'Moose Movie',
      locale: 'en_US',
      url: `${SITE}/en/movie/550`,
      title: 'Fight Club',
      description: 'An insomniac office worker.',
    });
    expect(metadata.twitter).toEqual({
      card: 'summary',
      title: 'Fight Club',
      description: 'An insomniac office worker.',
    });
    expect(metadata).not.toHaveProperty('robots');
  });

  it('adds the image and a large card only when an image is given', () => {
    const image = { url: 'https://img/x.jpg', width: 1280, height: 720 };
    const metadata = buildMetadata({
      ...base,
      locale: 'vi',
      image,
      type: 'video.movie',
    });

    expect(metadata.openGraph).toMatchObject({
      type: 'video.movie',
      locale: 'vi_VN',
      images: [image],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      images: ['https://img/x.jpg'],
    });
  });

  it('omits the description when there is none', () => {
    const metadata = buildMetadata({
      locale: 'en',
      path: '/favorites',
      title: 'Favorites',
    });
    expect(metadata).not.toHaveProperty('description');
    expect(metadata.openGraph).not.toHaveProperty('description');
  });

  it('marks noIndex pages as noindex, follow', () => {
    expect(buildMetadata({ ...base, noIndex: true }).robots).toEqual({
      index: false,
      follow: true,
    });
  });
});

describe('movieJsonLd', () => {
  const url = `${SITE}/en/movie/550`;

  it('describes a movie with rating, genres and the top cast', () => {
    expect(movieJsonLd(movieDetail, url)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Movie',
      name: 'Fight Club',
      url,
      image: 'https://image.tmdb.org/t/p/w780/poster550.jpg',
      description: movieDetail.overview,
      datePublished: '1999-10-15',
      genre: ['Action', 'Drama'],
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: 8.4,
        ratingCount: 30000,
        bestRating: 10,
      },
      actor: [
        { '@type': 'Person', name: 'Edward Norton' },
        { '@type': 'Person', name: 'Brad Pitt' },
      ],
    });
  });

  it('uses TVSeries and startDate for tv', () => {
    const data = movieJsonLd(tvDetail, url);
    expect(data['@type']).toBe('TVSeries');
    expect(data.startDate).toBe('2011-04-17');
    expect(data).not.toHaveProperty('datePublished');
  });

  it('caps the actors at five', () => {
    const cast = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      name: `Actor ${i}`,
      character: '',
      profilePath: null,
    }));
    const data = movieJsonLd({ ...movieDetail, cast }, url);
    expect(data.actor).toHaveLength(5);
  });

  it('omits the rating without votes and every empty field', () => {
    const data = movieJsonLd(
      {
        ...movieDetail,
        voteCount: 0,
        voteAverage: 0,
        posterPath: null,
        overview: '  ',
        releaseDate: null,
        genres: [],
        cast: [],
      },
      url
    );

    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Movie',
      name: 'Fight Club',
      url,
    });
  });
});

describe('personJsonLd', () => {
  const url = `${SITE}/en/person/287`;

  it('describes a person', () => {
    expect(personJsonLd(personDetail, url)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Brad Pitt',
      url,
      image: 'https://image.tmdb.org/t/p/w780/brad.jpg',
      birthDate: '1963-12-18',
      birthPlace: { '@type': 'Place', name: 'Shawnee, Oklahoma, USA' },
      jobTitle: 'Acting',
      description: personDetail.biography,
    });
  });

  it('omits null and empty fields', () => {
    expect(
      personJsonLd(
        {
          ...personDetail,
          profilePath: null,
          knownForDepartment: null,
          birthday: null,
          deathday: '2020-01-01',
          placeOfBirth: null,
          biography: '',
        },
        url
      )
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Brad Pitt',
      url,
      deathDate: '2020-01-01',
    });
  });
});
