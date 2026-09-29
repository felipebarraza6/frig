"use client";

import { HelpReveal } from "@/components/help/help-motion";
import { cn } from "@/lib/utils";
import type { HelpExample } from "@/lib/help/guides";

/** Mini pantalla con datos reales de FRIG, para leer el ejemplo de un vistazo. */
export function HelpExamplePreview({ example }: { example: HelpExample }) {
  return (
    <HelpReveal className="mt-1">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
        {example.caption ?? "Así se ve"}
      </p>
      <div
        className={cn(
          "glass rounded-xl px-3.5 py-3",
          "shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {example.kicker && (
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {example.kicker}
              </p>
            )}
            <p className="mt-0.5 font-display text-sm font-semibold tracking-tight text-pretty">
              {example.title}
            </p>
            {example.subtitle && (
              <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground text-pretty">
                {example.subtitle}
              </p>
            )}
          </div>
          {example.badge && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {example.badge}
            </span>
          )}
        </div>

        {example.items && example.items.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-border/50 pt-2.5">
            {example.items.map((line) => (
              <li
                key={line}
                className="flex justify-between gap-3 text-[13px] leading-5 text-foreground/90"
              >
                <span className="min-w-0 text-pretty">{line.split("·")[0]?.trim()}</span>
                {line.includes("·") && (
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {line.split("·").slice(1).join("·").trim()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {example.rows && example.rows.length > 0 && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border/50 pt-2.5">
            {example.rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="text-[11px] text-muted-foreground">{row.label}</dt>
                <dd className="text-[13px] font-medium leading-5 text-foreground">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {example.total && (
          <p className="mt-2.5 flex items-baseline justify-between border-t border-border/50 pt-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Total
            </span>
            <span className="font-display text-base font-semibold tabular-nums">
              {example.total}
            </span>
          </p>
        )}

        {example.code && (
          <pre className="mt-3 overflow-x-auto rounded-lg bg-muted/40 px-3 py-2 font-mono text-[11px] leading-5 text-foreground/90">
            {example.code}
          </pre>
        )}
      </div>
    </HelpReveal>
  );
}
