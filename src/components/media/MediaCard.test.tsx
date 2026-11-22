import { screen } from '@testing-library/react';
import { renderWithIntl } from '../../../tests/utils/render';
import { CAROUSEL_POSTER_SIZES } from './carousel-layout';
import { MediaCard } from './MediaCard';
import { GRID_POSTER_SIZES } from './MediaGrid';
import { tvItem } from '../../../tests/fixtures/media';

vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);

describe('MediaCard', () => {
  it('is a pointer-tilt target with a decorative glare (see TiltController)', () => {
    renderWithIntl(<MediaCard item={tvItem} />);
    const card = screen.getByTestId('media-card');
    expect(card).toHaveAttribute('data-tilt');
    const glare = card.querySelector('.tilt-glare');
    expect(glare).toHaveAttribute('aria-hidden', 'true');
  });

  it('starts a card-nav transition with a named-on-click poster (see PosterTransitionController)', () => {
    renderWithIntl(<MediaCard item={tvItem} />);
    expect(screen.getByRole('link')).toHaveAttribute(
      'data-transition-types',
      'card-nav'
    );
    const poster = document.querySelector('[data-poster-transition]');
    expect(poster).toHaveAttribute(
      'data-poster-transition',
      `poster-tv-${tvItem.id}`
    );
    expect(poster).toContainElement(document.querySelector('img'));
    // Not named up front: the same title can sit in several rows.
    expect(poster).not.toHaveStyle({
      viewTransitionName: `poster-tv-${tvItem.id}`,
    });
  });

  it('links to the right media type and shows placeholder when poster missing', () => {
    renderWithIntl(
      <MediaCard item={{ ...tvItem, posterPath: null, year: null }} />
    );
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/en/tv/' + tvItem.id
    );
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      '/placeholder-poster.svg'
    );
    expect(screen.queryByText('null')).not.toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('shows the year, and hides it when null', () => {
    const { unmount } = renderWithIntl(<MediaCard item={tvItem} />);
    expect(screen.getByText('2011')).toBeInTheDocument();
    unmount();
    renderWithIntl(<MediaCard item={{ ...tvItem, year: null }} />);
    expect(screen.queryByText('2011')).not.toBeInTheDocument();
  });

  it('formats the rating with one decimal per locale', () => {
    const { unmount } = renderWithIntl(<MediaCard item={tvItem} />, 'en');
    expect(screen.getByText(/7\.3/)).toBeInTheDocument();
    unmount();
    renderWithIntl(<MediaCard item={tvItem} />, 'vi');
    expect(screen.getByText(/7,3/)).toBeInTheDocument();
  });

  it('exposes the rating to screen readers', () => {
    renderWithIntl(<MediaCard item={tvItem} />, 'vi');
    expect(screen.getByText('Đánh giá')).toHaveClass('sr-only');
  });

  it('marks the poster decorative since the title names the link', () => {
    renderWithIntl(<MediaCard item={tvItem} />);
    expect(document.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('hides the rating when there are no votes', () => {
    renderWithIntl(
      <MediaCard item={{ ...tvItem, voteCount: 0, voteAverage: 0 }} />
    );
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
    expect(screen.queryByText('Rating')).not.toBeInTheDocument();
  });

  it('renders the action outside the link', () => {
    renderWithIntl(<MediaCard item={tvItem} action={<button>Fav</button>} />);
    const button = screen.getByRole('button', { name: 'Fav' });
    expect(screen.getByRole('link')).not.toContainElement(button);
  });

  it('sizes the poster for a grid by default and for the given layout otherwise', () => {
    const { unmount } = renderWithIntl(<MediaCard item={tvItem} />);
    expect(document.querySelector('img')).toHaveAttribute(
      'sizes',
      GRID_POSTER_SIZES
    );
    unmount();
    renderWithIntl(<MediaCard item={tvItem} sizes={CAROUSEL_POSTER_SIZES} />);
    expect(document.querySelector('img')).toHaveAttribute(
      'sizes',
      CAROUSEL_POSTER_SIZES
    );
  });

  it('is lazy by default and eager with a high fetch priority when priority is set', () => {
    const { unmount } = renderWithIntl(<MediaCard item={tvItem} />);
    const lazy = document.querySelector('img');
    expect(lazy).toHaveAttribute('loading', 'lazy');
    expect(lazy).not.toHaveAttribute('fetchpriority');
    unmount();
    renderWithIntl(<MediaCard item={tvItem} priority />);
    const eager = document.querySelector('img');
    expect(eager).not.toHaveAttribute('loading', 'lazy');
    expect(eager).toHaveAttribute('fetchpriority', 'high');
  });
});
