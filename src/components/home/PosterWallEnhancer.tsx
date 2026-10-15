'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { PosterWall } from './poster-wall-scene';
import { loadPosterWallScene } from './load-poster-wall-scene';
import {
  scrollProgress,
  shouldEnhance,
  type WallItem,
} from './poster-wall-utils';

/**
 * - off: not enhanced (touch, reduced motion) or not decided yet.
 * - ready: the 3D wall is showing.
 * - unsupported: a desktop pointer without WebGL2.
 * - failed: the scene could not start or broke later.
 */
type Status = 'off' | 'ready' | 'unsupported' | 'failed';

const IDLE_TIMEOUT_MS = 2000;
const IDLE_FALLBACK_MS = 200;
const FINE_POINTER = '(pointer: fine)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

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

/**
 * Progressive enhancement of the trending wall. The server-rendered carousel
 * (children) is the content on every device. On desktop pointers that accept
 * motion and support WebGL2, a 3D wall pinned in a sticky stage replaces it
 * visually. The `immersive` CSS variant (globals.css) reserves the scroll
 * track before any JS runs, so enhancing never shifts the layout. Everywhere
 * else the carousel is a normal row and three.js is never downloaded.
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
    // The cheap media queries decide at once; the WebGL probe waits (below).
    if (
      !track ||
      !container ||
      !window.matchMedia(FINE_POINTER).matches ||
      window.matchMedia(REDUCED_MOTION).matches
    ) {
      return;
    }

    let disposed = false;
    let failed = false;
    let wall: PosterWall | null = null;
    let cancelIdle = () => {};

    const updateProgress = () => {
      wall?.setProgress(
        scrollProgress(track.getBoundingClientRect(), window.innerHeight)
      );
    };
    const removeListeners = () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };

    const fail = (error: unknown) => {
      if (disposed || failed) return;
      failed = true;
      console.error(
        '[poster-wall]',
        'The 3D wall failed, showing the carousel instead:',
        error
      );
      removeListeners();
      wall?.dispose();
      wall = null;
      setStatus('failed');
    };

    const start = async () => {
      // Probed only now (near the viewport, after load, when idle), so a
      // Home visit that never reaches the wall never creates a context.
      const env = {
        finePointer: window.matchMedia(FINE_POINTER).matches,
        reducedMotion: window.matchMedia(REDUCED_MOTION).matches,
        webgl: hasWebGL2(),
      };
      if (!shouldEnhance(env)) {
        if (!env.webgl) setStatus('unsupported');
        return;
      }
      try {
        const { createPosterWall } = await loadPosterWallScene();
        // The user may have left Home while the chunk was downloading.
        if (disposed) return;
        wall = createPosterWall(container, items, {
          // Always false here (the gate above excludes reduced motion); the
          // scene still supports it for other callers.
          reducedMotion: env.reducedMotion,
          onSelect: (item) =>
            routerRef.current.push(`/${item.mediaType}/${item.id}`),
          onError: fail,
        });
        updateProgress();
        window.addEventListener('scroll', updateProgress, { passive: true });
        // The track and viewport heights both feed the progress.
        window.addEventListener('resize', updateProgress);
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
      removeListeners();
      wall?.dispose();
      wall = null;
    };
  }, [items]);

  // Without a scene (no WebGL2, or it failed) the empty sticky stage would
  // leave a viewport-high gap, so the track collapses to a normal row. That
  // shift happens at most once, and only on these rare paths.
  const collapsed = status === 'unsupported' || status === 'failed';

  return (
    <div
      ref={trackRef}
      data-testid="poster-wall-track"
      data-collapsed={collapsed || undefined}
      className={cn('relative', !collapsed && 'immersive:min-h-[200vh]')}
    >
      {!collapsed && (
        <div
          aria-hidden="true"
          className="immersive:block sticky top-16 hidden h-[calc(100vh-4rem)] overflow-hidden rounded-xl"
        >
          <div
            ref={canvasRef}
            data-testid="poster-wall-canvas"
            aria-hidden="true"
            className="absolute inset-0"
          />
        </div>
      )}
      <div
        data-testid="poster-wall-fallback"
        data-scene={status}
        className={cn(
          'relative transition-opacity',
          // An opaque surface, so the carousel stays readable whenever it is
          // shown over the stage (before the scene is ready, or revealed by
          // keyboard focus over the posters).
          !collapsed &&
            'immersive:-mt-[calc(100vh-4rem)] immersive:bg-background immersive:rounded-xl immersive:p-4',
          // Once the 3D wall shows, the carousel is hidden with opacity
          // instead of display/visibility/sr-only: its links stay in the tab
          // order and the accessibility tree (the canvas is aria-hidden), the
          // layout does not change at all (no CLS), and as soon as a link
          // receives keyboard focus the carousel reappears over the canvas,
          // so focus is never invisible. pointer-events lets the canvas get
          // the mouse while the carousel is hidden.
          status === 'ready' &&
            'immersive:pointer-events-none immersive:opacity-0 immersive:focus-within:pointer-events-auto immersive:focus-within:opacity-100'
        )}
      >
        {children}
      </div>
    </div>
  );
}
