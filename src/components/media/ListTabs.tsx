import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { MediaType, MovieList, TvList } from '@/lib/tmdb/constants';
import { MOVIE_LISTS, TV_LISTS } from '@/lib/tmdb/constants';

type Props = { mediaType: MediaType; active: MovieList | TvList };

/**
 * List switcher. These are real links (each tab is a different URL rendered
 * by the server), so it is a navigation landmark with aria-current, not an
 * ARIA tablist (which promises arrow-key roving and in-page panels).
 */
export function ListTabs({ mediaType, active }: Props) {
  const t = useTranslations('list');
  const lists = mediaType === 'movie' ? MOVIE_LISTS : TV_LISTS;

  return (
    <nav aria-label={t('tabsLabel')} className="min-w-0">
      {/* The list scrolls horizontally on narrow screens; the page does not.
          Padding + negative margin keep focus rings from being clipped. */}
      <ul className="-mx-1 flex min-w-0 gap-2 overflow-x-auto p-1">
        {lists.map((list) => (
          <li key={list} className="shrink-0">
            <Link
              href={`/${mediaType}?list=${list}`}
              aria-current={list === active ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-ring block rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2',
                list === active
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {t(`tabs.${list}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
