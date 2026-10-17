'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLazyDialog } from '@/hooks/use-lazy-dialog';

const loadSearchDialog = () =>
  import('./SearchDialogContent').then((m) => m.SearchDialogContent);

/** ⌘K on macOS, Ctrl+K elsewhere; plain or with other modifiers is ignored. */
function isSearchShortcut(event: KeyboardEvent) {
  return (
    event.key.toLowerCase() === 'k' &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    !event.isComposing
  );
}

/**
 * Header search: an icon (or ⌘K / Ctrl+K anywhere) that opens the search
 * combobox in a modal. The modal (Radix Dialog + combobox) is loaded on first
 * hover/focus/open, not with the page.
 */
export function SearchDialog() {
  const t = useTranslations('common');
  const { Dialog, open, setOpen, triggerProps, dialogProps } =
    useLazyDialog(loadSearchDialog);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event)) return;
      // Overrides the browser's own Ctrl+K (address bar search), as GitHub
      // and Vercel do, but only while the page has focus.
      event.preventDefault();
      setOpen(!open);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('search')}
        aria-keyshortcuts="Control+K Meta+K"
        {...triggerProps}
      >
        <Search aria-hidden="true" />
      </Button>
      {Dialog && <Dialog {...dialogProps} />}
    </>
  );
}
