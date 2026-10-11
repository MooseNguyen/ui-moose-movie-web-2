'use client';

import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { useLazyDialog } from '@/hooks/use-lazy-dialog';
import type { MediaType } from '@/lib/tmdb/constants';

type TrailerButtonProps = {
  mediaType: MediaType;
  id: number;
  title: string;
  onOpenChange?: (open: boolean) => void;
  variant?: ComponentProps<typeof Button>['variant'];
};

const loadTrailerDialog = () =>
  import('./TrailerDialog').then((m) => m.TrailerDialog);

// The dialog (Radix Dialog + fetching logic) is loaded on first hover/focus/
// open; it fetches the trailer only once it is opened.
export function TrailerButton({
  mediaType,
  id,
  title,
  onOpenChange,
  variant = 'default',
}: TrailerButtonProps) {
  const t = useTranslations('detail');
  const { Dialog, triggerProps, dialogProps } = useLazyDialog(
    loadTrailerDialog,
    { onOpenChange }
  );

  return (
    <>
      <Button
        variant={variant}
        aria-label={t('trailerTitle', { title })}
        {...triggerProps}
      >
        <Play aria-hidden="true" className="fill-current" />
        {t('trailer')}
      </Button>
      {Dialog && (
        <Dialog {...dialogProps} mediaType={mediaType} id={id} title={title} />
      )}
    </>
  );
}
