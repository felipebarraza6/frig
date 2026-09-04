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
              <Skeleton className="h-4 w-3/4 bg-muted/50" />
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

export { Skeleton, SkeletonText, SkeletonCircle, SkeletonCard, TableSkeleton, GridSkeleton };
