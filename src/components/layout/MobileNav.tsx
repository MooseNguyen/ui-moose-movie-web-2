'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useLazyDialog } from '@/hooks/use-lazy-dialog';

const loadMobileNavSheet = () =>
  import('./MobileNavSheet').then((m) => m.MobileNavSheet);

/** Mobile menu button; the Sheet itself is loaded on first hover/focus/open. */
export function MobileNav() {
  const t = useTranslations('common');
  const { Dialog, triggerProps, dialogProps } =
    useLazyDialog(loadMobileNavSheet);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={t('openMenu')}
        {...triggerProps}
      >
        <Menu />
      </Button>
      {Dialog && <Dialog {...dialogProps} />}
    </>
  );
}
