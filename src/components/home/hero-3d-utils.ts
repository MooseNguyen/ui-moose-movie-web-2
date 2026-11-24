// Pure helpers for the 3D hero. No three.js import here: Hero3D and the tests
// use them without pulling the 3D chunk.

/** The slice of a trending item the 3D scene needs. */
export type HeroSceneItem = {
  id: number;
  /** Poster path, or null (the card keeps its placeholder colour). */
  posterPath: string | null;
};

/** Index `i` wrapped into 0..count-1 (also for negative steps). */
export function wrapIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

/** Angle of item `index` on the orbit; item 0 starts at the front (0). */
export function orbitAngle(index: number, count: number): number {
  return count > 0 ? (index / count) * Math.PI * 2 : 0;
}

/**
 * Orbit rotation that brings `index` to the front, chosen among the
 * equivalent angles (± 2π) as the one closest to `current`, so the orbit
 * always turns the short way round, also across the wrap from last to first.
 */
export function rotationToFront(
  index: number,
  count: number,
  current: number
): number {
  const target = -orbitAngle(index, count);
  const turns = Math.round((current - target) / (Math.PI * 2));
  return target + turns * Math.PI * 2;
}

export type OrbitOptions = {
  /** Horizontal radius of the orbit. */
  radiusX: number;
  /** Depth radius of the orbit. */
  radiusZ: number;
  /** How much higher the back of the orbit sits than the front. */
  lift: number;
  /** How far a card turns towards the orbit's centre line (0..1). */
  yawFactor: number;
};

export type OrbitSlot = {
  x: number;
  y: number;
  z: number;
  /** Y rotation of the card. */
  yaw: number;
  /** 0 at the front of the orbit, 1 at the back. */
  depth: number;
};

/**
 * Position of a card at angle `theta` on a tilted elliptical orbit. The front
 * (theta 0) is nearest to the camera; cards behind sit higher, so every card
 * stays visible above the ones in front of it. Cards keep facing the camera
 * (only a slight yaw), so no poster is ever seen from behind.
 */
export function orbitSlot(
  theta: number,
  { radiusX, radiusZ, lift, yawFactor }: OrbitOptions
): OrbitSlot {
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const depth = (1 - cos) / 2;
  return {
    x: radiusX * sin,
    y: lift * depth,
    z: radiusZ * cos,
    // `+ 0` turns -0 into 0.
    yaw: sin * yawFactor + 0,
    depth,
  };
}

/**
 * Horizontal offset of the orbit's centre, so the front card sits to the
 * right of the text column on wide stages (and centred on narrow ones).
 * `distance` is the camera's distance to the front card.
 */
export function orbitCenterX(
  aspect: number,
  fovDeg: number,
  distance: number
): number {
  const halfHeight = distance * Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const halfWidth = halfHeight * aspect;
  // 0.46: the front card lands at ~73% of the stage width, so the whole
  // orbit stays clear of the text, which takes at most ~42% on wide screens.
  const fraction = aspect >= 1.3 ? 0.46 : aspect >= 1 ? 0.25 : 0;
  return halfWidth * fraction;
}

/**
 * How far the hero has scrolled out of view: 0 while its top is at (or
 * below) the viewport top, 1 once its bottom has left the viewport top.
 */
export function heroScrollProgress(rect: {
  top: number;
  height: number;
}): number {
  if (rect.height <= 0) return 0;
  return Math.min(1, Math.max(0, -rect.top / rect.height));
}
