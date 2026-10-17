'use client';

import { Search } from 'lucide-react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Button } from '@/components/ui/button';
import { useSearchSuggestions } from '@/hooks/use-search-suggestions';
import { Link, useRouter } from '@/i18n/navigation';
import { tmdbImage } from '@/lib/images';
import { MAX_QUERY_LENGTH } from '@/lib/search-query';
import type { Suggestion } from '@/lib/search-suggest';
import { cn } from '@/lib/utils';

type Props = {
  /** Called when a navigation starts (closes the dialog). */
  onNavigate: () => void;
};

const TYPE_LABEL_KEYS = {
  movie: 'tabs.movie',
  tv: 'tabs.tv',
  person: 'tabs.person',
} as const;

// bg-accent alone is ~1.1:1 against the dialog: the inset bar in the text
// color is the visible indicator (WCAG 1.4.11 asks 3:1), in both themes.
const ACTIVE_OPTION =
  'bg-accent text-accent-foreground shadow-[inset_3px_0_0_var(--foreground)]';

function suggestionHref(item: Suggestion) {
  return item.mediaType === 'person'
    ? `/person/${item.id}`
    : `/${item.mediaType}/${item.id}`;
}

/**
 * Search input with live suggestions, following the WAI-ARIA combobox
 * pattern: focus stays in the input and `aria-activedescendant` points at the
 * highlighted option. Options are real links, so middle-click and "open in
 * new tab" work; the last option goes to the full results page.
 *
 * While an IME composes (e.g. Vietnamese Telex on macOS), the text is not a
 * query yet and Enter/arrows belong to the IME, so neither is acted on.
 */
export function SearchCombobox({ onNavigate }: Props) {
  const t = useTranslations('search');
  const locale = useLocale();
  const router = useRouter();
  const inputId = useId();
  const listId = useId();

  const [value, setValue] = useState('');
  // The text suggestions are fetched for: `value` minus any IME composition.
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const composing = useRef(false);

  const suggestions = useSearchSuggestions(query, locale);
  const q = value.trim();
  const expanded = suggestions.status !== 'idle';
  const optionCount = suggestions.items.length + 1; // + "see all"
  // Suggestions can change under a highlighted index (a slower answer).
  const activeIndex = expanded ? Math.min(active, optionCount - 1) : -1;
  const optionId = (index: number) => `${listId}-${index}`;

  useEffect(() => {
    if (activeIndex < 0) return;
    // Not in jsdom.
    document
      .getElementById(optionId(activeIndex))
      ?.scrollIntoView?.({ block: 'nearest' });
  });

  function searchAll() {
    if (!q) return;
    // An object href lets next-intl encode the query exactly once.
    router.push({ pathname: '/search', query: { q, type: 'multi' } });
    onNavigate();
  }

  function open(index: number) {
    const item = suggestions.items[index];
    if (!item) return searchAll();
    router.push(suggestionHref(item));
    onNavigate();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeIndex >= 0) open(activeIndex);
    else searchAll();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // keyCode 229: Safari reports IME keys this way without isComposing.
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (!expanded) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((activeIndex + 1) % optionCount);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(activeIndex <= 0 ? optionCount - 1 : activeIndex - 1);
    }
  }

  function handleCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    composing.current = false;
    setQuery(event.currentTarget.value);
  }

  let message: string | null = null;
  if (suggestions.status === 'loading' && suggestions.items.length === 0) {
    message = t('suggestLoading');
  } else if (
    suggestions.status === 'success' &&
    suggestions.items.length === 0
  ) {
    message = t('suggestEmpty', { query: q });
  } else if (suggestions.status === 'error') {
    message = t('suggestError');
  }

  // Settled states only: announcing every keystroke's loading is noise.
  let announcement = '';
  if (suggestions.status === 'success' && suggestions.items.length > 0) {
    announcement = t('suggestCount', { count: suggestions.items.length });
  } else if (suggestions.status !== 'loading' && message) {
    announcement = message;
  }

  return (
    <div>
      <form role="search" onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          {t('label')}
        </label>
        <input
          id={inputId}
          type="text"
          name="q"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setActive(-1);
            if (!composing.current) setQuery(event.target.value);
          }}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_QUERY_LENGTH}
          autoFocus
          // text-base below md: iOS zooms into inputs under 16px.
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full min-w-0 rounded-md border px-3 text-base outline-none focus-visible:ring-3 md:text-sm"
        />
        <Button type="submit" size="icon-lg" aria-label={t('submit')}>
          <Search aria-hidden="true" />
        </Button>
      </form>

      <p role="status" className="sr-only">
        {announcement}
      </p>

      {expanded && (
        <>
          {message && (
            <p
              aria-hidden="true"
              className="text-muted-foreground mt-3 text-sm"
            >
              {message}
            </p>
          )}
          <div
            id={listId}
            role="listbox"
            aria-label={t('suggestions')}
            className="mt-3 max-h-[min(24rem,50vh)] overflow-y-auto"
          >
            {suggestions.items.map((item, index) => (
              <Link
                key={`${item.mediaType}-${item.id}`}
                id={optionId(index)}
                href={suggestionHref(item)}
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={-1}
                onClick={onNavigate}
                onPointerMove={() => setActive(index)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-1.5 text-sm',
                  index === activeIndex && ACTIVE_OPTION
                )}
              >
                <span className="bg-muted relative h-12 w-8 shrink-0 overflow-hidden rounded">
                  <Image
                    src={tmdbImage(
                      item.imagePath,
                      'w185',
                      item.mediaType === 'person' ? 'profile' : 'poster'
                    )}
                    alt=""
                    fill
                    sizes="32px"
                    unoptimized={!item.imagePath}
                    className="object-cover"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {item.title}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {item.year !== null && `${item.year} · `}
                    {t(TYPE_LABEL_KEYS[item.mediaType])}
                  </span>
                </span>
              </Link>
            ))}
            <Link
              id={optionId(suggestions.items.length)}
              href={{ pathname: '/search', query: { q, type: 'multi' } }}
              role="option"
              aria-selected={activeIndex === suggestions.items.length}
              tabIndex={-1}
              onClick={onNavigate}
              onPointerMove={() => setActive(suggestions.items.length)}
              className={cn(
                'text-muted-foreground flex items-center gap-3 rounded-md px-2 py-2 text-sm',
                activeIndex === suggestions.items.length && ACTIVE_OPTION
              )}
            >
              <Search aria-hidden="true" className="size-4 shrink-0" />
              {t('seeAll', { query: q })}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
