"use client";

import { cn } from "@/lib/utils";

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
        style={{ color: dark ? "#c67d52" : undefined }}
      >
        {/* Rombo: guiño al hexágono del logo FRIG */}
        <span
          className="inline-block h-2 w-2 rotate-45"
          style={{ backgroundColor: dark ? "#c67d52" : "var(--color-primary)" }}
          aria-hidden
        />
        <span className={dark ? "text-[#c67d52]" : "text-primary"}>{kicker}</span>
      </p>
      <h2
        className={cn(
          "mt-3 font-sans text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl",
          dark ? "text-white" : "text-foreground",
        )}
      >
        {title}
      </h2>
      <p
        className={cn(
          "mt-3 text-sm leading-relaxed sm:text-base",
          dark ? "text-zinc-300" : "text-muted-foreground",
        )}
      >
        {sub}
      </p>
    </div>
  );
}
