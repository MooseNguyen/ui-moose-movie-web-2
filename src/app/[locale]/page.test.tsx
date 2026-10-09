import { screen, within } from '@testing-library/react';
import { getList, getTrending } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
import type { MediaItem } from '@/lib/tmdb/types';
import { renderServerTree } from '../../../tests/utils/render-server';
import { tvItem } from '../../../tests/fixtures/media';
import { TEST_SITE_URL } from '../../../tests/utils/mock-env';
import HomePage, { generateMetadata, revalidate } from './page';

vi.mock('@/lib/tmdb/api', () => ({ getList: vi.fn(), getTrending: vi.fn() }));
vi.mock('@/lib/env', () => import('../../../tests/utils/mock-env'));
vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
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
      namespace: 'home';
    }) => createTranslator({ locale, messages: messages[locale], namespace }),
  };
});

const mockedGetList = vi.mocked(getList);
const mockedGetTrending = vi.mocked(getTrending);

beforeAll(() => {
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

const item = (id: number, mediaType: 'movie' | 'tv'): MediaItem => ({
  ...tvItem,
  id,
  mediaType,
  title: `${mediaType} ${id}`,
});

const ROW_TITLES = [
  'Popular Movies',
  'Top Rated Movies',
  'Upcoming Movies',
  'Popular TV Series',
  'Top Rated TV Series',
  'On The Air TV Series',
];

const params = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]'>;

describe('HomePage', () => {
  it('revalidates hourly', () => {
    expect(revalidate).toBe(3600);
  });

  it('has translated metadata', async () => {
    const metadata = await generateMetadata(params('en'));
    expect(metadata).toMatchObject({
      // The layout's title template does not apply to its own segment's page,
      // so the brand is part of the translated title.
      title: 'Moose Movie: trending movies and TV series',
      description: expect.stringContaining('TMDB'),
    });
    expect(metadata).not.toHaveProperty('robots');
  });

  it('is canonical at the bare locale URL with hreflang alternates', async () => {
    const { alternates } = await generateMetadata(params('en'));
    expect(alternates).toEqual({
      canonical: `${TEST_SITE_URL}/en`,
      languages: {
        vi: `${TEST_SITE_URL}/vi`,
        en: `${TEST_SITE_URL}/en`,
        'x-default': `${TEST_SITE_URL}/vi`,
      },
    });
  });

  it('renders the hero and six rows', async () => {
    mockedGetTrending.mockResolvedValue([item(1, 'movie')]);
    mockedGetList.mockImplementation(async (mediaType) => ({
      items: [item(10, mediaType)],
      page: 1,
      totalPages: 1,
    }));

    await renderServerTree(await HomePage(params('en')));

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Moose Movie: trending movies and TV series',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Trending this week' })
    ).toBeInTheDocument();
    for (const title of ROW_TITLES) {
      expect(
        screen.getByRole('link', { name: `See all: ${title}` })
      ).toBeInTheDocument();
    }
    expect(mockedGetList).toHaveBeenCalledTimes(6);
    expect(mockedGetList).toHaveBeenCalledWith('movie', 'popular', 1, 'en');
    expect(mockedGetList).toHaveBeenCalledWith('tv', 'on_the_air', 1, 'en');
  });

  it('renders an inline error for a failing row and cards for the others', async () => {
    mockedGetTrending.mockResolvedValue([item(1, 'movie')]);
    mockedGetList.mockImplementation(async (mediaType, list) => {
      if (mediaType === 'tv' && list === 'on_the_air') {
        throw new TmdbError('server', '/tv/on_the_air', 503);
      }
      return { items: [item(10, mediaType)], page: 1, totalPages: 1 };
    });

    // Resolves instead of rejecting: no error escapes to fail the prerender.
    await renderServerTree(await HomePage(params('en')));

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not load On The Air TV Series right now. Please try again later.'
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'On The Air TV Series' })
    ).toBeInTheDocument();
    for (const title of ROW_TITLES.slice(0, 5)) {
      const carousel = screen.getByRole('region', { name: title });
      expect(within(carousel).getAllByRole('group')).toHaveLength(1);
    }
    expect(
      screen.queryByRole('region', { name: 'On The Air TV Series' })
    ).not.toBeInTheDocument();
  });

  it('renders the rows without the hero when trending fails', async () => {
    mockedGetTrending.mockRejectedValue(
      new TmdbError('network', '/trending/all/week')
    );
    mockedGetList.mockImplementation(async (mediaType) => ({
      items: [item(10, mediaType)],
      page: 1,
      totalPages: 1,
    }));

    await renderServerTree(await HomePage(params('en')));

    expect(
      screen.queryByRole('region', { name: 'Trending this week' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    for (const title of ROW_TITLES) {
      expect(screen.getByRole('region', { name: title })).toBeInTheDocument();
    }
  });

  it('logs unexpected (non-TMDB) trending errors once', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bug = new TypeError('normalize failed');
    mockedGetTrending.mockRejectedValue(bug);
    mockedGetList.mockResolvedValue({ items: [], page: 1, totalPages: 0 });

    await renderServerTree(await HomePage(params('en')));

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('[home]', 'trending', bug);
    error.mockRestore();
  });
});
