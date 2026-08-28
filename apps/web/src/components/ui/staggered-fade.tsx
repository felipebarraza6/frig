"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/utils";

export function StaggeredFade({
  children,
  className,
  staggerDelay = 0.05,
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <m.div
      className={cn(className)}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </m.div>
  );
}

export function StaggeredItem({
  children,
  className,
  duration = 0.3,
}: {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}) {
  return (
    <m.div
      className={cn(className)}
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration, ease: "easeOut" },
        },
      }}
    >
      {children}
    </m.div>
  );
}
