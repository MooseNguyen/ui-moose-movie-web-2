'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { approach, depthFromPointer, scrollDepth } from './detail-depth';

// Same conditions as the CSS in globals.css (and the card tilt): pointer
// devices that can hover, and only when motion is welcome.
const ENABLED_QUERY = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Root of the Detail hero that gives its layers depth: the backdrop, the
 * poster and the text (`data-depth-layer`) move by different amounts with
 * the scroll position and, smoothed, with the pointer. This controller only
 * writes three CSS variables per frame (`--depth-x`, `--depth-y`,
 * `--depth-scroll`); the transforms live in globals.css. Transforms never
 * shift layout (no CLS), and at rest every layer sits exactly where the
 * server rendered it. Off on touch and under reduced motion: no listeners,
 * flat layers.
 */
export function DetailHeroDepth({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (
      !root ||
      !window.matchMedia(ENABLED_QUERY).matches ||
      window.matchMedia(REDUCED_MOTION_QUERY).matches
    ) {
      return;
    }

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let scroll = -1;
    let frame = 0;

    const render = () => {
      frame = 0;
      current.x = approach(current.x, target.x);
      current.y = approach(current.y, target.y);
      root.style.setProperty('--depth-x', current.x.toFixed(4));
      root.style.setProperty('--depth-y', current.y.toFixed(4));
      const nextScroll = scrollDepth(root.getBoundingClientRect());
      if (nextScroll !== scroll) {
        scroll = nextScroll;
        root.style.setProperty('--depth-scroll', String(Math.round(scroll)));
      }
      // Keep easing until the layers have caught up with the pointer.
      if (current.x !== target.x || current.y !== target.y) schedule();
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const point = depthFromPointer(
        root.getBoundingClientRect(),
        event.clientX,
        event.clientY
      );
      target.x = point.x;
      target.y = point.y;
      schedule();
    };
    const onPointerLeave = () => {
      target.x = 0;
      target.y = 0;
      schedule();
    };

    root.setAttribute('data-depth-active', '');
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('scroll', schedule, { passive: true });
    schedule();

    return () => {
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('scroll', schedule);
      if (frame) window.cancelAnimationFrame(frame);
      root.removeAttribute('data-depth-active');
      for (const name of ['--depth-x', '--depth-y', '--depth-scroll']) {
        root.style.removeProperty(name);
      }
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
