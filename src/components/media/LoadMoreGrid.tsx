'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ActionError, ActionResult } from '@/lib/actions/types';
import type { GridItem, Paginated } from '@/lib/tmdb/types';
import { GridItemCard } from './GridItemCard';
import { MediaGrid } from './MediaGrid';

type Props = {
  initial: Paginated<GridItem>;
  loadMore: (page: number) => Promise<ActionResult<Paginated<GridItem>>>;
};

type Announcement =
  | { kind: 'loading' }
  | { kind: 'loaded'; count: number; total: number; done: boolean };

// The first mobile row (2 columns) sits above the fold, under the page title
// and tabs; its posters are the LCP candidates. More would compete for
// bandwidth with them on mobile.
const PRIORITY_CARD_COUNT = 2;

const itemKey = (item: GridItem) => `${item.mediaType}-${item.id}`;

const ERROR_KEY: Record<ActionError, 'rateLimit' | 'network' | 'loadMore'> = {
  rate_limit: 'rateLimit',
  network: 'network',
  invalid_input: 'loadMore',
  not_found: 'loadMore',
  unknown: 'loadMore',
};

/**
 * Shows server-rendered page 1 and appends further pages on demand.
 *
 * The parent MUST pass a `key` (list name / query string) so switching to a
 * different list remounts this component and resets its state; `initial` is
 * only read on mount.
 */
export function LoadMoreGrid({ initial, loadMore }: Props) {
  const t = useTranslations('list');
  const tErrors = useTranslations('errors');
  const tCommon = useTranslations('common');
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [error, setError] = useState<ActionError | null>(null);
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  const itemsRef = useRef(items);
  const inFlight = useRef(false); // synchronous guard: state lags a double click
  // Defence in depth: inFlight already prevents overlapping requests, but this
  // guarantees a superseded response can never be applied.
  const requestId = useRef(0);
  const mounted = useRef(true);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const done = page >= totalPages;
  const reachedEnd = done && announcement?.kind === 'loaded';

  // The button disappears on the last page. Move focus to the last item's link:
  // it sits directly above where the button was, so there is no scroll jump and
  // keyboard users continue from the end of the list.
  useEffect(() => {
    if (!reachedEnd) return;
    const links = gridRef.current?.querySelectorAll<HTMLElement>('li a');
    links?.[links.length - 1]?.focus();
  }, [reachedEnd]);

  async function load() {
    if (inFlight.current) return;
    inFlight.current = true;
    const id = ++requestId.current;
    setPending(true);
    setAnnouncement({ kind: 'loading' });

    let result: Awaited<ReturnType<Props['loadMore']>>;
    try {
      result = await loadMore(page + 1);
    } catch {
      result = { ok: false, error: 'unknown' };
    }

    // Ignore late responses: unmounted, or superseded by a newer request.
    if (!mounted.current || id !== requestId.current) return;
    inFlight.current = false;
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      setAnnouncement(null); // the role=alert message takes over
      return;
    }
    setError(null);
    const known = new Set(itemsRef.current.map(itemKey));
    const fresh = result.data.items.filter((item) => {
      const key = itemKey(item);
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    const next = [...itemsRef.current, ...fresh];
    itemsRef.current = next;
    setItems(next);
    setPage(result.data.page);
    setTotalPages(result.data.totalPages);
    setAnnouncement({
      kind: 'loaded',
      count: fresh.length,
      total: next.length,
      done: result.data.page >= result.data.totalPages,
    });
  }

  return (
    <div ref={gridRef}>
      <MediaGrid>
        {items.map((item, index) => (
          <GridItemCard
            key={itemKey(item)}
            item={item}
            // Initial items come first and keep their index, so appended
            // pages are never prioritized.
            priority={index < PRIORITY_CARD_COUNT}
            // Every caller renders the grid right under the page h1.
            headingLevel="h2"
          />
        ))}
      </MediaGrid>

      <div className="mt-8 flex flex-col items-center gap-3">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {tErrors(ERROR_KEY[error])}
          </p>
        )}
        {!done && (
          <Button
            type="button"
            size="lg"
            className={cn(
              'min-h-10 px-6',
              'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'
            )}
            // aria-disabled, not disabled: a disabled button drops focus to
            // <body> in real browsers (jsdom does not reproduce this). The
            // inFlight ref makes activation while pending a no-op.
            aria-disabled={pending || undefined}
            aria-busy={pending}
            onClick={load}
          >
            {pending && (
              <Loader2
                aria-hidden="true"
                className="motion-safe:animate-spin"
              />
            )}
            {error ? tErrors('retry') : t('loadMore')}
          </Button>
        )}
      </div>

      <div role="status" className="sr-only">
        {announcement?.kind === 'loading' && tCommon('loading')}
        {announcement?.kind === 'loaded' && (
          <>
            {t('loadedMore', {
              count: announcement.count,
              total: announcement.total,
            })}
            {announcement.done && ` ${t('allLoaded')}`}
          </>
        )}
      </div>
    </div>
  );
}
