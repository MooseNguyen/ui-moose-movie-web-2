'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useLazyDialog } from '@/hooks/use-lazy-dialog';

const loadSearchDialog = () =>
  import('./SearchDialogContent').then((m) => m.SearchDialogContent);

/**
 * Header search: an icon that opens SearchBox in a modal. The modal (Radix
 * Dialog + SearchBox) is loaded on first hover/focus/open, not with the page.
 */
export function SearchDialog() {
  const t = useTranslations('common');
  const { Dialog, triggerProps, dialogProps } = useLazyDialog(loadSearchDialog);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('search')}
        {...triggerProps}
      >
        <Search aria-hidden="true" />
      </Button>
      {Dialog && <Dialog {...dialogProps} />}
    </>
  );
}
