'use client';

import { useEffect, useRef, useState } from 'react';
import { useCarousel } from '@/components/ui/carousel';
import { useRouter } from '@/i18n/navigation';
import {
  afterLoadWhenIdle,
  hasWebGL2,
  prefersEnhancement,
  REDUCED_MOTION,
} from '@/lib/enhancement';
import { cn } from '@/lib/utils';
import type { HeroScene } from './hero-scene';
import { heroScrollProgress, type HeroSceneItem } from './hero-scene-layout';
import { loadHeroScene } from './load-hero-scene';

/**
 * - loading: the scene is being downloaded/created (stage still invisible).
 * - ready: the 3D posters are showing.
 * - unsupported: a desktop pointer without WebGL2.
 * - failed: the scene could not start or broke later.
 */
type Status = 'loading' | 'ready' | 'unsupported' | 'failed';

/** The 3D ring only fits next to the slide text from the lg breakpoint on. */
const WIDE_VIEWPORT = '(min-width: 1024px)';

/**
 * Progressive enhancement of the Home hero, rendered inside HeroSlider's
 * carousel. The slider (server-rendered HTML: title, overview, trailer,
 * details link, controls) stays the content and the LCP element on every
 * device. On wide desktop pointers that accept motion and support WebGL2, a
 * transparent canvas fades in over the right side of the backdrop with the
 * trending posters on a 3D ring that follows the slider's selection. The
 * stage is absolutely positioned, so it never shifts the layout. Everywhere
 * else nothing is rendered and three.js is never downloaded.
 */
export function HeroStage({ items }: { items: HeroSceneItem[] }) {
  const { api } = useCarousel();
  const router = useRouter();
  const apiRef = useRef(api);
  const routerRef = useRef(router);
  const sceneRef = useRef<HeroScene | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // Mounting the stage is decided once the page has loaded and is idle.
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    apiRef.current = api;
    routerRef.current = router;
  }, [api, router]);

  // The cheap media queries decide at once; the rest waits for load + idle.
  useEffect(() => {
    if (!prefersEnhancement() || !window.matchMedia(WIDE_VIEWPORT).matches) {
      return;
    }
    return afterLoadWhenIdle(() => setMounted(true));
  }, []);

  // Turning on reduced motion while the scene runs removes it.
  useEffect(() => {
    if (!mounted) return;
    const query = window.matchMedia(REDUCED_MOTION);
    const onChange = () => {
      if (query.matches) setMounted(false);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [mounted]);

  useEffect(() => {
    const stage = stageRef.current;
    const container = canvasRef.current;
    if (!mounted || !stage || !container) return;

    let disposed = false;
    let failed = false;
    let scene: HeroScene | null = null;

    const updateScroll = () =>
      scene?.setScrollProgress(
        heroScrollProgress(stage.getBoundingClientRect())
      );

    const teardown = () => {
      window.removeEventListener('scroll', updateScroll);
      scene?.dispose();
      scene = null;
      sceneRef.current = null;
    };

    const fail = (error: unknown) => {
      if (disposed || failed) return;
      failed = true;
      console.error(
        '[home]',
        'The 3D hero failed, showing the slider only:',
        error
      );
      teardown();
      setStatus('failed');
    };

    // A click on the front poster opens it; any other poster is selected.
    const onPick = (index: number) => {
      const carousel = apiRef.current;
      if (!carousel) return;
      if (index === carousel.selectedScrollSnap()) {
        const item = items[index];
        routerRef.current.push(`/${item.mediaType}/${item.id}`);
      } else {
        carousel.scrollTo(index);
      }
    };

    const start = async () => {
      if (!hasWebGL2()) {
        setStatus('unsupported');
        return;
      }
      try {
        const { createHeroScene } = await loadHeroScene();
        // The user may have left Home while the chunk was downloading.
        if (disposed) return;
        scene = createHeroScene(container, items, {
          initialIndex: apiRef.current?.selectedScrollSnap() ?? 0,
          onPick,
          onError: fail,
        });
        sceneRef.current = scene;
        updateScroll();
        window.addEventListener('scroll', updateScroll, { passive: true });
        setStatus('ready');
      } catch (error) {
        fail(error);
      }
    };
    void start();

    return () => {
      disposed = true;
      teardown();
    };
  }, [mounted, items]);

  // The slider's selection (buttons, keyboard, autoplay) drives the ring.
  useEffect(() => {
    if (!api) return;
    const onSelect = () => sceneRef.current?.select(api.selectedScrollSnap());
    onSelect();
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api]);

  if (!mounted || status === 'unsupported' || status === 'failed') {
    return null;
  }

  const ready = status === 'ready';
  return (
    <div
      ref={stageRef}
      aria-hidden="true"
      data-testid="hero-stage"
      data-hero-stage={status}
      className={cn(
        // Right of the slide text, under the controls (z-10). Fades in only
        // once the scene exists, so nothing half-built is ever visible.
        'absolute inset-y-0 right-0 left-[46%] z-[5] hidden opacity-0 transition-opacity duration-1000 lg:block',
        ready ? 'opacity-100' : 'pointer-events-none'
      )}
    >
      {/* Dims the backdrop behind the posters so they read as the subject. */}
      <div className="from-background/85 via-background/45 absolute inset-0 bg-linear-to-l to-transparent" />
      <div
        ref={canvasRef}
        data-testid="hero-stage-canvas"
        // Soft edges: fades towards the slide text, the header and the
        // controls instead of a hard canvas border.
        className="absolute inset-0 mask-t-from-85% mask-b-from-80% mask-l-from-60%"
      />
    </div>
  );
}
