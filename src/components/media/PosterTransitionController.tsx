'use client';

import { useEffect } from 'react';

const NAME = 'view-transition-name';

/**
 * Names the poster of the clicked card for the card → Detail morph (see
 * poster-transition.ts).
 *
 * Cards only carry the name in `data-poster-transition`: the same title often
 * appears in several rows, and two elements with one `view-transition-name`
 * make the browser skip the whole transition. So the name is applied to the
 * clicked poster alone, by one delegated listener (cards stay Server
 * Components, like TiltController).
 */
export function PosterTransitionController() {
  useEffect(() => {
    let named: HTMLElement | null = null;

    const onClick = (event: MouseEvent) => {
      // Modified and non-primary clicks open a new tab or window: no
      // in-place navigation to animate.
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      const poster = target
        ?.closest('a')
        ?.querySelector<HTMLElement>('[data-poster-transition]');
      const name = poster?.dataset.posterTransition;
      if (!poster || !name) return;

      if (named && named !== poster) named.style.removeProperty(NAME);
      poster.style.setProperty(NAME, name);
      named = poster;
    };

    // Capture phase: the name must be set before Link starts the navigation.
    document.addEventListener('click', onClick, { capture: true });
    return () => {
      document.removeEventListener('click', onClick, { capture: true });
      named?.style.removeProperty(NAME);
    };
  }, []);

  return null;
}
