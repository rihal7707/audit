import { Skeleton } from '@/components/ui/overlays';

export default function PrivacyLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 space-y-6">
      <Skeleton className="h-10 w-60" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

