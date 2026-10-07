import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';
import type { MediaType } from '@/lib/tmdb/constants';
import { isFavoriteItem, type FavoriteItem } from './validate';

export type { FavoriteItem } from './validate';

export const FAVORITES_STORAGE_KEY = 'moose-favorites';
const PROBE_KEY = `${FAVORITES_STORAGE_KEY}-probe`;
const EMPTY_PAYLOAD = JSON.stringify({ state: { items: [] }, version: 1 });

type FavoritesState = {
  items: FavoriteItem[];
  /** False on the server and until the first client rehydrate has finished. */
  hasHydrated: boolean;
  /** False when localStorage is blocked and favorites live in memory only. */
  storageAvailable: boolean;
  toggle: (item: Omit<FavoriteItem, 'addedAt'>) => void;
  remove: (mediaType: MediaType, id: number) => void;
  clear: () => void;
};

// --- Storage ---------------------------------------------------------------

const memory = new Map<string, string>();
let backend: StateStorage | null = null;

function markUnavailable() {
  // The store is defined by the time any storage method runs (they are only
  // called from rehydrate / set), so this reference is safe.
  useFavorites.setState({ storageAvailable: false });
}

/** Returns real localStorage if a write round-trip works, else null. */
function probeLocalStorage(): Storage | null {
  try {
    const ls = window.localStorage;
    ls.setItem(PROBE_KEY, '1');
    ls.removeItem(PROBE_KEY);
    return ls;
  } catch {
    // Blocked (private mode, disabled cookies, quota 0): fall back to memory.
    return null;
  }
}

const memoryStorage: StateStorage = {
  getItem: (name) => memory.get(name) ?? null,
  setItem: (name, value) => void memory.set(name, value),
  removeItem: (name) => void memory.delete(name),
};

function resolveBackend(): StateStorage {
  if (backend) return backend;
  // Server render: never touch window. Not a "failure", so no flag.
  if (typeof window === 'undefined') return memoryStorage;
  const ls = probeLocalStorage();
  if (ls) {
    backend = ls;
  } else {
    backend = memoryStorage;
    markUnavailable();
  }
  return backend;
}

/**
 * @internal test-only. Forgets the cached backend and the memory fallback so
 * the next storage call probes again.
 */
export function resetSafeStorage() {
  backend = null;
  memory.clear();
}

/**
 * Lazy, failure-tolerant storage for the persist middleware. The backend is
 * resolved on first use (never at import time) so SSR and blocked storage
 * cannot crash module evaluation. A write that throws later (e.g. quota)
 * degrades to memory instead of losing the user's click.
 */
export function safeStorage(): StateStorage {
  return {
    getItem: (name) => {
      const raw = resolveBackend().getItem(name);
      if (typeof raw !== 'string') return raw;
      try {
        JSON.parse(raw);
        return raw;
      } catch {
        // Corrupt value: report "empty" so rehydrate resets to [] instead of
        // silently keeping stale in-memory items.
        return EMPTY_PAYLOAD;
      }
    },
    setItem: (name, value) => {
      try {
        resolveBackend().setItem(name, value);
      } catch {
        memory.set(name, value);
        backend = memoryStorage;
        markUnavailable();
      }
    },
    removeItem: (name) => {
      try {
        resolveBackend().removeItem(name);
      } catch {
        memory.delete(name);
      }
    },
  };
}

// --- Store -----------------------------------------------------------------

const keyOf = (mediaType: MediaType, id: number) => `${mediaType}:${id}`;

/** Rebuild from the 7 known fields so unknown keys are never re-persisted. */
function pickFields(i: FavoriteItem): FavoriteItem {
  return {
    id: i.id,
    mediaType: i.mediaType,
    title: i.title,
    posterPath: i.posterPath,
    voteAverage: i.voteAverage,
    year: i.year,
    addedAt: i.addedAt,
  };
}

const FALLBACK_TITLE = 'Untitled';

/**
 * Keep only well-formed items, first occurrence wins per mediaType+id.
 */
function sanitizeItems(value: unknown): FavoriteItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const items: FavoriteItem[] = [];
  for (const candidate of value) {
    if (!isFavoriteItem(candidate)) continue;
    const key = keyOf(candidate.mediaType, candidate.id);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(pickFields(candidate));
  }
  return items;
}

const itemsOf = (persisted: unknown): FavoriteItem[] =>
  typeof persisted === 'object' && persisted !== null && 'items' in persisted
    ? sanitizeItems(persisted.items)
    : [];

/**
 * Favorites store.
 *
 * Writes (`toggle`, `remove`, `clear`) are no-ops until `hasHydrated` is true:
 * a write before the first rehydrate would persist over the saved list, and
 * the later rehydrate would then read the overwritten value, losing data.
 * `toggle` also normalizes its input so everything stored passes
 * `isFavoriteItem`.
 */
export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,
      storageAvailable: true,
      // Guards run before `set`: persist's wrapped `set` writes to storage even
      // when the state is unchanged, which is exactly what must not happen.
      toggle: (input) => {
        if (!get().hasHydrated) return;
        if (!Number.isInteger(input.id) || input.id <= 0) return;
        set((state) => {
          const item = {
            id: input.id,
            mediaType: input.mediaType,
            title: input.title.trim() || FALLBACK_TITLE,
            posterPath: input.posterPath,
            voteAverage: input.voteAverage,
            year: input.year,
          };
          const exists = state.items.some(
            (i) => i.mediaType === item.mediaType && i.id === item.id
          );
          return {
            items: exists
              ? state.items.filter(
                  (i) => !(i.mediaType === item.mediaType && i.id === item.id)
                )
              : [...state.items, { ...item, addedAt: Date.now() }],
          };
        });
      },
      remove: (mediaType, id) => {
        if (!get().hasHydrated) return;
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.mediaType === mediaType && i.id === id)
          ),
        }));
      },
      clear: () => {
        if (!get().hasHydrated) return;
        set({ items: [] });
      },
    }),
    {
      name: FAVORITES_STORAGE_KEY,
      version: 1,
      // Hydrate in an effect (FavoritesHydrator) so server and first client
      // render agree; reading localStorage during render would mismatch.
      skipHydration: true,
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({ items: state.items }),
      // Any version we do not know is treated as unusable, not trusted.
      migrate: (persisted) => ({ items: itemsOf(persisted) }),
      merge: (persisted, current) => ({
        ...current,
        items: itemsOf(persisted),
      }),
    }
  )
);

// --- Selectors -------------------------------------------------------------

export const isFavorite = (
  state: Pick<FavoritesState, 'items'>,
  mediaType: MediaType,
  id: number
): boolean => state.items.some((i) => i.mediaType === mediaType && i.id === id);

/**
 * Newest first. Returns a new array, so do not pass it straight to a Zustand
 * hook (it would re-render on every store update): select `items` and sort in
 * a `useMemo`, or use `useShallow`.
 */
export const selectSorted = (
  state: Pick<FavoritesState, 'items'>,
  filter: 'all' | MediaType
): FavoriteItem[] =>
  state.items
    .filter((i) => filter === 'all' || i.mediaType === filter)
    .sort((a, b) => b.addedAt - a.addedAt);
