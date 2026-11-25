import { Skeleton } from '@/components/ui/overlays';

export default function ProgressLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Skeleton className="h-[520px] w-full rounded-xl" />
    </div>
  );
}

