import { Skeleton } from '@/components/ui/overlays';

export default function AdminAuditDetailLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}

