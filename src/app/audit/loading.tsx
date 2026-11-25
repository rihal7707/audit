import { Skeleton } from '@/components/ui/overlays';

export default function AuditLoading() {
  return (
    <div className="mx-auto max-w-public px-4 py-12 sm:px-6 flex justify-center gap-8">
      <Skeleton className="hidden lg:block h-80 w-[280px] rounded-lg" />
      <Skeleton className="h-[460px] w-full max-w-[640px] rounded-lg" />
    </div>
  );
}

