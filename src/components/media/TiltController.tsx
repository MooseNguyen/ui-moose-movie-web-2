'use client';

import { useEffect } from 'react';
import { tiltFromPointer } from './tilt';

// Same conditions as the CSS in globals.css: pointer devices that can hover,
// and only when the user has not asked for less motion.
const ENABLED_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const VARS = ['--tilt-rx', '--tilt-ry', '--tilt-gx', '--tilt-gy'] as const;

function reset(card: HTMLElement) {
  card.removeAttribute('data-tilting');
  for (const name of VARS) card.style.removeProperty(name);
}

/**
 * Pointer tilt for every `[data-tilt]` card, mounted once for the whole app.
 *
 * One delegated `pointermove` listener instead of a client component per
 * card: cards stay Server Components, and a page with 100+ cards hydrates
 * nothing extra. The work is limited to one rect read and four CSS variable
 * writes per animation frame; the transform itself lives in CSS.
 */
export function TiltController() {
  useEffect(() => {
    if (
      !window.matchMedia(ENABLED_QUERY).matches ||
      window.matchMedia(REDUCED_MOTION_QUERY).matches
    ) {
      return;
    }

    let active: HTMLElement | null = null;
    let frame = 0;
    let x = 0;
    let y = 0;

    const apply = () => {
      frame = 0;
      if (!active) return;
      const tilt = tiltFromPointer(active.getBoundingClientRect(), x, y);
      active.style.setProperty('--tilt-rx', `${tilt.rx}deg`);
      active.style.setProperty('--tilt-ry', `${tilt.ry}deg`);
      active.style.setProperty('--tilt-gx', `${tilt.gx}%`);
      active.style.setProperty('--tilt-gy', `${tilt.gy}%`);
      active.setAttribute('data-tilting', '');
    };

    const onMove = (event: PointerEvent | MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest<HTMLElement>('[data-tilt]') ?? null;
      if (card !== active) {
        if (active) reset(active);
        active = card;
      }
      if (!active) return;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    // The pointer leaving the window does not fire a move on another element.
    const onLeaveWindow = () => {
      if (active) reset(active);
      active = null;
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeaveWindow);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener(
        'pointerleave',
        onLeaveWindow
      );
      if (frame) window.cancelAnimationFrame(frame);
      if (active) reset(active);
    };
  }, []);

  return null;
}
