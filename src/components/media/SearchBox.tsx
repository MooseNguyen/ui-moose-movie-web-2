'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { MAX_QUERY_LENGTH } from '@/lib/search-query';
import type { SearchType } from '@/lib/tmdb/constants';

type Props = {
  defaultValue?: string;
  type?: SearchType;
  /** Called after a non-empty query was submitted (e.g. to close a dialog). */
  onSubmitted?: () => void;
  autoFocus?: boolean;
};

/**
 * Uncontrolled on purpose: the page remounts it with `key={q}` when the URL
 * query changes, so there is no state to keep in sync.
 */
export function SearchBox({
  defaultValue = '',
  type = 'multi',
  onSubmitted,
  autoFocus,
}: Props) {
  const t = useTranslations('search');
  const router = useRouter();
  const inputId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    if (!q) return;
    // An object href lets next-intl encode the query (`a/b`, `50%`,
    // diacritics) exactly once; a hand-built string is easy to get wrong.
    router.push({ pathname: '/search', query: { q, type } });
    onSubmitted?.();
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex gap-2">
      <label htmlFor={inputId} className="sr-only">
        {t('label')}
      </label>
      <input
        id={inputId}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={t('placeholder')}
        enterKeyHint="search"
        autoComplete="off"
        maxLength={MAX_QUERY_LENGTH}
        autoFocus={autoFocus}
        // text-base below md: iOS zooms into inputs under 16px.
        className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full min-w-0 rounded-md border px-3 text-base outline-none focus-visible:ring-3 md:text-sm"
      />
      <Button type="submit" size="icon-lg" aria-label={t('submit')}>
        <Search aria-hidden="true" />
      </Button>
    </form>
  );
}
