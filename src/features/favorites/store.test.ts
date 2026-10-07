import { stubLocalStorage } from '../../../tests/utils/memory-storage';
import {
  isFavorite,
  resetSafeStorage,
  selectSorted,
  useFavorites,
  type FavoriteItem,
} from './store';

const KEY = 'moose-favorites';
const initial = useFavorites.getInitialState();

const movie = {
  id: 1,
  mediaType: 'movie' as const,
  title: 'Movie One',
  posterPath: '/a.jpg',
  voteAverage: 7.5,
  year: 2020,
};
const show = { ...movie, id: 2, mediaType: 'tv' as const, title: 'Show Two' };

let storage: ReturnType<typeof stubLocalStorage>;

beforeEach(() => {
  storage = stubLocalStorage();
  resetSafeStorage();
  useFavorites.setState({ ...initial, hasHydrated: true }, true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const stored = (id: number, mediaType: 'movie' | 'tv', addedAt: number) => ({
  ...movie,
  id,
  mediaType,
  addedAt,
});

describe('actions', () => {
  it('toggle adds then removes, no duplicates', () => {
    const { toggle } = useFavorites.getState();
    toggle(movie);
    expect(useFavorites.getState().items).toHaveLength(1);
    expect(isFavorite(useFavorites.getState(), 'movie', 1)).toBe(true);
    toggle(movie);
    expect(useFavorites.getState().items).toEqual([]);
    expect(isFavorite(useFavorites.getState(), 'movie', 1)).toBe(false);
  });

  it('treats the same id with a different mediaType as a different item', () => {
    const { toggle } = useFavorites.getState();
    toggle(movie);
    toggle({ ...movie, mediaType: 'tv' });
    expect(useFavorites.getState().items).toHaveLength(2);
  });

  it('stamps addedAt with the current time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(12345);
    useFavorites.getState().toggle(movie);
    expect(useFavorites.getState().items[0].addedAt).toBe(12345);
  });

  it('remove deletes only the matching mediaType+id', () => {
    const { toggle, remove } = useFavorites.getState();
    toggle(movie);
    toggle({ ...movie, mediaType: 'tv' });
    remove('movie', 1);
    const items = useFavorites.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].mediaType).toBe('tv');
  });

  it('clear empties the list', () => {
    const { toggle, clear } = useFavorites.getState();
    toggle(movie);
    toggle(show);
    clear();
    expect(useFavorites.getState().items).toEqual([]);
  });

  it('persists items (only) under the moose-favorites key with version 1', () => {
    useFavorites.getState().toggle(movie);
    const raw = JSON.parse(storage.getItem(KEY) as string);
    expect(raw.version).toBe(1);
    expect(raw.state.items).toHaveLength(1);
    expect(Object.keys(raw.state)).toEqual(['items']);
  });
});

describe('before hydration', () => {
  const saved = JSON.stringify({
    state: { items: [stored(5, 'tv', 1)] },
    version: 1,
  });

  beforeEach(() => {
    useFavorites.setState({ hasHydrated: false });
    storage.setItem(KEY, saved);
  });

  it.each([
    ['toggle', () => useFavorites.getState().toggle(movie)],
    ['remove', () => useFavorites.getState().remove('tv', 5)],
    ['clear', () => useFavorites.getState().clear()],
  ])(
    '%s is a no-op: state and stored payload stay unchanged',
    async (_n, act) => {
      act();
      expect(useFavorites.getState().items).toEqual([]);
      expect(storage.getItem(KEY)).toBe(saved);

      await useFavorites.persist.rehydrate();
      expect(useFavorites.getState().items.map((i) => i.id)).toEqual([5]);
    }
  );

  it('actions work after rehydrate marks the store hydrated', async () => {
    await useFavorites.persist.rehydrate();
    useFavorites.setState({ hasHydrated: true });
    useFavorites.getState().toggle(movie);
    expect(useFavorites.getState().items).toHaveLength(2);
    useFavorites.getState().remove('tv', 5);
    expect(useFavorites.getState().items).toHaveLength(1);
    useFavorites.getState().clear();
    expect(useFavorites.getState().items).toEqual([]);
  });
});

describe('toggle normalization', () => {
  it('stores only the known fields', () => {
    useFavorites
      .getState()
      .toggle({ ...movie, overview: 'x' } as unknown as typeof movie);
    expect(Object.keys(useFavorites.getState().items[0]).sort()).toEqual([
      'addedAt',
      'id',
      'mediaType',
      'posterPath',
      'title',
      'voteAverage',
      'year',
    ]);
  });

  it('falls back to "Untitled" for a blank title and survives a reload', async () => {
    useFavorites.getState().toggle({ ...movie, title: '   ' });
    expect(useFavorites.getState().items[0].title).toBe('Untitled');
    const persisted = storage.getItem(KEY) as string;
    useFavorites.setState({ items: [] });
    storage.setItem(KEY, persisted);
    await useFavorites.persist.rehydrate();
    expect(useFavorites.getState().items.map((i) => i.title)).toEqual([
      'Untitled',
    ]);
  });

  it('trims the title', () => {
    useFavorites.getState().toggle({ ...movie, title: '  Padded ' });
    expect(useFavorites.getState().items[0].title).toBe('Padded');
  });

  it.each([0, -3, 1.5, NaN])('ignores invalid id %s', (id) => {
    const before = storage.getItem(KEY);
    useFavorites.getState().toggle({ ...movie, id });
    expect(useFavorites.getState().items).toEqual([]);
    expect(storage.getItem(KEY)).toBe(before);
  });
});

describe('selectSorted', () => {
  const items: FavoriteItem[] = [
    stored(1, 'movie', 100),
    stored(2, 'tv', 300),
    stored(3, 'movie', 200),
  ];
  const state = { ...initial, items };

  it('returns newest first', () => {
    expect(selectSorted(state, 'all').map((i) => i.id)).toEqual([2, 3, 1]);
  });

  it('filters by media type', () => {
    expect(selectSorted(state, 'movie').map((i) => i.id)).toEqual([3, 1]);
    expect(selectSorted(state, 'tv').map((i) => i.id)).toEqual([2]);
  });

  it('does not mutate the stored order', () => {
    selectSorted(state, 'all');
    expect(items.map((i) => i.id)).toEqual([1, 2, 3]);
  });
});

describe('rehydrate', () => {
  it('loads valid stored items', async () => {
    storage.setItem(
      KEY,
      JSON.stringify({ state: { items: [stored(5, 'tv', 1)] }, version: 1 })
    );
    await useFavorites.persist.rehydrate();
    expect(useFavorites.getState().items.map((i) => i.id)).toEqual([5]);
  });

  it('starts empty when stored JSON is corrupt', async () => {
    storage.setItem(KEY, 'not json');
    await useFavorites.persist.rehydrate();
    expect(useFavorites.getState().items).toEqual([]);
  });

  it('drops previously loaded items when the stored JSON becomes corrupt', async () => {
    useFavorites.getState().toggle(movie);
    storage.setItem(KEY, '{broken');
    await useFavorites.persist.rehydrate();
    expect(useFavorites.getState().items).toEqual([]);
  });

  it('starts empty when stored shape is wrong', async () => {
    storage.setItem(KEY, '{"state":{"items":[{"foo":1}]},"version":1}');
    await useFavorites.persist.rehydrate();
    expect(useFavorites.getState().items).toEqual([]);
  });

  it.each([
    '{"state":null,"version":1}',
    '{"state":{"items":"nope"},"version":1}',
    '[]',
    '42',
    '{"state":{"items":[{"foo":1}]},"version":0}',
  ])('starts empty for unusable payload %s', async (raw) => {
    storage.setItem(KEY, raw);
    await useFavorites.persist.rehydrate();
    expect(useFavorites.getState().items).toEqual([]);
  });

  it('keeps only valid items and dedupes by mediaType+id', async () => {
    storage.setItem(
      KEY,
      JSON.stringify({
        state: {
          items: [
            stored(1, 'movie', 1),
            { foo: 1 },
            stored(1, 'movie', 2),
            stored(1, 'tv', 3),
            { ...stored(9, 'movie', 4), title: '' },
          ],
        },
        version: 1,
      })
    );
    await useFavorites.persist.rehydrate();
    expect(
      useFavorites.getState().items.map((i) => `${i.mediaType}:${i.id}`)
    ).toEqual(['movie:1', 'tv:1']);
  });

  it('drops unknown fields from stored items', async () => {
    storage.setItem(
      KEY,
      JSON.stringify({
        state: { items: [{ ...stored(1, 'movie', 1), extra: 'x' }] },
        version: 1,
      })
    );
    await useFavorites.persist.rehydrate();
    expect(useFavorites.getState().items[0]).not.toHaveProperty('extra');
    useFavorites.getState().toggle(show);
    const raw = JSON.parse(storage.getItem(KEY) as string);
    expect(raw.state.items.every((i: object) => !('extra' in i))).toBe(true);
  });

  it('does not reset hasHydrated or storageAvailable', async () => {
    useFavorites.setState({ hasHydrated: true, storageAvailable: false });
    await useFavorites.persist.rehydrate();
    expect(useFavorites.getState().hasHydrated).toBe(true);
  });
});

describe('storage fallback', () => {
  it('keeps working in memory and flags storageAvailable=false when storage throws', async () => {
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    await useFavorites.persist.rehydrate();
    expect(() => useFavorites.getState().toggle(movie)).not.toThrow();
    expect(isFavorite(useFavorites.getState(), 'movie', 1)).toBe(true);
    expect(useFavorites.getState().storageAvailable).toBe(false);

    // Read-back goes through the memory fallback.
    await useFavorites.persist.rehydrate();
    expect(useFavorites.getState().items).toHaveLength(1);
  });

  it('survives when accessing localStorage itself throws', async () => {
    vi.unstubAllGlobals();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    resetSafeStorage();
    await expect(useFavorites.persist.rehydrate()).resolves.not.toThrow();
    expect(() => useFavorites.getState().toggle(movie)).not.toThrow();
    expect(useFavorites.getState().storageAvailable).toBe(false);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('stays available and leaves no probe key behind when storage works', async () => {
    await useFavorites.persist.rehydrate();
    expect(useFavorites.getState().storageAvailable).toBe(true);
    expect(storage.getItem('moose-favorites-probe')).toBeNull();
  });
});
