import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { stubLocalStorage } from '../../../tests/utils/memory-storage';
import { renderWithIntl } from '../../../tests/utils/render';
import { FavoriteButton } from './FavoriteButton';
import { resetSafeStorage, useFavorites } from './store';

const initial = useFavorites.getInitialState();
const item = {
  id: 414906,
  mediaType: 'movie' as const,
  title: 'The Batman',
  posterPath: '/b.jpg',
  voteAverage: 7.7,
  year: 2022,
};

beforeEach(() => {
  stubLocalStorage();
  resetSafeStorage();
  useFavorites.setState(initial, true);
});
afterEach(() => vi.unstubAllGlobals());

const hydrate = () => act(() => useFavorites.setState({ hasHydrated: true }));

describe('FavoriteButton', () => {
  it('is neutral and disabled before hydration', async () => {
    const user = userEvent.setup();
    renderWithIntl(<FavoriteButton item={item} />);
    const button = screen.getByRole('button', { name: 'Favorite: The Batman' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(useFavorites.getState().items).toEqual([]);
  });

  it('is enabled after hydration and toggles aria-pressed on click', async () => {
    const user = userEvent.setup();
    renderWithIntl(<FavoriteButton item={item} />);
    hydrate();
    const button = screen.getByRole('button', { name: 'Favorite: The Batman' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(useFavorites.getState().items).toHaveLength(1);

    await user.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(useFavorites.getState().items).toEqual([]);
  });

  it('keeps a constant accessible name regardless of state', async () => {
    const user = userEvent.setup();
    renderWithIntl(<FavoriteButton item={item} />);
    hydrate();
    const before = screen.getByRole('button').getAttribute('aria-label');
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(before);
    expect(before).toBe('Favorite: The Batman');
  });

  it('localises the accessible name', () => {
    renderWithIntl(<FavoriteButton item={item} />, 'vi');
    expect(
      screen.getByRole('button', { name: 'Yêu thích: The Batman' })
    ).toBeInTheDocument();
  });

  it('reflects an item already in the store as pressed', () => {
    useFavorites.setState({
      hasHydrated: true,
      items: [{ ...item, addedAt: 1 }],
    });
    renderWithIntl(<FavoriteButton item={item} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('does not trigger a parent click handler or default action', async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();
    renderWithIntl(
      <div onClick={parentClick}>
        <FavoriteButton item={item} />
      </div>
    );
    hydrate();
    const clickEvents: MouseEvent[] = [];
    // Capture phase: the button stops propagation, so a bubbling listener
    // would never see the event.
    document.addEventListener('click', (e) => clickEvents.push(e), {
      capture: true,
      once: true,
    });
    await user.click(screen.getByRole('button'));
    expect(clickEvents[0]?.defaultPrevented).toBe(true);
    expect(parentClick).not.toHaveBeenCalled();
    expect(useFavorites.getState().items).toHaveLength(1);
  });
});
