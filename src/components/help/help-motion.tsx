"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const springSoft = { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.6 };

export const helpContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.05 },
  },
};

export const helpItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: springSoft,
  },
};

export const helpLine: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 420, damping: 36, mass: 0.5 },
  },
};

export function HelpMotionSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <section className={className}>{children}</section>;
  }
  return (
    <motion.section
      variants={helpContainer}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.section>
  );
}

export function HelpMotionItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div variants={helpItem} className={className}>
      {children}
    </motion.div>
  );
}

/** Línea de texto con spring (pasos, tips, párrafos). */
export function HelpReveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    const C = Tag;
    return <C className={className}>{children}</C>;
  }
  if (Tag === "li") {
    return (
      <motion.li
        variants={helpLine}
        initial="hidden"
        animate="show"
        className={className}
      >
        {children}
      </motion.li>
    );
  }
  return (
    <motion.div
      variants={helpLine}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Skeleton de tarjetas glass para hubs de Ayuda. */
export function HelpCardsSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass flex flex-col gap-3 rounded-2xl p-4"
        >
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5 max-w-[85%]" />
        </div>
      ))}
    </div>
  );
}

export function HelpListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass flex items-center gap-3 rounded-2xl px-3.5 py-3"
        >
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
      ))}
    </div>
  );
}
