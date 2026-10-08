import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

/** Mirrors the search page (h1, search box, tabs, MediaGrid) to avoid layout shift. */
export default function SearchLoading() {
  const t = useTranslations('common');

  return (
    <div role="status" className="mx-auto max-w-7xl px-4 pt-24 pb-10">
      <div aria-hidden="true">
        {/* text-3xl line height (2.25rem) = h-9 */}
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-6 h-10 max-w-xl rounded-md" />
        <div className="mt-6 mb-8 flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[38px] w-24 rounded-full" />
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <li key={i}>
              <Skeleton className="aspect-[2/3] w-full rounded-lg" />
              <Skeleton className="mt-2 h-5 w-3/4" />
              <Skeleton className="mt-0.5 h-4 w-1/3" />
            </li>
          ))}
        </ul>
      </div>
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
