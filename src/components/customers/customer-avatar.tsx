"use client";

import { cn } from "@/lib/utils";
import { mediaUrl } from "@/lib/api/client";

function getInitials(name: string): string {
  if (!name) return "C";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800",
    "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function CustomerAvatar({
  name,
  photo,
  className,
}: {
  name: string;
  photo?: string | null;
  className?: string;
}) {
  const src = mediaUrl(photo);
  if (src) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className={cn("shrink-0 bg-muted object-cover", className)}
        />
      </>
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border font-bold",
        getAvatarColor(name),
        className,
      )}
    >
      {getInitials(name)}
    </div>
  );
}
