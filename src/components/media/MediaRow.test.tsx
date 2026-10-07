import { screen, within } from '@testing-library/react';
import { getList } from '@/lib/tmdb/api';
import type { MediaItem } from '@/lib/tmdb/types';
import { renderWithIntl } from '../../../tests/utils/render';
import { tvItem } from '../../../tests/fixtures/media';
import { MediaRow } from './MediaRow';

vi.mock('@/lib/tmdb/api', () => ({ getList: vi.fn() }));
vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);

const mockedGetList = vi.mocked(getList);

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

const movies: MediaItem[] = [
  { ...tvItem, id: 1, mediaType: 'movie', title: 'Movie One' },
  { ...tvItem, id: 2, mediaType: 'movie', title: 'Movie Two' },
];

describe('MediaRow', () => {
  it('fetches page 1 of the list in the given locale', async () => {
    mockedGetList.mockResolvedValue({ items: movies, page: 1, totalPages: 3 });
    await MediaRow({
      title: 'Trending Movies',
      mediaType: 'movie',
      list: 'popular',
      locale: 'vi',
    });
    expect(mockedGetList).toHaveBeenCalledWith('movie', 'popular', 1, 'vi');
  });

  it('renders a labelled section with a uniquely named "See all" link', async () => {
    mockedGetList.mockResolvedValue({ items: movies, page: 1, totalPages: 3 });
    renderWithIntl(
      <>
        {await MediaRow({
          title: 'Trending Movies',
          mediaType: 'movie',
          list: 'popular',
          locale: 'en',
        })}
      </>
    );

    // The section landmark and the carousel inside it share the row title;
    // the carousel is told apart by aria-roledescription="carousel".
    const section = screen
      .getAllByRole('region', { name: 'Trending Movies' })
      .find((el) => el.tagName === 'SECTION')!;
    expect(section).toBeDefined();
    expect(
      within(section).getByRole('heading', {
        level: 2,
        name: 'Trending Movies',
      })
    ).toBeInTheDocument();
    const seeAll = within(section).getByRole('link', {
      name: 'See all: Trending Movies',
    });
    expect(seeAll).toHaveTextContent('See all');
    expect(seeAll).toHaveAttribute('href', '/en/movie?list=popular');
  });

  it('renders a card with a favorite button for every item', async () => {
    mockedGetList.mockResolvedValue({ items: movies, page: 1, totalPages: 3 });
    renderWithIntl(
      <>
        {await MediaRow({
          title: 'Trending Movies',
          mediaType: 'movie',
          list: 'popular',
          locale: 'en',
        })}
      </>
    );

    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Movie One/ })).toHaveAttribute(
      'href',
      '/en/movie/1'
    );
    expect(
      screen.getByRole('button', { name: 'Favorite: Movie Two' })
    ).toBeInTheDocument();
  });

  it('renders nothing for an empty list', async () => {
    mockedGetList.mockResolvedValue({ items: [], page: 1, totalPages: 0 });
    expect(
      await MediaRow({
        title: 'On The Air TV Series',
        mediaType: 'tv',
        list: 'on_the_air',
        locale: 'en',
      })
    ).toBeNull();
  });
});
