import { screen, within } from '@testing-library/react';
import { renderWithIntl } from '../../../tests/utils/render';
import { ListTabs } from './ListTabs';

vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);

describe('ListTabs', () => {
  it('renders a labelled nav with links to ?list= for movies', () => {
    renderWithIntl(<ListTabs mediaType="movie" active="popular" />);

    const nav = screen.getByRole('navigation', { name: 'Choose a list' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Popular',
      'Top Rated',
      'Upcoming',
      'Now Playing',
    ]);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/en/movie?list=popular',
      '/en/movie?list=top_rated',
      '/en/movie?list=upcoming',
      '/en/movie?list=now_playing',
    ]);
  });

  it('renders the tv lists', () => {
    renderWithIntl(<ListTabs mediaType="tv" active="popular" />);

    expect(
      screen.getAllByRole('link').map((l) => l.getAttribute('href'))
    ).toEqual([
      '/en/tv?list=popular',
      '/en/tv?list=top_rated',
      '/en/tv?list=on_the_air',
      '/en/tv?list=airing_today',
    ]);
  });

  it('marks only the active link as the current page', () => {
    renderWithIntl(<ListTabs mediaType="tv" active="on_the_air" />);

    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('On The Air');
    expect(screen.getByRole('link', { name: 'Popular' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('does not use the ARIA tab pattern', () => {
    renderWithIntl(<ListTabs mediaType="movie" active="popular" />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('renders Vietnamese labels', () => {
    renderWithIntl(<ListTabs mediaType="movie" active="popular" />, 'vi');

    expect(
      screen.getByRole('navigation', { name: 'Chọn danh sách' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đánh giá cao' })).toHaveAttribute(
      'href',
      '/vi/movie?list=top_rated'
    );
  });
});
