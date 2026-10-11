'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { LazyDialogProps } from '@/hooks/use-lazy-dialog';
import { NavLinks } from './NavLinks';

/** Loaded on demand by MobileNav (keeps Radix Dialog out of the shell). */
export function MobileNavSheet({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: LazyDialogProps) {
  const t = useTranslations('common');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The generated close button has a hard-coded English label, so it is
          replaced by a localized one below. */}
      <SheetContent
        side="left"
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <SheetHeader>
          <SheetTitle>{t('menuTitle')}</SheetTitle>
          <SheetDescription className="sr-only">
            {t('menuDescription')}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <NavLinks
            orientation="vertical"
            onNavigate={() => onOpenChange(false)}
          />
        </div>
        <SheetClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-4 right-4"
            aria-label={t('closeMenu')}
          >
            <X />
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
