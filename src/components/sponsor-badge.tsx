"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { publicAsset } from "@/lib/public-asset";
import { getSponsorForSlug, SPONSOR_COPY } from "@/lib/sponsors";

interface SponsorBadgeProps {
  slug?: string | null;
  className?: string;
  /** Sidebar colapsado: solo logo (o nada si no hay imagen). */
  compact?: boolean;
}

export function SponsorBadge({ slug, className, compact = false }: SponsorBadgeProps) {
  const sponsor = getSponsorForSlug(slug);
  const [logoFailed, setLogoFailed] = useState(false);

  if (!sponsor) return null;

  const { label, logoSrc } = SPONSOR_COPY[sponsor];
  const src = publicAsset(logoSrc);

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground",
        compact ? "justify-center" : "justify-center sm:justify-start",
        className,
      )}
      role="note"
    >
      {!logoFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={() => setLogoFailed(true)}
          className="h-4 w-auto max-w-[4.5rem] object-contain opacity-80 dark:opacity-90"
        />
      )}
      {(!compact || logoFailed) && <span>{label}</span>}
      {compact && !logoFailed && <span className="sr-only">{label}</span>}
    </p>
  );
}
