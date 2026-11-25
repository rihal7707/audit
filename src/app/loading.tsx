import { Skeleton } from '@/components/ui/overlays';

export default function RootLoading() {
  return (
    <div className="mx-auto max-w-public px-4 py-12 sm:px-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
      </div>
    </div>
  );
}

