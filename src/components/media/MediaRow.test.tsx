import { screen, within } from '@testing-library/react';
import { getList } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
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
      title: 'Popular Movies',
      mediaType: 'movie',
      list: 'popular',
      locale: 'vi',
    });
    expect(mockedGetList).toHaveBeenCalledWith('movie', 'popular', 1, 'vi');
  });

  it('renders the title and a uniquely named "See all" link', async () => {
    mockedGetList.mockResolvedValue({ items: movies, page: 1, totalPages: 3 });
    renderWithIntl(
      <>
        {await MediaRow({
          title: 'Popular Movies',
          mediaType: 'movie',
          list: 'popular',
          locale: 'en',
        })}
      </>
    );

    // Only the carousel is a named region; the section stays unnamed.
    const region = screen.getByRole('region', { name: 'Popular Movies' });
    expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    const section = region.closest('section')!;
    expect(section).not.toHaveAttribute('aria-labelledby');
    expect(
      within(section).getByRole('heading', {
        level: 2,
        name: 'Popular Movies',
      })
    ).toBeInTheDocument();
    const seeAll = within(section).getByRole('link', {
      name: 'See all: Popular Movies',
    });
    expect(seeAll).toHaveTextContent('See all');
    expect(seeAll).toHaveAttribute('href', '/en/movie?list=popular');
  });

  it('renders a card with a favorite button for every item', async () => {
    mockedGetList.mockResolvedValue({ items: movies, page: 1, totalPages: 3 });
    renderWithIntl(
      <>
        {await MediaRow({
          title: 'Popular Movies',
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

  it('shows an inline error instead of throwing when TMDB fails', async () => {
    // tmdbFetch has already logged a TmdbError, so the row stays quiet.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedGetList.mockRejectedValue(
      new TmdbError('server', '/tv/on_the_air', 503)
    );
    renderWithIntl(
      <>
        {await MediaRow({
          title: 'On The Air TV Series',
          mediaType: 'tv',
          list: 'on_the_air',
          locale: 'en',
        })}
      </>
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'On The Air TV Series' })
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not load On The Air TV Series right now. Please try again later.'
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('logs unexpected (non-TMDB) errors once and still renders the error state', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bug = new TypeError('normalize failed');
    mockedGetList.mockRejectedValue(bug);
    renderWithIntl(
      <>
        {await MediaRow({
          title: 'Popular Movies',
          mediaType: 'movie',
          list: 'popular',
          locale: 'en',
        })}
      </>
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not load Popular Movies'
    );
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('[home]', 'movie', 'popular', bug);
    error.mockRestore();
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
