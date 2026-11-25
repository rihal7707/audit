import { Skeleton } from '@/components/ui/overlays';

export default function ReportLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-56 w-full rounded-none" />
      <div className="mx-auto max-w-public px-4 sm:px-6 space-y-6">
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  );
}

