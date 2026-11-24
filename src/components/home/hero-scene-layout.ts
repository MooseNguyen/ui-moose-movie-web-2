// Pure math for the 3D hero. No three.js import, so it is unit-tested
// without WebGL and costs nothing in the main bundle.

/** The slice of a trending item the 3D hero needs (client-safe, serializable). */
export type HeroSceneItem = {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string | null;
};

/**
 * Signed distance of a poster from the focus along a looping list, in
 * [-count/2, count/2): neighbours on either side of the selected poster,
 * also across the loop seam (the last poster sits left of the first).
 */
export function loopOffset(offset: number, count: number): number {
  if (count <= 0) return 0;
  const half = count / 2;
  return ((((offset + half) % count) + count) % count) - half;
}

/**
 * The focus value equivalent to `target` (mod count) that is closest to
 * `current`, so the arc always turns the short way round, also across the
 * loop seam.
 */
export function nearestFocus(
  current: number,
  target: number,
  count: number
): number {
  if (count <= 0) return target;
  return target + count * Math.round((current - target) / count);
}

/**
 * Opacity of a poster `distance` slots away from the focus: 1 near the
 * focus, fading to 0 at `visible` slots (never past the loop seam, where a
 * poster jumps from one end to the other).
 */
export function edgeFade(
  distance: number,
  count: number,
  visible: number
): number {
  const limit = Math.min(visible, count / 2);
  const t = Math.min(1, Math.max(0, (limit - Math.abs(distance)) / 1.25));
  return t * t * (3 - 2 * t);
}

/**
 * How far the hero has scrolled out of view: 0 while its top is at or below
 * the viewport top, 1 once it has scrolled up by its own height.
 */
export function heroScrollProgress(rect: {
  top: number;
  height: number;
}): number {
  if (rect.height <= 0) return 0;
  return Math.min(1, Math.max(0, -rect.top / rect.height));
}
