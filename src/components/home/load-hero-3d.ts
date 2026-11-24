// The only place that imports the 3D hero (and with it three.js). Kept in its
// own module so tests can assert the chunks are never requested.
export async function loadHero3D() {
  const [{ Hero3D }, { createHeroScene }] = await Promise.all([
    import('./Hero3D'),
    import('./hero-scene'),
  ]);
  return { Hero3D, createHeroScene };
}

export type LoadedHero3D = Awaited<ReturnType<typeof loadHero3D>>;
