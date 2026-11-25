import { Skeleton } from '@/components/ui/overlays';

export default function StaticPageLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 space-y-6">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

