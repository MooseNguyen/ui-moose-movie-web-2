// The only place that imports the 3D scene (and with it three.js). Kept in
// its own module so tests can assert the chunk is never requested.
export const loadPosterWallScene = () => import('./poster-wall-scene');
