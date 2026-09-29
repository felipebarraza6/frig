"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { HELP_GUIDE_GROUPS, searchHelpGuides } from "@/lib/help/guides";
import { cn } from "@/lib/utils";

export function HelpSearch({
  className,
  autoFocus = false,
}: {
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchHelpGuides(q), [q]);

  return (
    <div className={cn("relative min-w-0 w-full", className)}>
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Busca una duda: unir órdenes, cuotas, mesas, SII…"
        aria-label="Buscar en la ayuda"
        className="h-11 w-full rounded-xl border border-border bg-background/80 pl-10 pr-3 text-sm outline-none transition-colors focus:border-primary/50"
      />
      {q.trim() && (
        <ul className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-border bg-background py-1 shadow-lg">
          {hits.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
              Nada coincide. Prueba con otra palabra o abre Soporte.
            </li>
          ) : (
            hits.map((h) => {
              const group = HELP_GUIDE_GROUPS.find((g) => g.id === h.group)?.label;
              return (
                <li key={h.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/help/guides?slug=${encodeURIComponent(h.slug)}`);
                      setQ("");
                    }}
                    className="flex w-full min-w-0 flex-col gap-0.5 px-3 py-2 text-left hover:bg-primary/8"
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{h.title}</span>
                      {group && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">{group}</span>
                      )}
                    </span>
                    <span className="line-clamp-1 text-[12px] text-muted-foreground">
                      {h.snippet || h.summary}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
