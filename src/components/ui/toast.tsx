'use client';

import { lazy, Suspense, useSyncExternalStore } from 'react';
import type { ExternalToast } from 'sonner';

/**
 * Keeps sonner (~10 KB gzip) out of the shared bundle: toasts are rare (the
 * Favorites undo, a storage warning), so the library and the Toaster load the
 * first time a toast is requested (issue #113).
 *
 * Sonner replays the active toasts to a Toaster that subscribes late, so a
 * toast requested before the lazy Toaster has mounted is still shown.
 */

const loadToaster = () => import('./sonner');

const Toaster = lazy(() =>
  loadToaster().then((module) => ({ default: module.Toaster }))
);

let requested = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => requested;
const getServerSnapshot = () => false;

function requestToaster() {
  if (requested) return;
  requested = true;
  listeners.forEach((listener) => listener());
}

// A failed chunk load (e.g. offline) leaves nothing that could display the
// message; the action that triggered it has already happened, so the toast
// is dropped instead of surfacing an unhandled rejection.
const ignoreLoadError = () => {};

/** Shows a toast, loading the toast library on first use. */
export function showToast(message: string, options?: ExternalToast) {
  requestToaster();
  import('sonner')
    .then(({ toast }) => {
      toast(message, options);
    })
    .catch(ignoreLoadError);
}

/**
 * Starts downloading the toast code early, for views where a toast is likely
 * (so e.g. an undo toast is not delayed by the network).
 */
export function preloadToasts() {
  loadToaster().catch(ignoreLoadError);
}

/** Mounts the Toaster only once a toast has been requested. */
export function LazyToaster() {
  const shouldMount = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  if (!shouldMount) return null;
  return (
    <Suspense fallback={null}>
      <Toaster />
    </Suspense>
  );
}
