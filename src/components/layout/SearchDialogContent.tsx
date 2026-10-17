'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { LazyDialogProps } from '@/hooks/use-lazy-dialog';
import { useTranslations } from 'next-intl';
import { SearchCombobox } from './SearchCombobox';

// Only rendered on the client after an interaction (never server-rendered),
// so reading the platform here cannot cause a hydration mismatch.
function shortcutKeys() {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
}

/** Loaded on demand by SearchDialog (keeps Radix Dialog out of the shell). */
export function SearchDialogContent({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: LazyDialogProps) {
  const t = useTranslations('search');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Anchored near the top instead of centred, so it does not jump when
          the on-screen keyboard opens. */}
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={onCloseAutoFocus}
        className="top-[15%] translate-y-0 sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle className="pr-8">{t('dialogTitle')}</DialogTitle>
        </DialogHeader>
        <SearchCombobox onNavigate={() => onOpenChange(false)} />
        {/* Keyboard users only: there is no shortcut on touch screens. */}
        <p className="text-muted-foreground hidden text-xs pointer-fine:block">
          {t.rich('shortcutHint', {
            keys: shortcutKeys(),
            kbd: (chunks) => (
              <kbd className="bg-muted rounded border px-1.5 py-0.5 font-sans">
                {chunks}
              </kbd>
            ),
          })}
        </p>
      </DialogContent>
    </Dialog>
  );
}
