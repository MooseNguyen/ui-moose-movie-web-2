'use client';

import { useCallback, useRef, useState, type ComponentType } from 'react';

/** Props every lazily loaded dialog receives from useLazyDialog. */
export type LazyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass to Radix `DialogContent`/`SheetContent`. */
  onCloseAutoFocus: (event: Event) => void;
};

type Options = {
  onOpenChange?: (open: boolean) => void;
};

/**
 * Keeps a Radix dialog out of the initial bundle: the trigger is a plain
 * button and the dialog component is loaded with `import()` the first time it
 * is needed. Hovering or focusing the trigger starts the download early, so
 * the first open rarely waits for the network.
 *
 * Without a Radix `DialogTrigger`, Radix cannot return focus on close, so the
 * returned `onCloseAutoFocus` does it.
 *
 * `load` must be stable (declare it at module level).
 */
export function useLazyDialog<P extends LazyDialogProps>(
  load: () => Promise<ComponentType<P>>,
  { onOpenChange }: Options = {}
) {
  // Functional updates below store the component itself, not call it.
  const [Dialog, setDialog] = useState<ComponentType<P> | null>(null);
  const [open, setOpenState] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<Promise<ComponentType<P>> | null>(null);

  const ensureLoaded = useCallback(() => {
    pending.current ??= load().then(
      (component) => {
        setDialog(() => component);
        return component;
      },
      (error: unknown) => {
        // Allow the next attempt to retry (e.g. after a network blip).
        pending.current = null;
        throw error;
      }
    );
    return pending.current;
  }, [load]);

  const warmUp = useCallback(() => {
    ensureLoaded().catch(() => {});
  }, [ensureLoaded]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
      if (!next) return;
      // If the chunk cannot be loaded, fall back to closed so the trigger
      // state stays truthful and the next click retries.
      ensureLoaded().catch(() => {
        setOpenState(false);
        onOpenChange?.(false);
      });
    },
    [ensureLoaded, onOpenChange]
  );

  const onCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    triggerRef.current?.focus();
  }, []);

  return {
    Dialog,
    open,
    setOpen,
    triggerProps: {
      ref: triggerRef,
      type: 'button' as const,
      'aria-haspopup': 'dialog' as const,
      'aria-expanded': open,
      onClick: () => setOpen(true),
      onPointerEnter: warmUp,
      onFocus: warmUp,
    },
    dialogProps: { open, onOpenChange: setOpen, onCloseAutoFocus },
  };
}
