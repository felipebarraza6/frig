"use client";

import { cn } from "@/lib/utils";

const GOLD = "#e9bd4a";

export function SectionTitle({
  kicker,
  title,
  sub,
  dark = false,
}: {
  kicker: string;
  title: string;
  sub: string;
  dark?: boolean;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <p
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em]"
        style={{ color: dark ? GOLD : undefined }}
      >
        <span
          className="inline-block h-2 w-2"
          style={{ backgroundColor: dark ? GOLD : "var(--color-primary)" }}
          aria-hidden
        />
        <span className={dark ? undefined : "text-primary"}>{kicker}</span>
      </p>
      <h2
        className={cn(
          "mt-3 font-pixel text-2xl leading-snug tracking-wide sm:text-3xl",
          dark ? "text-white" : "text-foreground",
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "mt-3 text-sm leading-relaxed sm:text-base",
          dark ? "text-emerald-100/80" : "text-muted-foreground",
        )}
      >
        {sub}
      </p>
    </div>
  );
}
