// @vitest-environment node
describe('favorites store on the server', () => {
  it('imports and reads state without touching window or localStorage', async () => {
    expect(typeof window).toBe('undefined');
    const access = vi.fn(() => {
      throw new Error('localStorage must not be accessed on the server');
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: access,
    });

    const { useFavorites, isFavorite } = await import('./store');
    expect(useFavorites.getState().items).toEqual([]);
    expect(useFavorites.getState().hasHydrated).toBe(false);
    expect(isFavorite(useFavorites.getState(), 'movie', 1)).toBe(false);
    await expect(useFavorites.persist.rehydrate()).resolves.not.toThrow();
    expect(access).not.toHaveBeenCalled();
  });
});
