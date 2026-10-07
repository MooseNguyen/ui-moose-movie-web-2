'use client';

import { useServerInsertedHTML } from 'next/navigation';
import { useLayoutEffect } from 'react';
import { THEME_SCRIPT } from './theme-script';
import { syncThemeFromStorage } from './use-theme';

/**
 * Anti-flash theme bootstrap.
 *
 * - `useServerInsertedHTML` emits the script as raw HTML in the initial
 *   document, so it runs before first paint. A <script> element rendered via
 *   a Server or Client component makes React 19 warn when it is re-created on
 *   client navigations, and `next/script` runs too late (theme flash).
 * - The root layout (and its <html>) is replaced on a locale switch, which
 *   drops the theme class and never re-runs the inline script, so the layout
 *   effect re-applies the stored theme.
 */
export function ThemeScript() {
  useServerInsertedHTML(() => (
    <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
  ));

  useLayoutEffect(() => {
    syncThemeFromStorage();
  }, []);

  return null;
}
