import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9" />
        </div>
      </header>

      {/* Contenido */}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-xl" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="mb-2 h-7 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </section>

        {/* Tabla genérica */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border px-4 py-3">
            <Skeleton className="h-3 w-48" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
            >
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
