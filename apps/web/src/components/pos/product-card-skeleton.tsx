"use client";

import { SkeletonText } from "@/components/ui/skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full w-full items-center gap-3 overflow-hidden rounded-2xl border border-border/70 bg-card p-2 shadow-sm">
      <div className="h-14 w-14 shrink-0 rounded-lg bg-muted" />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <SkeletonText width="90%" height="md" className="bg-muted" />
          <div className="flex flex-wrap items-center gap-1">
            <SkeletonText width="40%" height="sm" className="bg-muted" />
          </div>
        </div>
        <SkeletonText width="35%" height="lg" className="bg-muted" />
      </div>
    </div>
  );
}

export function ProductCardSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
