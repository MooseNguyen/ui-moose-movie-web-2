'use client';

import { useTranslations } from 'next-intl';
import { useId, useOptimistic, useTransition, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
// Type-only: the runtime modules behind these are server-only.
import type { MediaType } from '@/lib/tmdb/constants';
import type { Genre } from '@/lib/tmdb/types';
import {
  DEFAULT_DISCOVER,
  DISCOVER_SORTS,
  serializeDiscoverParams,
  type DiscoverParams,
  type DiscoverSort,
} from './params';

type Props = { value: DiscoverParams; genres: Genre[] };

const TYPES: readonly MediaType[] = ['movie', 'tv'];
const MIN_YEAR = 1950;
// Radix Select items cannot use an empty string as their value.
const ALL_YEARS = 'all';

// Message keys cannot contain dots, so the neutral URL keys are mapped.
const SORT_LABEL: Record<
  DiscoverSort,
  'popularity' | 'rating' | 'releaseDate' | 'title'
> = {
  'popularity.desc': 'popularity',
  'vote_average.desc': 'rating',
  'release_date.desc': 'releaseDate',
  'title.asc': 'title',
};

function yearsFrom(currentYear: number): number[] {
  return Array.from(
    { length: currentYear - MIN_YEAR + 1 },
    (_, i) => currentYear - i
  );
}

/**
 * Discover filters. The URL is the single source of truth: every change
 * navigates to the new query and the server renders the results.
 */
export function DiscoverFilters({ value, genres }: Props) {
  const t = useTranslations('discover');
  const router = useRouter();
  const id = useId();
  const [, startTransition] = useTransition();
  // `value` only changes once the navigation has rendered. Deriving the next
  // query from the optimistic value keeps rapid clicks (two genres in a row)
  // from dropping the earlier change, and the pressed state shows instantly.
  const [current, setCurrent] = useOptimistic(value);

  function apply(next: DiscoverParams) {
    const query = Object.fromEntries(
      new URLSearchParams(serializeDiscoverParams(next))
    );
    startTransition(() => {
      setCurrent(next);
      // scroll: false keeps the filters (and focus) where the user is.
      router.push({ pathname: '/discover', query }, { scroll: false });
    });
  }

  function toggleGenre(genreId: number) {
    const genresNext = current.genres.includes(genreId)
      ? current.genres.filter((g) => g !== genreId)
      : [...current.genres, genreId].sort((a, b) => a - b);
    apply({ ...current, genres: genresNext });
  }

  function selectType(type: MediaType) {
    if (type === current.type) return;
    // Genre ids differ between movie and TV, so the selection is dropped.
    apply({ ...current, type, genres: [] });
  }

  const isDefault = serializeDiscoverParams(current) === '';
  const years = yearsFrom(new Date().getFullYear());

  return (
    <section aria-label={t('filtersLabel')} className="flex flex-col gap-5">
      <FilterGroup id={`${id}-type`} label={t('typeLabel')}>
        {TYPES.map((type) => (
          <Chip
            key={type}
            pressed={current.type === type}
            onClick={() => selectType(type)}
          >
            {t(`types.${type}`)}
          </Chip>
        ))}
      </FilterGroup>

      {genres.length > 0 && (
        <FilterGroup id={`${id}-genres`} label={t('genresLabel')}>
          {genres.map((genre) => (
            <Chip
              key={genre.id}
              pressed={current.genres.includes(genre.id)}
              onClick={() => toggleGenre(genre.id)}
            >
              {genre.name}
            </Chip>
          ))}
        </FilterGroup>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-year`} className="text-sm font-medium">
            {t('yearLabel')}
          </label>
          <Select
            value={current.year === null ? ALL_YEARS : String(current.year)}
            onValueChange={(v) =>
              apply({ ...current, year: v === ALL_YEARS ? null : Number(v) })
            }
          >
            <SelectTrigger id={`${id}-year`} className="min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_YEARS}>{t('allYears')}</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-sort`} className="text-sm font-medium">
            {t('sortLabel')}
          </label>
          <Select
            value={current.sort}
            onValueChange={(v) =>
              apply({ ...current, sort: v as DiscoverSort })
            }
          >
            <SelectTrigger id={`${id}-sort`} className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISCOVER_SORTS.map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {t(`sorts.${SORT_LABEL[sort]}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isDefault && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => apply(DEFAULT_DISCOVER)}
          >
            {t('clear')}
          </Button>
        )}
      </div>
    </section>
  );
}

function FilterGroup({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-sm font-medium">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      // Constant name; the state is conveyed by aria-pressed only.
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2',
        pressed
          ? 'bg-primary text-primary-foreground border-transparent'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {children}
    </button>
  );
}
