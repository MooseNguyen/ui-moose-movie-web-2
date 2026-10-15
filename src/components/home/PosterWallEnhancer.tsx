'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { PosterWall } from './poster-wall-scene';
import { loadPosterWallScene } from './load-poster-wall-scene';
import {
  scrollProgress,
  shouldEnhance,
  type EnhanceEnv,
  type WallItem,
} from './poster-wall-utils';

type Status = 'off' | 'ready' | 'failed';

const IDLE_TIMEOUT_MS = 2000;
const IDLE_FALLBACK_MS = 200;

function hasWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    // Release the probe context now: browsers cap live WebGL contexts.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

function detectEnv(): EnhanceEnv {
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  // Creating a context is not free: probe only when it can matter.
  const webgl = finePointer && !reducedMotion && hasWebGL2();
  return { finePointer, reducedMotion, webgl };
}

/**
 * Runs the callback once the page has loaded and the main thread is idle.
 * Waiting for `load` keeps three.js and the poster textures from competing
 * with the hero image (the LCP element) for bandwidth: on desktop the wall
 * is near the viewport right away, and the main thread is often idle while
 * the hero image is still downloading. Returns a cancel function.
 */
function afterLoadWhenIdle(callback: () => void): () => void {
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
 * Progressive enhancement of the trending wall: on desktop pointers that
 * accept motion and support WebGL2, the server-rendered grid (children) is
 * replaced visually by a 3D wall pinned in a sticky stage. The `immersive`
 * CSS variant (globals.css) reserves the scroll track before any JS runs, so
 * enhancing never shifts the layout; everywhere else the grid is a normal
 * grid and three.js is never downloaded.
 */
export function PosterWallEnhancer({
  items,
  children,
}: {
  items: WallItem[];
  children: ReactNode;
}) {
  const router = useRouter();
  const routerRef = useRef(router);
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('off');

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const track = trackRef.current;
    const container = canvasRef.current;
    if (!track || !container || !shouldEnhance(detectEnv())) return;

    let disposed = false;
    let failed = false;
    let wall: PosterWall | null = null;
    let cancelIdle = () => {};

    const updateProgress = () => {
      wall?.setProgress(
        scrollProgress(track.getBoundingClientRect(), window.innerHeight)
      );
    };

    const fail = (error: unknown) => {
      if (disposed || failed) return;
      failed = true;
      console.error(
        '[poster-wall]',
        'The 3D wall failed, showing the grid instead:',
        error
      );
      window.removeEventListener('scroll', updateProgress);
      wall?.dispose();
      wall = null;
      setStatus('failed');
    };

    const start = async () => {
      try {
        const { createPosterWall } = await loadPosterWallScene();
        // The user may have left Home while the chunk was downloading.
        if (disposed) return;
        wall = createPosterWall(container, items, {
          reducedMotion: false,
          onSelect: (item) =>
            routerRef.current.push(`/${item.mediaType}/${item.id}`),
          onError: fail,
        });
        updateProgress();
        window.addEventListener('scroll', updateProgress, { passive: true });
        setStatus('ready');
      } catch (error) {
        fail(error);
      }
    };

    // Download three.js only when the wall is about to be seen, and only once
    // the page has loaded and the main thread has nothing more urgent to do.
    const nearViewport = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        nearViewport.disconnect();
        cancelIdle = afterLoadWhenIdle(() => void start());
      },
      { rootMargin: '50% 0px' }
    );
    nearViewport.observe(track);

    return () => {
      disposed = true;
      nearViewport.disconnect();
      cancelIdle();
      window.removeEventListener('scroll', updateProgress);
      wall?.dispose();
      wall = null;
    };
  }, [items]);

  return (
    <div
      ref={trackRef}
      data-testid="poster-wall-track"
      className="immersive:min-h-[200vh] relative"
    >
      <div
        aria-hidden="true"
        className="immersive:block sticky top-16 hidden h-[calc(100vh-4rem)] overflow-hidden rounded-xl"
      >
        {status !== 'failed' && (
          <div
            ref={canvasRef}
            data-testid="poster-wall-canvas"
            aria-hidden="true"
            className="absolute inset-0"
          />
        )}
      </div>
      <div
        data-testid="poster-wall-grid"
        data-scene={status}
        className={cn(
          'immersive:-mt-[calc(100vh-4rem)] relative transition-opacity',
          // Once the 3D wall shows, the grid is hidden with opacity instead
          // of display/visibility/sr-only: its links stay in the tab order
          // and the accessibility tree (the canvas is aria-hidden), the
          // layout does not change at all (no CLS), and as soon as a link
          // receives keyboard focus the whole grid reappears over the canvas,
          // so focus is never invisible. pointer-events lets the canvas get
          // the mouse while the grid is hidden.
          status === 'ready' &&
            'immersive:pointer-events-none immersive:opacity-0 immersive:focus-within:pointer-events-auto immersive:focus-within:opacity-100'
        )}
      >
        {children}
      </div>
    </div>
  );
}
