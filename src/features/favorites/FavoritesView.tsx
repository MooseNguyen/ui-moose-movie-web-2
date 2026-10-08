'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MediaCard, type MediaCardItem } from '@/components/media/MediaCard';
import { MediaGrid } from '@/components/media/MediaGrid';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from '@/i18n/navigation';
import { selectSorted, useFavorites, type FavoriteItem } from './store';

type Filter = 'all' | 'movie' | 'tv';

const FILTERS = ['all', 'movie', 'tv'] as const;
const SKELETON_COUNT = 12;

/** Marks the per-card remove buttons so focus can be moved between them. */
const REMOVE_ATTR = 'data-favorite-remove';

function toCardItem(item: FavoriteItem): MediaCardItem {
  return {
    id: item.id,
    mediaType: item.mediaType,
    title: item.title,
    posterPath: item.posterPath,
    year: item.year,
    voteAverage: item.voteAverage,
    // FavoriteItem stores no vote count. The card hides the rating when
    // voteCount is 0, which is what an unrated title (average 0) should do.
    voteCount: item.voteAverage > 0 ? 1 : 0,
  };
}

type FavoritesViewProps = {
  /** Id of the page `h1` (with tabIndex -1): focus target when a list empties. */
  headingId: string;
};

export function FavoritesView({ headingId }: FavoritesViewProps) {
  const t = useTranslations('favorites');
  const hasHydrated = useFavorites((s) => s.hasHydrated);
  // Select the stored array (stable reference) and derive the sorted groups in
  // a memo; a selector returning a fresh array would re-render forever.
  const items = useFavorites((s) => s.items);
  const remove = useFavorites((s) => s.remove);
  const restore = useFavorites((s) => s.restore);
  const clear = useFavorites((s) => s.clear);

  const [filter, setFilter] = useState<Filter>('all');
  const panelRef = useRef<HTMLDivElement>(null);
  const emptyLinkRef = useRef<HTMLAnchorElement>(null);
  /** Set by a remove click, consumed by the effect after the list re-renders. */
  const pendingFocus = useRef<{ filter: Filter; index: number } | null>(null);
  const clearedRef = useRef(false);

  const groups = useMemo<Record<Filter, FavoriteItem[]>>(
    () => ({
      all: selectSorted({ items }, 'all'),
      movie: selectSorted({ items }, 'movie'),
      tv: selectSorted({ items }, 'tv'),
    }),
    [items]
  );

  // The active type tab lost its last item (a removal here or a change from
  // another tab): fall back to "all". Adjusting state during render avoids an
  // extra commit with an empty, tab-less panel.
  if (filter !== 'all' && groups[filter].length === 0) {
    setFilter('all');
  }

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    if (groups[pending.filter].length === 0) {
      document.getElementById(headingId)?.focus();
      return;
    }
    const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>(
      `[${REMOVE_ATTR}]`
    );
    if (!buttons?.length) return;
    // The item that slid into the removed slot, or the new last one.
    buttons[Math.min(pending.index, buttons.length - 1)].focus();
  }, [groups, headingId]);

  if (!hasHydrated) {
    // The server and the first client render have no favorites yet (they
    // live in localStorage), so both render this same placeholder.
    return (
      <div role="status">
        <span className="sr-only">{t('loading')}</span>
        <div
          aria-hidden="true"
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-start gap-3 rounded-lg border p-6 text-sm">
        <p>{t('empty')}</p>
        <Link
          ref={emptyLinkRef}
          href="/discover"
          className="text-foreground focus-visible:ring-ring rounded-sm font-medium underline outline-none focus-visible:ring-2"
        >
          {t('emptyCta')}
        </Link>
      </div>
    );
  }

  function handleRemove(item: FavoriteItem, index: number) {
    pendingFocus.current = { filter, index };
    remove(item.mediaType, item.id);
    toast(t('removed', { title: item.title }), {
      action: { label: t('undo'), onClick: () => restore(item) },
    });
  }

  const visibleFilters = FILTERS.filter((key) => groups[key].length > 0);

  return (
    <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList aria-label={t('tabsLabel')} className="max-w-full">
          {visibleFilters.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`tabs.${key}`, { count: groups[key].length })}
            </TabsTrigger>
          ))}
        </TabsList>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">
              {t('clearAll')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent
            onCloseAutoFocus={(event) => {
              if (!clearedRef.current) return;
              // The trigger is gone with the list; Radix would drop focus on
              // <body>. Send it to the empty state's call to action instead.
              clearedRef.current = false;
              event.preventDefault();
              emptyLinkRef.current?.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{t('clearTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('clearDescription', { count: items.length })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('clearCancel')}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  clearedRef.current = true;
                  clear();
                }}
              >
                {t('clearConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Inactive Radix panels stay in the DOM as empty hidden divs, so a
          query from this wrapper only finds the active panel's buttons. */}
      <div ref={panelRef}>
        {visibleFilters.map((key) => (
          <TabsContent key={key} value={key} className="mt-4">
            <MediaGrid>
              {groups[key].map((item, index) => (
                <MediaCard
                  key={`${item.mediaType}-${item.id}`}
                  item={toCardItem(item)}
                  action={
                    <button
                      type="button"
                      {...{ [REMOVE_ATTR]: '' }}
                      aria-label={t('removeItem', { title: item.title })}
                      onClick={() => handleRemove(item, index)}
                      className="bg-background/70 hover:bg-background/90 text-foreground hover:text-destructive focus-visible:ring-ring inline-flex size-10 items-center justify-center rounded-full backdrop-blur transition-colors outline-none focus-visible:ring-2"
                    >
                      <Trash2 aria-hidden="true" className="size-5" />
                    </button>
                  }
                />
              ))}
            </MediaGrid>
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
