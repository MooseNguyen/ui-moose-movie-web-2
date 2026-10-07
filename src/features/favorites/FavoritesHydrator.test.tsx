import { act, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { toast } from 'sonner';
import en from '@/messages/en.json';
import { stubLocalStorage } from '../../../tests/utils/memory-storage';
import { FavoritesHydrator } from './FavoritesHydrator';
import { resetSafeStorage, useFavorites } from './store';

vi.mock('sonner', () => ({ toast: vi.fn() }));

const initial = useFavorites.getInitialState();
const KEY = 'moose-favorites';
const stored = {
  id: 7,
  mediaType: 'movie',
  title: 'Seven',
  posterPath: null,
  voteAverage: 8,
  year: 1995,
  addedAt: 1,
};
const payload = (items: unknown[]) =>
  JSON.stringify({ state: { items }, version: 1 });

let storage: ReturnType<typeof stubLocalStorage>;

beforeEach(() => {
  storage = stubLocalStorage();
  resetSafeStorage();
  useFavorites.setState(initial, true);
  vi.mocked(toast).mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const mount = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <FavoritesHydrator />
    </NextIntlClientProvider>
  );

describe('FavoritesHydrator', () => {
  it('rehydrates from storage on mount and flags hasHydrated', async () => {
    storage.setItem(KEY, payload([stored]));
    await act(async () => void mount());
    expect(useFavorites.getState().hasHydrated).toBe(true);
    expect(useFavorites.getState().items.map((i) => i.id)).toEqual([7]);
    expect(toast).not.toHaveBeenCalled();
  });

  it('rehydrates when another tab writes the favorites key', async () => {
    await act(async () => void mount());
    expect(useFavorites.getState().items).toEqual([]);

    storage.setItem(KEY, payload([stored]));
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(useFavorites.getState().items.map((i) => i.id)).toEqual([7]);
  });

  it('rehydrates when another tab clears all storage (key null)', async () => {
    storage.setItem(KEY, payload([stored]));
    await act(async () => void mount());
    expect(useFavorites.getState().items).toHaveLength(1);

    storage.clear();
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });
    expect(useFavorites.getState().items).toEqual([]);
  });

  it('ignores storage events for other keys and removes its listener on unmount', async () => {
    const view = mount();
    await act(async () => {});
    const rehydrate = vi.spyOn(useFavorites.persist, 'rehydrate');
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme' }));
    });
    expect(rehydrate).not.toHaveBeenCalled();

    view.unmount();
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(rehydrate).not.toHaveBeenCalled();
  });

  it('toasts exactly once when storage is unavailable', async () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await act(async () => void mount());
    expect(useFavorites.getState().storageAvailable).toBe(false);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(en.favorites.storageUnavailable);

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
