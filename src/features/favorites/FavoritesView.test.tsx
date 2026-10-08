import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast, type Action } from 'sonner';
import { stubLocalStorage } from '../../../tests/utils/memory-storage';
import { renderWithIntl } from '../../../tests/utils/render';
import { FavoritesView } from './FavoritesView';
import { resetSafeStorage, useFavorites, type FavoriteItem } from './store';

vi.mock('sonner', () => ({ toast: vi.fn() }));
vi.mock(
  '@/i18n/navigation',
  () => import('../../../tests/utils/mock-navigation')
);

const KEY = 'moose-favorites';
const HEADING_ID = 'favorites-heading';
const initial = useFavorites.getInitialState();

const fav = (
  id: number,
  mediaType: 'movie' | 'tv',
  addedAt: number,
  overrides: Partial<FavoriteItem> = {}
): FavoriteItem => ({
  id,
  mediaType,
  title: `${mediaType} ${id}`,
  posterPath: null,
  voteAverage: 7.5,
  year: 2020,
  addedAt,
  ...overrides,
});

let storage: ReturnType<typeof stubLocalStorage>;

beforeEach(() => {
  storage = stubLocalStorage();
  resetSafeStorage();
  useFavorites.setState(initial, true);
  vi.mocked(toast).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

function seed(items: FavoriteItem[]) {
  useFavorites.setState({ hasHydrated: true, items });
}

function renderView() {
  return renderWithIntl(
    <>
      <h1 id={HEADING_ID} tabIndex={-1}>
        Your favorites
      </h1>
      <FavoritesView headingId={HEADING_ID} />
    </>
  );
}

const panel = () => screen.getByRole('tabpanel');
const cardHrefs = () =>
  within(panel())
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'));
const removeButton = (title: string) =>
  screen.getByRole('button', { name: `Remove ${title} from favorites` });
const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

describe('FavoritesView', () => {
  it('renders a loading skeleton until the store has hydrated', () => {
    useFavorites.setState({ items: [fav(1, 'movie', 1)] });
    renderView();

    expect(screen.getByRole('status')).toHaveTextContent('Loading favorites…');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    act(() => useFavorites.setState({ hasHydrated: true }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(cardHrefs()).toEqual(['/en/movie/1']);
  });

  it('shows a prompt and a link to /en/discover when the list is empty', () => {
    seed([]);
    renderView();

    expect(
      screen.getByText(/You have not saved any favorites yet/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Discover movies and TV series' })
    ).toHaveAttribute('href', '/en/discover');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Clear all' })
    ).not.toBeInTheDocument();
  });

  it('lists favorites newest first', () => {
    seed([fav(1, 'movie', 100), fav(2, 'tv', 300), fav(3, 'movie', 200)]);
    renderView();

    expect(cardHrefs()).toEqual(['/en/tv/2', '/en/movie/3', '/en/movie/1']);
  });

  it('shows tab counts and hides a media type tab without items', () => {
    seed([fav(1, 'movie', 1), fav(2, 'movie', 2)]);
    renderView();

    expect(
      screen.getByRole('tablist', { name: 'Filter favorites' })
    ).toBeInTheDocument();
    expect(tabNames()).toEqual(['All (2)', 'Movies (2)']);
  });

  it('groups large counts by locale', () => {
    seed(Array.from({ length: 1200 }, (_, i) => fav(i + 1, 'tv', i)));
    renderView();

    expect(tabNames()).toEqual(['All (1,200)', 'TV Series (1,200)']);
  });

  it('shows only tv items in the TV tab', async () => {
    const user = userEvent.setup();
    seed([fav(1, 'movie', 1), fav(2, 'tv', 2), fav(3, 'tv', 3)]);
    renderView();

    expect(tabNames()).toEqual(['All (3)', 'Movies (1)', 'TV Series (2)']);
    await user.click(screen.getByRole('tab', { name: 'TV Series (2)' }));

    expect(cardHrefs()).toEqual(['/en/tv/3', '/en/tv/2']);
  });

  it('hides the rating of an item without a vote average', () => {
    seed([
      fav(1, 'movie', 1, { title: 'Unrated', voteAverage: 0 }),
      fav(2, 'movie', 2, { title: 'Rated', voteAverage: 8.2 }),
    ]);
    renderView();

    const [rated, unrated] = within(panel()).getAllByRole('listitem');
    expect(rated).toHaveTextContent('8.2');
    expect(within(rated).getByText('Rating')).toBeInTheDocument();
    expect(within(unrated).queryByText('Rating')).not.toBeInTheDocument();
  });

  it('renders a remove button instead of the favorite toggle', () => {
    seed([fav(1, 'movie', 1, { title: 'Dune' })]);
    renderView();

    expect(removeButton('Dune')).toHaveAttribute('type', 'button');
    expect(
      screen.queryByRole('button', { name: 'Favorite: Dune' })
    ).not.toBeInTheDocument();
  });

  describe('removing an item', () => {
    const items = [
      fav(1, 'movie', 300, { title: 'First' }),
      fav(2, 'movie', 200, { title: 'Second' }),
      fav(3, 'movie', 100, { title: 'Third' }),
    ];

    it('removes it, shows an undo toast and focuses the next remove button', async () => {
      const user = userEvent.setup();
      seed(items);
      renderView();

      await user.click(removeButton('First'));

      expect(useFavorites.getState().items.map((i) => i.id)).toEqual([2, 3]);
      expect(cardHrefs()).toEqual(['/en/movie/2', '/en/movie/3']);
      expect(toast).toHaveBeenCalledWith(
        'First removed from favorites',
        expect.objectContaining({
          action: expect.objectContaining({ label: 'Undo' }),
          // Longer than sonner's 4s default so Undo stays reachable.
          duration: 10_000,
        })
      );
      expect(removeButton('Second')).toHaveFocus();
    });

    it('leaves focus alone when the removal turns out to be a no-op', async () => {
      const user = userEvent.setup();
      seed(items);
      renderView();
      // Simulates an item already removed elsewhere (e.g. another tab) before
      // this view re-rendered: the store action changes nothing.
      act(() => useFavorites.setState({ remove: () => {} }));

      await user.click(removeButton('Second'));
      expect(removeButton('Second')).toHaveFocus();
      expect(toast).not.toHaveBeenCalled();

      // An unrelated later change must not move focus to a stale index.
      act(() =>
        useFavorites.setState((s) => ({
          items: [...s.items, fav(9, 'movie', 999, { title: 'Newest' })],
        }))
      );
      expect(cardHrefs()[0]).toBe('/en/movie/9');
      expect(removeButton('Second')).toHaveFocus();
    });

    it('focuses the previous remove button when the last item is removed', async () => {
      const user = userEvent.setup();
      seed(items);
      renderView();

      await user.click(removeButton('Third'));

      expect(removeButton('Second')).toHaveFocus();
    });

    it('focuses the heading when the list becomes empty', async () => {
      const user = userEvent.setup();
      seed([items[0]]);
      renderView();

      await user.click(removeButton('First'));

      expect(
        screen.getByRole('link', { name: 'Discover movies and TV series' })
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    });

    it('switches to All and focuses the heading when the active tab empties', async () => {
      const user = userEvent.setup();
      seed([
        fav(1, 'movie', 1, { title: 'Movie' }),
        fav(2, 'tv', 2, { title: 'Show' }),
      ]);
      renderView();

      await user.click(screen.getByRole('tab', { name: 'TV Series (1)' }));
      await user.click(removeButton('Show'));

      expect(tabNames()).toEqual(['All (1)', 'Movies (1)']);
      expect(screen.getByRole('tab', { name: 'All (1)' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(cardHrefs()).toEqual(['/en/movie/1']);
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    });

    it('restores the item at its previous position on undo', async () => {
      const user = userEvent.setup();
      seed(items);
      renderView();

      await user.click(removeButton('Second'));
      expect(cardHrefs()).toEqual(['/en/movie/1', '/en/movie/3']);
      const focused = document.activeElement;

      const [, options] = vi.mocked(toast).mock.calls[0];
      // What sonner runs when the toast's Undo button is clicked.
      const undo = options?.action as Action;
      act(() => undo.onClick({} as Parameters<Action['onClick']>[0]));

      expect(cardHrefs()).toEqual([
        '/en/movie/1',
        '/en/movie/2',
        '/en/movie/3',
      ]);
      expect(useFavorites.getState().items.find((i) => i.id === 2)).toEqual(
        items[1]
      );
      expect(document.activeElement).toBe(focused);
    });
  });

  describe('clear all', () => {
    const items = [fav(1, 'movie', 1), fav(2, 'tv', 2)];

    it('keeps everything when the confirmation is cancelled', async () => {
      const user = userEvent.setup();
      seed(items);
      renderView();

      const trigger = screen.getByRole('button', { name: 'Clear all' });
      await user.click(trigger);
      const dialog = screen.getByRole('alertdialog', {
        name: 'Clear all favorites?',
      });
      expect(dialog).toHaveTextContent('This removes 2 titles');
      expect(useFavorites.getState().items).toHaveLength(2);

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(useFavorites.getState().items).toHaveLength(2);
      expect(cardHrefs()).toHaveLength(2);
      await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('clears only after confirmation and focuses the Discover link', async () => {
      const user = userEvent.setup();
      seed(items);
      renderView();

      await user.click(screen.getByRole('button', { name: 'Clear all' }));
      expect(useFavorites.getState().items).toHaveLength(2);

      await user.click(screen.getByRole('button', { name: 'Yes, clear all' }));

      expect(useFavorites.getState().items).toEqual([]);
      const link = screen.getByRole('link', {
        name: 'Discover movies and TV series',
      });
      await waitFor(() => expect(link).toHaveFocus());
      expect(
        screen.queryByRole('button', { name: 'Clear all' })
      ).not.toBeInTheDocument();
    });
  });

  it('updates when another tab changes the stored favorites', async () => {
    seed([fav(1, 'movie', 1)]);
    renderView();
    expect(cardHrefs()).toEqual(['/en/movie/1']);

    // What FavoritesHydrator does on a `storage` event from another tab.
    storage.setItem(
      KEY,
      JSON.stringify({
        state: { items: [fav(1, 'movie', 1), fav(5, 'tv', 2)] },
        version: 1,
      })
    );
    await act(async () => {
      await useFavorites.persist.rehydrate();
    });

    expect(cardHrefs()).toEqual(['/en/tv/5', '/en/movie/1']);
    expect(tabNames()).toEqual(['All (2)', 'Movies (1)', 'TV Series (1)']);
  });
});
