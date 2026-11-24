// Gating for optional WebGL enhancements. No three.js import here: callers
// use these checks to decide whether to download the 3D chunk at all.

export const FINE_POINTER = '(pointer: fine)';
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

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
 * The cheap half of the gate (media queries only). Callers check it at once
 * and probe WebGL later, so touch devices never create a context.
 */
export function prefersEnhancement(): boolean {
  return (
    window.matchMedia(FINE_POINTER).matches &&
    !window.matchMedia(REDUCED_MOTION).matches
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
 * hero image (the LCP element) for bandwidth and the main thread. Returns a
 * cancel function.
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
