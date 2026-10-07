'use client';

import { hasLocale, useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getTrailer } from '@/lib/actions/media';
import { routing } from '@/i18n/routing';
import type { MediaType } from '@/lib/tmdb/constants';
import type { Video } from '@/lib/tmdb/types';
import { YouTubeFrame } from './YouTubeFrame';

type TrailerDialogProps = {
  mediaType: MediaType;
  id: number;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Rendered as the Radix trigger so focus returns to it when the dialog closes.
  trigger: ReactNode;
};

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; video: Video | null };

export function TrailerDialog({
  mediaType,
  id,
  title,
  open,
  onOpenChange,
  trigger,
}: TrailerDialogProps) {
  const t = useTranslations();
  const rawLocale = useLocale();
  const locale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;

  const [state, setState] = useState<State>({ status: 'idle' });
  // Only the latest request may write state; unmount invalidates all of them.
  const requestId = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    return () => {
      requestId.current += 1;
    };
  }, []);

  const load = useCallback(async () => {
    started.current = true;
    const current = ++requestId.current;
    setState({ status: 'loading' });
    const result = await getTrailer({ mediaType, id, locale });
    if (current !== requestId.current) return;
    setState(
      result.ok ? { status: 'ready', video: result.data } : { status: 'error' }
    );
  }, [mediaType, id, locale]);

  // Fetch the first time the dialog opens; the settled result is kept so
  // reopening does not refetch. Errors are retried explicitly via the button.
  useEffect(() => {
    if (open && !started.current) void load();
  }, [open, load]);

  const dialogTitle = t('detail.trailerTitle', { title });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent aria-describedby={undefined} className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
          {state.status === 'ready' && state.video ? (
            <YouTubeFrame
              videoKey={state.video.key}
              title={state.video.name || dialogTitle}
            />
          ) : state.status === 'error' ? (
            <div className="bg-muted flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
              <p>{t('errors.generic')}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void load()}
              >
                {t('errors.retry')}
              </Button>
            </div>
          ) : state.status === 'ready' ? (
            <div className="bg-muted flex size-full items-center justify-center p-4 text-center">
              <p>{t('detail.noTrailer')}</p>
            </div>
          ) : (
            <Skeleton
              role="status"
              aria-label={t('common.loading')}
              className="size-full rounded-none"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
