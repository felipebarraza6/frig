"use client";

import { SkeletonText } from "@/components/ui/skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="flex h-[110px] flex-col justify-between overflow-hidden rounded-xl border border-border/60 bg-muted/20 p-2.5 sm:h-[132px] sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <SkeletonText width="85%" height="md" className="bg-muted" />
      </div>
      <div className="mt-1.5 flex flex-col gap-1.5 sm:mt-2 sm:gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <SkeletonText width="40%" height="sm" className="bg-muted" />
          <SkeletonText width="30%" height="sm" className="bg-muted" />
        </div>
        <SkeletonText width="45%" height="lg" className="self-end bg-muted" />
      </div>
    </div>
  );
}

export function ProductCardSkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
