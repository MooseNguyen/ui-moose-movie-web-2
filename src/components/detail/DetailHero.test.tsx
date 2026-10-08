import { screen, within } from '@testing-library/react';
import { movieDetail, tvDetail } from '../../../tests/fixtures/media';
import { renderWithIntl } from '../../../tests/utils/render';
import { DetailHero } from './DetailHero';

vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);
// TrailerDialog imports the server action module; it is never opened here.
vi.mock('@/lib/actions/media', () => ({ getTrailer: vi.fn() }));

describe('DetailHero', () => {
  it('renders the title as the page heading with the tagline and overview', () => {
    renderWithIntl(<DetailHero detail={movieDetail} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Fight Club' })
    ).toBeInTheDocument();
    expect(screen.getByText('Mischief. Mayhem. Soap.')).toBeInTheDocument();
    expect(screen.getByText(movieDetail.overview)).toBeInTheDocument();
  });

  it('links each genre to discover filtered by media type and genre', () => {
    renderWithIntl(<DetailHero detail={movieDetail} />);

    expect(screen.getByRole('link', { name: 'Action' })).toHaveAttribute(
      'href',
      '/en/discover?type=movie&genres=28'
    );
    expect(screen.getByRole('link', { name: 'Drama' })).toHaveAttribute(
      'href',
      '/en/discover?type=movie&genres=18'
    );
  });

  it('formats the movie runtime as hours and minutes', () => {
    renderWithIntl(<DetailHero detail={movieDetail} />);
    expect(screen.getByText('2h 15m')).toBeInTheDocument();
  });

  it.each([
    [45, '45m'],
    [120, '2h'],
  ])('formats a runtime of %i minutes as %s', (runtime, text) => {
    renderWithIntl(<DetailHero detail={{ ...movieDetail, runtime }} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each([null, 0])('hides the runtime when it is %s', (runtime) => {
    renderWithIntl(<DetailHero detail={{ ...movieDetail, runtime }} />);
    expect(screen.queryByText('Runtime')).not.toBeInTheDocument();
  });

  it('shows season and episode counts for tv instead of the runtime', () => {
    renderWithIntl(<DetailHero detail={tvDetail} />);

    expect(screen.getByText('8 seasons · 73 episodes')).toBeInTheDocument();
    expect(screen.queryByText('Runtime')).not.toBeInTheDocument();
    expect(screen.getByText('First air date')).toBeInTheDocument();
  });

  it('pluralizes a single season', () => {
    renderWithIntl(
      <DetailHero detail={{ ...tvDetail, seasons: 1, episodes: 1 }} />
    );
    expect(screen.getByText('1 season · 1 episode')).toBeInTheDocument();
  });

  it('formats the release date with the locale', () => {
    renderWithIntl(<DetailHero detail={movieDetail} />);
    expect(screen.getByText('October 15, 1999')).toBeInTheDocument();
  });

  it('shows the (English) label only when the overview is a fallback', () => {
    const { unmount } = renderWithIntl(<DetailHero detail={movieDetail} />);
    expect(screen.queryByText('(English)')).not.toBeInTheDocument();
    unmount();

    renderWithIntl(
      <DetailHero detail={{ ...movieDetail, overviewIsFallback: true }} />
    );
    expect(screen.getByText('(English)')).toBeInTheDocument();
  });

  it('translates the fallback label in Vietnamese', () => {
    renderWithIntl(
      <DetailHero detail={{ ...movieDetail, overviewIsFallback: true }} />,
      'vi'
    );
    expect(screen.getByText('(Tiếng Anh)')).toBeInTheDocument();
  });

  it('shows the original title only when it differs from the title', () => {
    const { unmount } = renderWithIntl(<DetailHero detail={movieDetail} />);
    expect(screen.queryByText('Original title')).not.toBeInTheDocument();
    unmount();

    renderWithIntl(
      <DetailHero
        detail={{
          ...movieDetail,
          title: 'Câu lạc bộ',
          originalTitle: 'Fight Club',
        }}
      />
    );
    expect(screen.getByText('Original title')).toBeInTheDocument();
    expect(screen.getByText('Fight Club')).toBeInTheDocument();
  });

  it('shows the rating with the vote count', () => {
    renderWithIntl(<DetailHero detail={movieDetail} />);
    expect(screen.getByText('8.4/10')).toBeInTheDocument();
    expect(screen.getByText('(30,000 votes)')).toBeInTheDocument();
  });

  it('groups vote and episode counts with the Vietnamese locale', () => {
    renderWithIntl(
      <DetailHero detail={{ ...tvDetail, voteCount: 27892, episodes: 1200 }} />,
      'vi'
    );
    expect(screen.getByText('(27.892 lượt đánh giá)')).toBeInTheDocument();
    expect(screen.getByText('8 mùa · 1.200 tập')).toBeInTheDocument();
    expect(screen.getByText('Thời lượng')).toBeInTheDocument();
  });

  it('labels the tv season/episode row as the length', () => {
    renderWithIntl(<DetailHero detail={tvDetail} />);
    expect(screen.getByText('Length')).toBeInTheDocument();
  });

  it('lists at most three studios', () => {
    renderWithIntl(<DetailHero detail={movieDetail} />);
    expect(
      screen.getByText('Fox 2000 Pictures, Regency Enterprises, Linson Films')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Taurus Film/)).not.toBeInTheDocument();
  });

  it('shows the trailer button only when videos exist', () => {
    const { unmount } = renderWithIntl(<DetailHero detail={movieDetail} />);
    expect(
      screen.getByRole('button', { name: 'Trailer: Fight Club' })
    ).toBeInTheDocument();
    unmount();

    renderWithIntl(<DetailHero detail={{ ...movieDetail, videos: [] }} />);
    expect(
      screen.queryByRole('button', { name: /Trailer/ })
    ).not.toBeInTheDocument();
  });

  it('renders the favorite toggle', () => {
    renderWithIntl(<DetailHero detail={movieDetail} />);
    expect(
      screen.getByRole('button', { name: /Fight Club/, pressed: false })
    ).toBeInTheDocument();
  });

  it('uses a decorative w1280 backdrop and a w780 poster', () => {
    const { container } = renderWithIntl(<DetailHero detail={movieDetail} />);
    const sources = [...container.querySelectorAll('img')].map((img) =>
      decodeURIComponent(img.getAttribute('src') ?? '')
    );

    expect(sources.some((s) => s.includes('/w1280/backdrop550.jpg'))).toBe(
      true
    );
    expect(sources.some((s) => s.includes('/w780/poster550.jpg'))).toBe(true);
    for (const img of container.querySelectorAll('img')) {
      expect(img).toHaveAttribute('alt', '');
    }
  });

  it('falls back to local placeholders without images', () => {
    const { container } = renderWithIntl(
      <DetailHero
        detail={{ ...movieDetail, backdropPath: null, posterPath: null }}
      />
    );
    const sources = [...container.querySelectorAll('img')].map((img) =>
      img.getAttribute('src')
    );
    expect(sources).toEqual(
      expect.arrayContaining([
        '/placeholder-backdrop.svg',
        '/placeholder-poster.svg',
      ])
    );
  });

  it('groups the genre links in a labelled list', () => {
    renderWithIntl(<DetailHero detail={movieDetail} />);
    const list = screen.getByRole('list', { name: 'Genres' });
    expect(within(list).getAllByRole('link')).toHaveLength(2);
  });
});
