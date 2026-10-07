'use client';

import { Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import type { MediaType } from '@/lib/tmdb/constants';
import { TrailerDialog } from './TrailerDialog';

type TrailerButtonProps = {
  mediaType: MediaType;
  id: number;
  title: string;
  onOpenChange?: (open: boolean) => void;
  variant?: ComponentProps<typeof Button>['variant'];
};

// TrailerDialog is imported statically: Radix Dialog already ships in every
// bundle (header Sheet), and the dialog only fetches once it is opened.
export function TrailerButton({
  mediaType,
  id,
  title,
  onOpenChange,
  variant = 'default',
}: TrailerButtonProps) {
  const t = useTranslations('detail');
  const [open, setOpen] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <TrailerDialog
      mediaType={mediaType}
      id={id}
      title={title}
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button
          type="button"
          variant={variant}
          aria-label={t('trailerTitle', { title })}
        >
          <Play aria-hidden="true" className="fill-current" />
          {t('trailer')}
        </Button>
      }
    />
  );
}
