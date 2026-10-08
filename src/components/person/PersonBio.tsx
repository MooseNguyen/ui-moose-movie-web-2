'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Roughly six lines of the bio column; shorter texts never get a toggle.
const CLAMP_THRESHOLD = 600;

type PersonBioProps = {
  text: string;
  /** The text is the English biography shown on a Vietnamese page. */
  isFallback: boolean;
};

export function PersonBio({ text, isFallback }: PersonBioProps) {
  const t = useTranslations('person');
  const tDetail = useTranslations('detail');
  const [expanded, setExpanded] = useState(false);
  const id = useId();

  const bio = text.trim();
  if (!bio) {
    return <p className="text-muted-foreground">{t('noBiography')}</p>;
  }

  const clampable = bio.length > CLAMP_THRESHOLD;

  return (
    <div className="max-w-3xl">
      <p
        id={id}
        lang={isFallback ? 'en' : undefined}
        className={cn(
          'leading-relaxed whitespace-pre-line',
          clampable && !expanded && 'line-clamp-6'
        )}
      >
        {bio}
      </p>
      {isFallback && (
        <p className="text-muted-foreground mt-1 text-sm">
          {tDetail('englishFallback')}
        </p>
      )}
      {clampable && (
        <Button
          type="button"
          variant="link"
          className="mt-1 h-auto px-0"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t('showLess') : t('showMore')}
        </Button>
      )}
    </div>
  );
}
