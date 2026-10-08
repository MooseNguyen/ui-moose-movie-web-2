import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetSafeStorage, useFavorites } from '@/features/favorites/store';
import { stubLocalStorage } from '../../../tests/utils/memory-storage';
import { renderWithIntl } from '../../../tests/utils/render';
import { PersonCredits, type CreditItem } from './PersonCredits';

vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);

const credit = (
  id: number,
  mediaType: 'movie' | 'tv',
  title = `${mediaType} ${id}`
): CreditItem => ({
  id,
  mediaType,
  title,
  posterPath: null,
  year: 2000,
  voteAverage: 7,
  voteCount: 10,
});

const range = (from: number, count: number, mediaType: 'movie' | 'tv') =>
  Array.from({ length: count }, (_, i) => credit(from + i, mediaType));

const initial = useFavorites.getInitialState();
beforeEach(() => {
  stubLocalStorage();
  resetSafeStorage();
  useFavorites.setState(initial, true);
});
afterEach(() => vi.unstubAllGlobals());

const cardLinks = () =>
  within(screen.getByRole('tabpanel')).getAllByRole('link');
const showMore = () =>
  screen.queryByRole('button', { name: 'Show more titles' });

describe('PersonCredits', () => {
  it('renders All / Movies / TV tabs with counts', () => {
    renderWithIntl(
      <PersonCredits
        credits={[...range(1, 3, 'movie'), ...range(10, 2, 'tv')]}
      />
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'All (5)',
      'Movies (3)',
      'TV Series (2)',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(cardLinks()).toHaveLength(5);
  });

  it('groups large counts by locale', () => {
    renderWithIntl(<PersonCredits credits={range(1, 1200, 'movie')} />);
    expect(
      screen.getByRole('tab', { name: 'All (1,200)' })
    ).toBeInTheDocument();
  });

  it('keeps only tv credits in the TV tab', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <PersonCredits
        credits={[
          credit(1, 'movie', 'Fight Club'),
          credit(2, 'tv', 'Friends'),
          credit(3, 'movie', 'Se7en'),
          credit(4, 'tv', 'The Office'),
        ]}
      />
    );

    await user.click(screen.getByRole('tab', { name: 'TV Series (2)' }));

    expect(cardLinks().map((link) => link.getAttribute('href'))).toEqual([
      '/en/tv/2',
      '/en/tv/4',
    ]);
    expect(screen.queryByText('Fight Club')).not.toBeInTheDocument();
  });

  it('keeps only movie credits in the Movies tab', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <PersonCredits credits={[credit(1, 'movie'), credit(2, 'tv')]} />
    );

    await user.click(screen.getByRole('tab', { name: 'Movies (1)' }));

    expect(cardLinks().map((link) => link.getAttribute('href'))).toEqual([
      '/en/movie/1',
    ]);
  });

  it('renders a favorite button on each card', () => {
    renderWithIntl(<PersonCredits credits={[credit(1, 'movie', 'Se7en')]} />);
    expect(
      screen.getByRole('button', { name: 'Favorite: Se7en' })
    ).toBeInTheDocument();
  });

  it('hides a media type tab that has no credits', () => {
    renderWithIntl(<PersonCredits credits={range(1, 2, 'movie')} />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'All (2)',
      'Movies (2)',
    ]);
  });

  it('shows an empty message instead of tabs when there are no credits', () => {
    renderWithIntl(<PersonCredits credits={[]} />);

    expect(screen.getByRole('status')).toHaveTextContent('No credits yet.');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('shows 24 cards first and reveals 24 more per click', async () => {
    const user = userEvent.setup();
    renderWithIntl(<PersonCredits credits={range(1, 60, 'movie')} />);

    expect(cardLinks()).toHaveLength(24);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('');

    await user.click(showMore()!);
    expect(cardLinks()).toHaveLength(48);
    expect(status).toHaveTextContent('Showing 24 more titles, 48 of 60');
    // Focus stays on the button while there is more to show.
    expect(showMore()).toHaveFocus();

    await user.click(showMore()!);
    expect(cardLinks()).toHaveLength(60);
    expect(status).toHaveTextContent('Showing 12 more titles, 60 of 60');
    expect(showMore()).not.toBeInTheDocument();
    // The button is gone: focus moves to the last card instead of <body>.
    const links = cardLinks();
    expect(links[links.length - 1]).toHaveFocus();
  });

  it('does not render the button when everything fits', () => {
    renderWithIntl(<PersonCredits credits={range(1, 24, 'movie')} />);
    expect(cardLinks()).toHaveLength(24);
    expect(showMore()).not.toBeInTheDocument();
  });

  it('resets to 24 cards when switching tabs', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <PersonCredits
        credits={[...range(1, 30, 'movie'), ...range(100, 30, 'tv')]}
      />
    );

    await user.click(showMore()!);
    expect(cardLinks()).toHaveLength(48);

    await user.click(screen.getByRole('tab', { name: 'Movies (30)' }));
    expect(cardLinks()).toHaveLength(24);

    await user.click(screen.getByRole('tab', { name: 'All (60)' }));
    expect(cardLinks()).toHaveLength(24);
  });

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <PersonCredits credits={[credit(1, 'movie'), credit(2, 'tv')]} />
    );

    const [all, movies, tv] = screen.getAllByRole('tab');
    act(() => all.focus());
    await user.keyboard('{ArrowRight}');
    expect(movies).toHaveFocus();
    expect(movies).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(tv).toHaveFocus();
    expect(cardLinks().map((link) => link.getAttribute('href'))).toEqual([
      '/en/tv/2',
    ]);
  });

  it('labels the tablist', () => {
    renderWithIntl(<PersonCredits credits={[credit(1, 'movie')]} />);
    expect(
      screen.getByRole('tablist', { name: 'Filter credits' })
    ).toBeInTheDocument();
  });
});
