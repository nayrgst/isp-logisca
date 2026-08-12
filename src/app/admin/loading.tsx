import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex h-16 shrink-0 items-center gap-6 border-b border-line px-6">
        <Skeleton className="h-9 w-9 rounded-control" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mx-auto w-full max-w-6xl space-y-4 p-6">
        <Skeleton className="h-9 w-56 rounded-control" />
        <Skeleton className="h-40 w-full rounded-panel" />
        <Skeleton className="h-96 w-full rounded-panel" />
      </div>
    </div>
  );
}
