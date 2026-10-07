'use client';

import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { NavLinks } from './NavLinks';

export function MobileNav() {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t('openMenu')}
        >
          <Menu />
        </Button>
      </SheetTrigger>
      {/* The generated close button has a hard-coded English label, so it is
          replaced by a localized one below. */}
      <SheetContent side="left" showCloseButton={false}>
        <SheetHeader>
          <SheetTitle>{t('menuTitle')}</SheetTitle>
          <SheetDescription className="sr-only">
            {t('menuDescription')}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <NavLinks orientation="vertical" onNavigate={() => setOpen(false)} />
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
