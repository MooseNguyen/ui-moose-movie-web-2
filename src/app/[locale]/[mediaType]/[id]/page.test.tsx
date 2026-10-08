import { screen, within } from '@testing-library/react';
import { notFound } from 'next/navigation';
import { getDetail } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
import { movieDetail, tvDetail } from '../../../../../tests/fixtures/media';
import { renderServerTree } from '../../../../../tests/utils/render-server';
import DetailPage, { generateMetadata, generateStaticParams } from './page';

vi.mock('@/lib/tmdb/api', () => ({ getDetail: vi.fn() }));
vi.mock('@/lib/actions/media', () => ({ getTrailer: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock(
  '@/i18n/navigation',
  () => import('../../../../../tests/utils/mock-navigation')
);
vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  const messages = {
    en: (await import('@/messages/en.json')).default,
    vi: (await import('@/messages/vi.json')).default,
  };
  return {
    getTranslations: async ({
      locale,
      namespace,
    }: {
      locale: 'en' | 'vi';
      namespace: 'detail';
    }) => createTranslator({ locale, messages: messages[locale], namespace }),
  };
});

const mockedGetDetail = vi.mocked(getDetail);

const props = (locale: string, mediaType: string, id: string) =>
  ({
    params: Promise.resolve({ locale, mediaType, id }),
  }) as unknown as PageProps<'/[locale]/[mediaType]/[id]'>;

beforeAll(() => {
  // Embla needs these browser APIs, which jsdom does not implement.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
  class Stub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Stub);
  vi.stubGlobal('IntersectionObserver', Stub);
});

beforeEach(() => {
  mockedGetDetail.mockReset();
  mockedGetDetail.mockResolvedValue(movieDetail);
  vi.mocked(notFound).mockClear();
});

describe('DetailPage', () => {
  it('renders the hero, cast, videos and related sections', async () => {
    await renderServerTree(await DetailPage(props('en', 'movie', '550')));

    expect(mockedGetDetail).toHaveBeenCalledWith('movie', 550, 'en');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Fight Club' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Cast' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Videos' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'More like this' })
    ).toBeInTheDocument();
    const related = screen.getByRole('region', { name: 'More like this' });
    expect(
      within(related).getByRole('link', { name: /Se7en/ })
    ).toHaveAttribute('href', '/en/movie/807');
    expect(
      within(related).getByRole('button', { name: /Se7en/ })
    ).toBeInTheDocument();
    expect(document.querySelector('main')).toBeNull();
  });

  it('fetches tv details for the tv segment', async () => {
    mockedGetDetail.mockResolvedValue(tvDetail);
    await renderServerTree(await DetailPage(props('vi', 'tv', '1399')), 'vi');
    expect(mockedGetDetail).toHaveBeenCalledWith('tv', 1399, 'vi');
    expect(screen.getByText('8 mùa · 73 tập')).toBeInTheDocument();
  });

  it('hides the related section when there are no related titles', async () => {
    mockedGetDetail.mockResolvedValue({ ...movieDetail, related: [] });
    await renderServerTree(await DetailPage(props('en', 'movie', '550')));

    expect(
      screen.queryByRole('heading', { name: 'More like this' })
    ).not.toBeInTheDocument();
  });

  it('hides the cast and video sections when they are empty', async () => {
    mockedGetDetail.mockResolvedValue({ ...movieDetail, cast: [], videos: [] });
    await renderServerTree(await DetailPage(props('en', 'movie', '550')));

    expect(
      screen.queryByRole('heading', { name: 'Cast' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Videos' })
    ).not.toBeInTheDocument();
  });

  it.each([
    ['a non-numeric id', 'movie', 'abc'],
    ['a zero id', 'movie', '0'],
    ['a leading-zero id', 'movie', '0550'],
    ['an unknown media type', 'anime', '550'],
  ])('404s for %s before fetching', async (_label, mediaType, id) => {
    await expect(DetailPage(props('en', mediaType, id))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    expect(notFound).toHaveBeenCalled();
    expect(mockedGetDetail).not.toHaveBeenCalled();
  });

  it('404s for an unknown locale', async () => {
    await expect(DetailPage(props('fr', 'movie', '550'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
  });

  it('404s when TMDB does not know the id', async () => {
    mockedGetDetail.mockRejectedValue(
      new TmdbError('not_found', '/movie/999999999', 404)
    );
    await expect(DetailPage(props('en', 'movie', '999999999'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    expect(notFound).toHaveBeenCalled();
  });

  it('re-throws other errors for the error boundary', async () => {
    const error = new TmdbError('server', '/movie/550', 503);
    mockedGetDetail.mockRejectedValue(error);

    await expect(DetailPage(props('en', 'movie', '550'))).rejects.toBe(error);
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe('generateStaticParams', () => {
  it('prerenders nothing at build time', async () => {
    expect(await generateStaticParams()).toEqual([]);
  });
});

describe('generateMetadata', () => {
  it('uses the title, overview and w1280 backdrop', async () => {
    expect(await generateMetadata(props('en', 'movie', '550'))).toEqual({
      title: 'Fight Club',
      description: movieDetail.overview,
      openGraph: {
        title: 'Fight Club',
        description: movieDetail.overview,
        images: [
          {
            url: 'https://image.tmdb.org/t/p/w1280/backdrop550.jpg',
            width: 1280,
            height: 720,
          },
        ],
      },
    });
  });

  it('trims a long overview to about 160 characters', async () => {
    mockedGetDetail.mockResolvedValue({
      ...movieDetail,
      overview: 'word '.repeat(100),
    });
    const { description } = await generateMetadata(props('en', 'movie', '550'));

    expect(description!.length).toBeLessThanOrEqual(160);
    expect(description).toMatch(/…$/);
  });

  it('falls back to a generic description and omits images', async () => {
    mockedGetDetail.mockResolvedValue({
      ...movieDetail,
      overview: '',
      backdropPath: null,
    });
    const metadata = await generateMetadata(props('en', 'movie', '550'));

    expect(metadata.description).toBe(
      'Details, cast and trailers for Fight Club.'
    );
    expect(metadata.openGraph).not.toHaveProperty('images');
  });

  it('404s for invalid params and unknown ids', async () => {
    await expect(generateMetadata(props('en', 'movie', 'abc'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    mockedGetDetail.mockRejectedValue(new TmdbError('not_found', '/tv/1', 404));
    await expect(generateMetadata(props('en', 'tv', '1'))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
  });
});
