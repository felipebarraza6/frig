import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

function SkeletonText({
  width = "100%",
  height = "md",
  className,
}: {
  width?: string;
  height?: "sm" | "md" | "lg";
  className?: string;
}) {
  const heightClass = { sm: "h-3", md: "h-4", lg: "h-5" }[height];
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", heightClass, className)}
      style={{ width }}
    />
  );
}

function SkeletonCircle({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("animate-pulse rounded-full bg-muted", className)}
      style={{ width: size, height: size }}
    />
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border p-4 space-y-3", className)}>
      <div className="flex items-center gap-3">
        <SkeletonCircle size={40} />
        <div className="flex-1 space-y-2">
          <SkeletonText width="50%" height="md" />
          <SkeletonText width="30%" height="sm" />
        </div>
      </div>
      <SkeletonText width="100%" height="md" />
      <SkeletonText width="80%" height="sm" />
    </div>
  );
}

function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}: {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      {showHeader && (
        <div className="flex gap-4 pb-3 border-b border-border">
          {Array.from({ length: columns }).map((_, ci) => (
            <div key={ci} className="flex-1">
              <Skeleton className="h-4 w-3/4 bg-background" />
            </div>
          ))}
        </div>
      )}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={ri} className="flex gap-4 py-3">
            {Array.from({ length: columns }).map((_, ci) => (
              <div key={ci} className="flex-1">
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function GridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <div className="aspect-square bg-muted animate-pulse" />
          <div className="p-3 space-y-2">
            <SkeletonText width="80%" height="md" />
            <SkeletonText width="50%" height="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 md:hidden">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-border bg-background p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div className="shrink-0 space-y-1 text-right">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="ml-auto h-3 w-16" />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
            {Array.from({ length: 4 }).map((__, i) => (
              <div key={i} className="min-w-0 space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {Array.from({ length: 4 }).map((__, i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export { Skeleton, SkeletonText, SkeletonCircle, SkeletonCard, TableSkeleton, GridSkeleton, MobileCardsSkeleton, StatCardSkeleton };
