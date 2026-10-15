// Pure helpers for the 3D poster wall. No three.js import here: the enhancer
// uses these before deciding whether to download the 3D chunk at all.

/** The slice of a trending item the 3D wall needs (client-safe, serializable). */
export type WallItem = {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  posterPath: string;
};

export type EnhanceEnv = {
  /** `(pointer: fine)`: a mouse/trackpad, so hover and parallax make sense. */
  finePointer: boolean;
  /** `(prefers-reduced-motion: reduce)`. */
  reducedMotion: boolean;
  /** A WebGL2 context can be created (three r186's WebGLRenderer needs it). */
  webgl: boolean;
};

/** The 3D wall is an enhancement for desktop pointers that accept motion. */
export function shouldEnhance({
  finePointer,
  reducedMotion,
  webgl,
}: EnhanceEnv): boolean {
  return finePointer && !reducedMotion && webgl;
}

/**
 * Progress (0..1) through a sticky scroll track: 0 while the track's top is
 * at or below the viewport top, 1 once the pinned stage is about to scroll
 * away (the track's bottom reaches the viewport bottom).
 */
export function scrollProgress(
  rect: { top: number; height: number },
  viewportHeight: number
): number {
  const distance = rect.height - viewportHeight;
  if (distance <= 0) return rect.top < 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -rect.top / distance));
}

export type WallLayoutOptions = {
  rows?: number;
  /** Cylinder radius; the camera starts on its axis. */
  radius?: number;
  /** Horizontal angle (radians) the cards spread over, centred on -z. */
  arc?: number;
  cardHeight?: number;
  /** Vertical gap between rows. */
  gap?: number;
};

export type WallSlot = {
  x: number;
  y: number;
  z: number;
  /** Y rotation that turns a +z-facing plane towards the cylinder axis. */
  rotationY: number;
};

/**
 * Lays `count` cards row-major on the inside of a cylinder arc. Odd rows are
 * shifted by half a column (brick pattern), and the whole pattern by a
 * quarter column the other way, so it stays centred.
 */
export function wallLayout(
  count: number,
  {
    rows = 3,
    radius = 9,
    arc = 1.15 * Math.PI,
    cardHeight = 2.4,
    gap = 0.25,
  }: WallLayoutOptions = {}
): WallSlot[] {
  if (count <= 0) return [];
  const rowsUsed = Math.min(rows, count);
  const cols = Math.ceil(count / rowsUsed);
  const step = arc / cols;
  const rowCentre = (rowsUsed - 1) / 2;
  const centring = rowsUsed > 1 ? -0.25 : 0;

  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const offset = row % 2 === 1 ? 0.5 : 0;
    const angle = (col - (cols - 1) / 2 + offset + centring) * step;
    return {
      x: radius * Math.sin(angle),
      y: (rowCentre - row) * (cardHeight + gap),
      z: -radius * Math.cos(angle),
      rotationY: -angle,
    };
  });
}
