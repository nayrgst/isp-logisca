interface Props {
  className?: string;
}

export function Skeleton({ className = 'h-4 w-full' }: Props) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** Esqueleto de uma coluna do Kanban, usado enquanto o dashboard carrega. */
export function ColumnSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex max-w-[300px] min-w-[280px] shrink-0 flex-col rounded-panel border border-line bg-surface/60">
      <div className="border-b border-line px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
      <div className="space-y-2 p-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="rounded-card border border-line bg-surface-raised p-3">
            <Skeleton className="mb-2 h-1 w-full" />
            <Skeleton className="mb-2 h-4 w-32" />
            <Skeleton className="mb-3 h-3 w-20" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
