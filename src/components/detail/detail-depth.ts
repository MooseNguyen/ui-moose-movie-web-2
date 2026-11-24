// Pure helpers for the Detail hero's layered parallax (DetailHeroDepth).

type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export type DepthPointer = {
  /** -1 at the left edge, 1 at the right edge. */
  x: number;
  /** -1 at the top edge, 1 at the bottom edge. */
  y: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Pointer position over the hero, normalised to -1..1 on both axes from its
 * centre. Points outside are clamped to the edges; a zero-size hero reads as
 * centred.
 */
export function depthFromPointer(
  rect: Rect,
  x: number,
  y: number
): DepthPointer {
  // `+ 0` turns -0 into 0, so a centred pointer reads as exactly 0.
  return {
    x:
      rect.width > 0
        ? clamp(((x - rect.left) / rect.width) * 2 - 1, -1, 1) + 0
        : 0,
    y:
      rect.height > 0
        ? clamp(((y - rect.top) / rect.height) * 2 - 1, -1, 1) + 0
        : 0,
  };
}

/**
 * How many pixels the hero has scrolled past the viewport top, from 0 (top
 * at or below the viewport top) to its height (fully scrolled away).
 */
export function scrollDepth(rect: Pick<DOMRect, 'top' | 'height'>): number {
  return clamp(-rect.top, 0, Math.max(rect.height, 0));
}

/**
 * One frame of exponential smoothing towards `target`. Snaps once within
 * `epsilon`, so callers can stop their animation loop.
 */
export function approach(
  current: number,
  target: number,
  factor = 0.15,
  epsilon = 0.001
): number {
  const next = current + (target - current) * factor;
  return Math.abs(target - next) < epsilon ? target : next;
}
