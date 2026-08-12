import { ColumnSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <div className="flex h-16 shrink-0 items-center gap-6 border-b border-line px-6">
        <Skeleton className="h-9 w-9 rounded-control" />
        <Skeleton className="h-4 w-32" />
        <div className="ml-auto">
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-3">
        <Skeleton className="h-9 w-48 rounded-control" />
        <Skeleton className="h-9 w-64 rounded-control" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-32 rounded-control" />
          <Skeleton className="h-8 w-28 rounded-control" />
        </div>
      </div>

      <div className="flex gap-4 overflow-hidden p-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <ColumnSkeleton key={index} cards={index === 0 ? 3 : 2} />
        ))}
      </div>
    </div>
  );
}
