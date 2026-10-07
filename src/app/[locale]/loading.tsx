import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 pt-24"
      aria-busy="true"
    >
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="aspect-[2/3] w-full" />
        ))}
      </div>
    </main>
  );
}
