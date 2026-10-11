'use client';

import { SearchBox } from '@/components/media/SearchBox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { LazyDialogProps } from '@/hooks/use-lazy-dialog';
import { useTranslations } from 'next-intl';

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
        <SearchBox autoFocus onSubmitted={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
