import { Skeleton } from '@/components/ui/overlays';

export default function AdminAuditsLoading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

