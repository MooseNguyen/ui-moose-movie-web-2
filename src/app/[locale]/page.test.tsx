import { screen } from '@testing-library/react';
import { getList, getTrending } from '@/lib/tmdb/api';
import type { MediaItem } from '@/lib/tmdb/types';
import { renderServerTree } from '../../../tests/utils/render-server';
import { tvItem } from '../../../tests/fixtures/media';
import HomePage, { generateMetadata, revalidate } from './page';

vi.mock('@/lib/tmdb/api', () => ({ getList: vi.fn(), getTrending: vi.fn() }));
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

const params = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]'>;

describe('HomePage', () => {
  it('revalidates hourly', () => {
    expect(revalidate).toBe(3600);
  });

  it('has translated metadata', async () => {
    expect(await generateMetadata(params('en'))).toEqual({
      // The layout's title template does not apply to its own segment's page,
      // so the brand is part of the translated title.
      title: 'Moose Movie: trending movies and TV series',
      description: expect.stringContaining('TMDB'),
    });
  });

  it('isolates a failing row: only that row shows its error fallback', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedGetTrending.mockResolvedValue([item(1, 'movie')]);
    mockedGetList.mockImplementation(async (mediaType, list) => {
      if (mediaType === 'tv' && list === 'on_the_air') {
        throw new Error('TMDB down');
      }
      return { items: [item(10, mediaType)], page: 1, totalPages: 1 };
    });

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
    for (const title of [
      'Trending Movies',
      'Top Rated Movies',
      'Upcoming Movies',
      'Popular TV Series',
      'Top Rated TV Series',
    ]) {
      expect(
        screen.getByRole('link', { name: `See all: ${title}` })
      ).toBeInTheDocument();
    }
    expect(
      screen.queryByRole('link', { name: 'See all: On The Air TV Series' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Could not load On The Air TV Series. Please refresh the page to try again.'
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Could not load/)).toHaveLength(1);
    expect(mockedGetList).toHaveBeenCalledTimes(6);
    expect(error).toHaveBeenCalledWith('[ui]', expect.any(Error));
    // Expected noise only: React's caught-error report and ErrorBoundary's log,
    // both about the one failing row.
    expect(error).toHaveBeenCalledTimes(2);
    for (const args of error.mock.calls) {
      expect(args).toContainEqual(
        expect.objectContaining({ message: 'TMDB down' })
      );
    }
    error.mockRestore();
  });
});
