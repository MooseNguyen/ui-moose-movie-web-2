'use client';

import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { HeroDetails } from '@/components/media/HeroDetails';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { tmdbImage } from '@/lib/images';
import type { MediaItem } from '@/lib/tmdb/types';
import { cn } from '@/lib/utils';
import { heroScrollProgress, wrapIndex } from './hero-3d-utils';
import type { HeroScene, createHeroScene } from './hero-scene';

/** Time each title stays at the front while the orbit turns by itself. */
export const AUTO_ADVANCE_MS = 6000;

type Hero3DProps = {
  items: MediaItem[];
  createScene: typeof createHeroScene;
  /** The scene could not start or broke later: show the slideshow instead. */
  onFail: () => void;
};

/**
 * The Home hero on desktop pointers that accept motion and support WebGL2
 * (HomeHero decides). Trending posters float on a 3D orbit (hero-scene.ts,
 * aria-hidden); everything a user reads or operates is HTML on top of it: the
 * selected title (HeroDetails, the same block as the slideshow), and real
 * buttons for previous / next / pause / go to title. The selected title's
 * backdrop sits behind the canvas, so the stage looks like the slideshow's
 * first frame before the posters have loaded.
 */
export function Hero3D({ items, createScene, onFail }: Hero3DProps) {
  const t = useTranslations('home');
  const router = useRouter();
  const regionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HeroScene | null>(null);
  const [selected, setSelected] = useState(0);
  const [ready, setReady] = useState(false);
  // Auto-advance holds (WCAG 2.2.2, APG carousel): the user's toggle,
  // keyboard focus inside, the pointer over the text or controls, an open
  // trailer, and the hero being off screen or in a hidden tab.
  const [userPaused, setUserPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const count = items.length;
  const item = items[wrapIndex(selected, count)];

  // What the toggle shows. The other holds are temporary.
  const rotating = !userPaused && !focusPaused;
  const playing =
    rotating && !hoverPaused && !trailerOpen && visible && count > 1;

  const select = (index: number) => setSelected(wrapIndex(index, count));

  // Latest values for the scene's callbacks, which are bound once.
  const latest = useRef({ selected, items, router, onFail });
  useEffect(() => {
    latest.current = { selected, items, router, onFail };
  });

  useEffect(() => {
    if (!playing) return;
    // Restarts after every change of title, manual or automatic, so a
    // title the user just picked gets the full time.
    const id = window.setTimeout(
      () => setSelected((current) => wrapIndex(current + 1, count)),
      AUTO_ADVANCE_MS
    );
    return () => window.clearTimeout(id);
  }, [playing, selected, count]);

  useEffect(() => {
    const region = regionRef.current;
    const container = canvasRef.current;
    if (!region || !container) return;

    let failed = false;
    const fail = (error: unknown) => {
      if (failed) return;
      failed = true;
      console.error(
        '[hero-3d]',
        'The 3D hero failed, showing the slideshow instead:',
        error
      );
      latest.current.onFail();
    };

    let scene: HeroScene;
    try {
      scene = createScene(
        container,
        items.map(({ id, posterPath }) => ({ id, posterPath })),
        {
          initialIndex: latest.current.selected,
          pointerTarget: region,
          onPick: (index) => {
            const current = latest.current;
            if (index !== current.selected) {
              setSelected(index);
              return;
            }
            // A click on the front card opens it, like its Details link.
            const picked = current.items[index];
            current.router.push(`/${picked.mediaType}/${picked.id}`);
          },
          onReady: () => setReady(true),
          onError: fail,
        }
      );
    } catch (error) {
      fail(error);
      return;
    }
    sceneRef.current = scene;

    let frame = 0;
    const updateScroll = () => {
      frame = 0;
      scene.setScrollProgress(
        heroScrollProgress(region.getBoundingClientRect())
      );
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateScroll);
    };
    updateScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Off screen or in a hidden tab, the orbit does not turn by itself.
    let onScreen = true;
    const syncVisible = () => setVisible(onScreen && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      syncVisible();
    });
    observer.observe(region);
    document.addEventListener('visibilitychange', syncVisible);

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncVisible);
      sceneRef.current = null;
      scene.dispose();
    };
  }, [items, createScene]);

  useEffect(() => {
    sceneRef.current?.select(selected);
  }, [selected]);

  // Last input modality, like the browser's :focus-visible heuristic (see
  // HeroSlider): only keyboard focus holds the rotation.
  const lastInputRef = useRef<'keyboard' | 'pointer'>('keyboard');
  useEffect(() => {
    const onPointer = () => (lastInputRef.current = 'pointer');
    const onKey = () => (lastInputRef.current = 'keyboard');
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    if (lastInputRef.current === 'keyboard') setFocusPaused(true);
  }
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocusPaused(false);
    }
  }
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Same keys as the slideshow (shadcn Carousel).
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      select(selected - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      select(selected + 1);
    }
  }
  function toggleRotation() {
    if (rotating) {
      setUserPaused(true);
    } else {
      setUserPaused(false);
      setFocusPaused(false);
    }
  }
  const hoverHandlers = {
    onPointerEnter: () => setHoverPaused(true),
    onPointerLeave: () => setHoverPaused(false),
  };

  if (!item) return null;

  return (
    <div
      ref={regionRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={t('heroLabel')}
      data-testid="hero-3d"
      data-ready={ready || undefined}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDownCapture={handleKeyDown}
      // Same box as a HeroSlider slide, so swapping the two never shifts
      // the page.
      className="relative h-[60vh] max-h-[52rem] min-h-[30rem] w-full overflow-hidden md:h-[70vh] md:min-h-[34rem]"
    >
      {/* First in tab order (APG carousel), visually at the bottom. */}
      <div
        {...hoverHandlers}
        className="absolute inset-x-0 bottom-4 z-20 mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 md:bottom-6 md:justify-end"
      >
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t('pauseSlideshow')}
          aria-pressed={!rotating}
          onClick={toggleRotation}
          className="rounded-full"
        >
          {rotating ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t('previousSlide')}
          onClick={() => select(selected - 1)}
          className="rounded-full"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <div role="group" aria-label={t('slides')} className="flex">
          {items.map((entry, i) => (
            <button
              key={`${entry.mediaType}-${entry.id}`}
              type="button"
              aria-label={t('goToSlide', { index: i + 1 })}
              aria-current={i === selected ? 'true' : undefined}
              onClick={() => select(i)}
              className="focus-visible:ring-ring flex h-6 min-w-6 items-center justify-center rounded-full px-1 outline-none focus-visible:ring-2"
            >
              <span
                className={cn(
                  'block h-2 rounded-full transition-all',
                  i === selected ? 'bg-foreground w-6' : 'bg-foreground/40 w-2'
                )}
              />
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t('nextSlide')}
          onClick={() => select(selected + 1)}
          className="rounded-full"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      {/* The selected title's backdrop. Title 0's is the slideshow's LCP
          image (same URL), so it comes from the cache. bottom-px: see
          HeroSlider. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 bottom-px">
        <Image
          key={`${item.mediaType}-${item.id}`}
          src={tmdbImage(item.backdropPath, 'w1280', 'backdrop')}
          alt=""
          fill
          sizes="100vw"
          unoptimized={!item.backdropPath}
          className="animate-in fade-in object-cover duration-700"
        />
      </div>
      {/* Stronger than the slideshow's gradients: the posters, not the
          backdrop, are the subject here. Text stays at AA contrast. */}
      <div
        aria-hidden="true"
        className="from-background via-background/80 to-background/40 absolute inset-0 bg-linear-to-t"
      />
      <div
        aria-hidden="true"
        className="from-background/95 via-background/60 absolute inset-0 bg-linear-to-r to-transparent"
      />

      <div
        ref={canvasRef}
        data-testid="hero-3d-canvas"
        aria-hidden="true"
        className={cn(
          // Fades in once the posters are textured; the mask lets the
          // posters sink into the rows below instead of ending in a line.
          'absolute inset-0 [mask-image:linear-gradient(to_bottom,black_80%,transparent)] opacity-0 transition-opacity duration-1000',
          ready && 'opacity-100'
        )}
      />

      <div className="pointer-events-none relative z-10 mx-auto flex h-full max-w-7xl items-end px-4 pb-20 md:pb-24">
        <div
          {...hoverHandlers}
          role="group"
          aria-roledescription="slide"
          aria-label={t('slideLabel', {
            index: wrapIndex(selected, count) + 1,
            total: count,
          })}
          // Announce title changes only when they are not automatic (APG).
          aria-live={playing ? 'off' : 'polite'}
          className="pointer-events-auto w-full max-w-xl lg:max-w-[42%]"
        >
          <HeroDetails
            key={`${item.mediaType}-${item.id}`}
            item={item}
            onTrailerOpenChange={setTrailerOpen}
            className="animate-in fade-in slide-in-from-bottom-2 duration-500"
          />
        </div>
      </div>
    </div>
  );
}
