import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

export function MediaRowSkeleton({ count = 6 }: { count?: number }) {
  const t = useTranslations('common');

  return (
    <div>
      <div aria-hidden="true">
        <Skeleton className="mb-4 h-7 w-48" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className="w-1/2 shrink-0 sm:w-1/3 md:w-1/4 lg:w-1/5 xl:w-1/6"
            >
              <Skeleton className="aspect-[2/3] w-full rounded-lg" />
              <Skeleton className="mt-2 h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
