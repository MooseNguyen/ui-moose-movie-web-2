import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

export function MediaRowSkeleton({ count = 6 }: { count?: number }) {
  const t = useTranslations('common');

  return (
    <div role="status">
      <div aria-hidden="true">
        <Skeleton className="mb-4 h-7 w-48" />
        <div className="-ml-4 flex overflow-hidden">
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className="min-w-0 shrink-0 grow-0 basis-1/2 pl-4 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
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
