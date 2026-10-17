import type { MediaType } from '@/lib/tmdb/constants';

/**
 * Transition type set by card links (`<Link transitionTypes>`). The
 * `<ViewTransition>` in the locale layout only animates navigations of this
 * type, so filter changes, search and header links stay instant.
 */
export const CARD_NAV_TRANSITION = 'card-nav';

/**
 * `view-transition-name` shared by a card poster and the Detail hero poster.
 * The browser morphs the two elements because they carry the same name.
 */
export function posterTransitionName(mediaType: MediaType, id: number) {
  return `poster-${mediaType}-${id}`;
}
