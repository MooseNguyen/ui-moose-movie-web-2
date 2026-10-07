'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_THEME, THEME_STORAGE_KEY, type Theme } from './theme-script';

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Cross-tab sync: another tab changed the stored theme.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) {
      syncThemeFromStorage();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function readStoredTheme(): Theme {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Storage blocked: fall back to the default.
  }
  return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME;
}

/** Re-apply the stored theme to <html> and notify `useTheme` subscribers. */
export function syncThemeFromStorage() {
  applyTheme(readStoredTheme());
  emit();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains('light')
    ? 'light'
    : 'dark';
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the theme still applies for this page view.
    }
    emit();
  }, []);

  const toggle = useCallback(() => {
    setTheme(getSnapshot() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  return { theme, setTheme, toggle };
}
