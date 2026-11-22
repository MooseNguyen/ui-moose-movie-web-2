import { Children, type ReactNode } from 'react';

/**
 * Rendered poster width for MediaGrid's columns inside a `max-w-7xl px-4`
 * page container. With C = min(100vw, 1280px) - 32px (container padding) and
 * n columns, a cell is (C - 16 * (n - 1)) / n px (gap-4). Constants are
 * rounded up so the poster is never under-sized. Change together with the
 * grid-cols classes below.
 */
export const GRID_POSTER_SIZES =
  '(min-width: 1280px) 195px, (min-width: 1024px) calc(20vw - 19px), (min-width: 768px) calc(25vw - 20px), (min-width: 640px) calc(33.34vw - 21px), calc(50vw - 24px)';

/**
 * Responsive poster grid. Pass the cards directly as children: MediaGrid
 * wraps each one in an <li>, so callers must not add their own <li>.
 */
export function MediaGrid({ children }: { children: ReactNode }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Children.map(children, (child) => (
        <li>{child}</li>
      ))}
    </ul>
  );
}
