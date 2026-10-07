'use client';

import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { isFavorite, useFavorites, type FavoriteItem } from './store';

type FavoriteButtonProps = {
  item: Omit<FavoriteItem, 'addedAt'>;
};

export function FavoriteButton({ item }: FavoriteButtonProps) {
  const t = useTranslations('favorites');
  const hasHydrated = useFavorites((s) => s.hasHydrated);
  // Primitive selectors: stable between renders, no new objects/arrays.
  const saved = useFavorites((s) => isFavorite(s, item.mediaType, item.id));
  const toggle = useFavorites((s) => s.toggle);

  // Before hydration the server (empty store) and client must render the same
  // thing, so the heart is neutral and inert until localStorage has been read.
  // aria-pressed stays present as "false" so the button is always a toggle.
  const pressed = hasHydrated && saved;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // The button sits outside the card link, but never let a click bubble into
    // a parent handler or trigger navigation.
    event.preventDefault();
    event.stopPropagation();
    toggle(item);
  }

  return (
    <button
      type="button"
      // Constant name; state is conveyed by aria-pressed only. A label that
      // flipped add/remove would make screen readers announce it twice.
      aria-label={t('toggle', { title: item.title })}
      aria-pressed={pressed}
      disabled={!hasHydrated}
      onClick={handleClick}
      className={cn(
        'bg-background/70 hover:bg-background/90 focus-visible:ring-ring inline-flex size-10 items-center justify-center rounded-full backdrop-blur transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-60',
        pressed ? 'text-rose-500' : 'text-foreground'
      )}
    >
      <Heart
        aria-hidden="true"
        className={cn('size-5', pressed && 'fill-current')}
      />
    </button>
  );
}
