import { screen, within } from '@testing-library/react';
import { getTrendingWall } from '@/lib/tmdb/api';
import { TmdbError } from '@/lib/tmdb/errors';
import type { MediaItem } from '@/lib/tmdb/types';
import { renderWithIntl } from '../../../tests/utils/render';
import { tvItem } from '../../../tests/fixtures/media';
import { PosterWall } from './PosterWall';

vi.mock('@/lib/tmdb/api', () => ({ getTrendingWall: vi.fn() }));
vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);

const mockedGetTrendingWall = vi.mocked(getTrendingWall);

const items: MediaItem[] = [
  { ...tvItem, id: 1, mediaType: 'movie', title: 'Movie One' },
  { ...tvItem, id: 2, mediaType: 'tv', title: 'Show Two' },
];

async function renderWall(locale: 'en' | 'vi' = 'en') {
  return renderWithIntl(<>{await PosterWall({ locale })}</>, locale);
}

describe('PosterWall', () => {
  it('fetches the wall in the given locale', async () => {
    mockedGetTrendingWall.mockResolvedValue(items);
    await PosterWall({ locale: 'vi' });
    expect(mockedGetTrendingWall).toHaveBeenCalledWith('vi');
  });

  it('renders a region named by its h2 with a card link per item', async () => {
    mockedGetTrendingWall.mockResolvedValue(items);
    await renderWall();

    const region = screen.getByRole('region', {
      name: 'Trending poster wall',
    });
    expect(
      within(region).getByRole('heading', {
        level: 2,
        name: 'Trending poster wall',
      })
    ).toBeInTheDocument();
    // Card titles are h3 under the section h2.
    expect(within(region).getAllByRole('heading', { level: 3 })).toHaveLength(
      2
    );
    expect(
      within(region).getByRole('link', { name: /Movie One/ })
    ).toHaveAttribute('href', '/en/movie/1');
    expect(
      within(region).getByRole('link', { name: /Show Two/ })
    ).toHaveAttribute('href', '/en/tv/2');
    expect(
      within(region).getByRole('button', { name: 'Favorite: Show Two' })
    ).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders nothing for an empty wall', async () => {
    mockedGetTrendingWall.mockResolvedValue([]);
    expect(await PosterWall({ locale: 'en' })).toBeNull();
  });

  it('renders nothing (without logging again) when TMDB fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedGetTrendingWall.mockRejectedValue(
      new TmdbError('network', '/trending/all/week')
    );
    expect(await PosterWall({ locale: 'en' })).toBeNull();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('logs unexpected (non-TMDB) errors once and renders nothing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bug = new TypeError('normalize failed');
    mockedGetTrendingWall.mockRejectedValue(bug);
    expect(await PosterWall({ locale: 'en' })).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('[home]', 'trending wall', bug);
    error.mockRestore();
  });
});
