'use client';

import { useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/media/ErrorBoundary';
import { HeroSlider } from '@/components/media/HeroSlider';
import {
  afterLoadWhenIdle,
  hasWebGL2,
  prefersMotionOnFinePointer,
  REDUCED_MOTION_QUERY,
} from '@/lib/enhance-3d';
import type { MediaItem } from '@/lib/tmdb/types';
import { loadHero3D, type LoadedHero3D } from './load-hero-3d';

/**
 * The Home hero. The server-rendered slideshow (HeroSlider) is the content
 * on every device and the LCP element. On desktop pointers that accept
 * motion and support WebGL2, it is swapped for the 3D hero once the page has
 * loaded and the main thread is idle. Both have the same box, so the swap
 * never shifts the layout. Everywhere else three.js is never downloaded.
 */
export function HomeHero({ items }: { items: MediaItem[] }) {
  const [hero3d, setHero3d] = useState<LoadedHero3D | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // The cheap media queries decide at once; the WebGL probe waits.
    if (items.length === 0 || !prefersMotionOnFinePointer()) return;

    let cancelled = false;
    const cancelIdle = afterLoadWhenIdle(() => {
      if (!hasWebGL2()) return;
      loadHero3D().then(
        (loaded) => {
          if (!cancelled) setHero3d(loaded);
        },
        (error: unknown) => {
          console.error(
            '[hero-3d]',
            'Could not load the 3D hero, keeping the slideshow:',
            error
          );
        }
      );
    });

    // Turning on reduced motion mid-visit drops the 3D hero for good.
    const motion = window.matchMedia(REDUCED_MOTION_QUERY);
    const onMotionChange = () => {
      if (motion.matches) {
        cancelled = true;
        cancelIdle();
        setFailed(true);
      }
    };
    motion.addEventListener('change', onMotionChange);

    return () => {
      cancelled = true;
      cancelIdle();
      motion.removeEventListener('change', onMotionChange);
    };
  }, [items]);

  const slideshow = <HeroSlider items={items} />;
  if (!hero3d || failed) return slideshow;

  const { Hero3D, createHeroScene } = hero3d;
  return (
    <ErrorBoundary fallback={slideshow}>
      <Hero3D
        items={items}
        createScene={createHeroScene}
        onFail={() => setFailed(true)}
      />
    </ErrorBoundary>
  );
}
