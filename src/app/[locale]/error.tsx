'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors');

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 pt-24 text-center">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
      <Button onClick={() => reset()}>{t('retry')}</Button>
    </main>
  );
}
