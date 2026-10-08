'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { SearchBox } from '@/components/media/SearchBox';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Header search: an icon that opens SearchBox in a modal. Radix already ships
 * in the shell (MobileNav Sheet), so this adds little to the bundle, and it
 * returns focus to the icon on close.
 */
export function SearchDialog() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('common.search')}>
          <Search aria-hidden="true" />
        </Button>
      </DialogTrigger>
      {/* Anchored near the top instead of centred, so it does not jump when
          the on-screen keyboard opens. */}
      <DialogContent
        aria-describedby={undefined}
        className="top-[15%] translate-y-0 sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle className="pr-8">{t('search.dialogTitle')}</DialogTitle>
        </DialogHeader>
        <SearchBox autoFocus onSubmitted={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
