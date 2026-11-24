// Gating for optional WebGL enhancements. No three.js import here: callers
// use these checks before deciding whether to download the 3D chunk at all.

export const FINE_POINTER_QUERY = '(pointer: fine)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const IDLE_TIMEOUT_MS = 2000;
const IDLE_FALLBACK_MS = 200;

export type EnhanceEnv = {
  /** `(pointer: fine)`: a mouse/trackpad, so hover and parallax make sense. */
  finePointer: boolean;
  /** `(prefers-reduced-motion: reduce)`. */
  reducedMotion: boolean;
  /** A WebGL2 context can be created (three's WebGLRenderer needs it). */
  webgl: boolean;
};

/** 3D is an enhancement for desktop pointers that accept motion. */
export function shouldEnhance({
  finePointer,
  reducedMotion,
  webgl,
}: EnhanceEnv): boolean {
  return finePointer && !reducedMotion && webgl;
}

/**
 * The cheap half of the gate (two media queries). Callers run it at once and
 * probe WebGL2 only later, when they are about to create a scene.
 */
export function prefersMotionOnFinePointer(): boolean {
  return (
    window.matchMedia(FINE_POINTER_QUERY).matches &&
    !window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

export function hasWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    // Release the probe context now: browsers cap live WebGL contexts.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, {
      timeout: IDLE_TIMEOUT_MS,
    });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, IDLE_FALLBACK_MS);
  return () => window.clearTimeout(id);
}

/**
 * Runs the callback once the page has loaded and the main thread is idle.
 * Waiting for `load` keeps three.js and its textures from competing with the
 * LCP image for bandwidth, and keeps the parse off the critical path.
 * Returns a cancel function.
 */
export function afterLoadWhenIdle(callback: () => void): () => void {
  if (document.readyState === 'complete') return whenIdle(callback);
  let cancelIdle: (() => void) | null = null;
  const onLoad = () => {
    cancelIdle = whenIdle(callback);
  };
  window.addEventListener('load', onLoad, { once: true });
  return () => {
    window.removeEventListener('load', onLoad);
    cancelIdle?.();
  };
}
