/**
 * In-memory localStorage stand-in. Node's experimental global `localStorage`
 * shadows jsdom's in this environment and lacks `clear()`, so tests stub it.
 */
export function stubLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, String(value)),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
  vi.stubGlobal('localStorage', storage);
  return storage;
}
