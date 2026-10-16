/** Largest card tilt, in degrees, when the pointer sits on a corner. */
export const TILT_MAX_DEG = 8;

type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export type Tilt = {
  /** rotateX in degrees: positive pushes the top edge away. */
  rx: number;
  /** rotateY in degrees: positive pushes the right edge away. */
  ry: number;
  /** Glare centre, in % of the card width / height. */
  gx: number;
  gy: number;
};

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

/**
 * Tilt for a pointer at (x, y) over a card: the side under the pointer moves
 * away from the viewer and the glare follows the pointer. Points outside the
 * card are clamped to its edges.
 */
export function tiltFromPointer(
  rect: Rect,
  x: number,
  y: number,
  max: number = TILT_MAX_DEG
): Tilt {
  const px = rect.width > 0 ? clamp01((x - rect.left) / rect.width) : 0.5;
  const py = rect.height > 0 ? clamp01((y - rect.top) / rect.height) : 0.5;
  // `+ 0` turns -0 into 0, so a centred pointer reads as exactly flat.
  return {
    rx: (0.5 - py) * 2 * max + 0,
    ry: (px - 0.5) * 2 * max + 0,
    gx: px * 100,
    gy: py * 100,
  };
}
