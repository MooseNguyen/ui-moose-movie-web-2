'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { MediaCard, type MediaCardItem } from '@/components/media/MediaCard';
import { MediaGrid } from '@/components/media/MediaGrid';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FavoriteButton } from '@/features/favorites/FavoriteButton';

/**
 * The slim credit the server page sends to the client: only what the card
 * and the favorite button read (no overview, backdrop or genre ids), because
 * prolific actors have hundreds of credits.
 */
export type CreditItem = MediaCardItem;

const PAGE_SIZE = 24;

type Filter = 'all' | 'movie' | 'tv';

export function PersonCredits({ credits }: { credits: CreditItem[] }) {
  const t = useTranslations('person');
  const [filter, setFilter] = useState<Filter>('all');

  if (credits.length === 0) {
    return (
      <p role="status" className="text-muted-foreground">
        {t('noCredits')}
      </p>
    );
  }

  const groups: Record<Filter, CreditItem[]> = {
    all: credits,
    movie: credits.filter((item) => item.mediaType === 'movie'),
    tv: credits.filter((item) => item.mediaType === 'tv'),
  };
  // A media type without credits gets no tab ("All" always has some here).
  const filters = (['all', 'movie', 'tv'] as const).filter(
    (key) => groups[key].length > 0
  );

  return (
    // Radix tabs: a real tablist (arrow keys, aria-selected) that swaps the
    // panel in place without touching the URL.
    <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
      <TabsList aria-label={t('tabsLabel')} className="max-w-full">
        {filters.map((key) => (
          <TabsTrigger key={key} value={key}>
            {t(`tabs.${key}`, { count: groups[key].length })}
          </TabsTrigger>
        ))}
      </TabsList>
      {filters.map((key) => (
        // Radix only mounts the active panel, so switching tabs remounts
        // CreditsPanel and its visible count starts again at PAGE_SIZE.
        <TabsContent key={key} value={key} className="mt-4">
          <CreditsPanel items={groups[key]} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function CreditsPanel({ items }: { items: CreditItem[] }) {
  const t = useTranslations('person');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [announcement, setAnnouncement] = useState<{
    count: number;
    shown: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const done = visible >= items.length;
  const reachedEnd = done && announcement !== null;

  // Same pattern as LoadMoreGrid: when the button disappears, focus the last
  // card's link (right above where the button was) instead of losing it.
  useEffect(() => {
    if (!reachedEnd) return;
    const links = panelRef.current?.querySelectorAll<HTMLElement>('li a');
    links?.[links.length - 1]?.focus();
  }, [reachedEnd]);

  function showMore() {
    const next = Math.min(visible + PAGE_SIZE, items.length);
    setVisible(next);
    setAnnouncement({ count: next - visible, shown: next });
  }

  return (
    <div ref={panelRef}>
      <MediaGrid>
        {items.slice(0, visible).map((item) => (
          <MediaCard
            key={`${item.mediaType}-${item.id}`}
            item={item}
            action={
              <FavoriteButton
                item={{
                  id: item.id,
                  mediaType: item.mediaType,
                  title: item.title,
                  posterPath: item.posterPath,
                  voteAverage: item.voteAverage,
                  year: item.year,
                }}
              />
            }
          />
        ))}
      </MediaGrid>

      {!done && (
        <div className="mt-8 flex justify-center">
          <Button
            type="button"
            size="lg"
            className="min-h-10 px-6"
            onClick={showMore}
          >
            {t('showMoreTitles')}
          </Button>
        </div>
      )}

      {/* The running total makes every announcement different, so screen
          readers repeat it on each click. */}
      <div role="status" className="sr-only">
        {announcement &&
          t('shownMore', {
            count: announcement.count,
            shown: announcement.shown,
            total: items.length,
          })}
      </div>
    </div>
  );
}
