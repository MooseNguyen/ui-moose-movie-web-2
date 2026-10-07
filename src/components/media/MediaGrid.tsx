import { Children, type ReactNode } from 'react';

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
