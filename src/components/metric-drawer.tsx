"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatTone } from "@/components/ui/stat-card";

export interface MetricDrawerSection {
  label: string;
  value: string;
}

export interface MetricDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  value: string | number;
  icon: LucideIcon;
  description: string;
  sections?: MetricDrawerSection[];
  chart?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /** Acento de marca / semántica alineado a StatCard. */
  tone?: StatTone;
}

const TONE_ICON: Record<StatTone, string> = {
  success: "bg-success/12 text-success",
  danger: "bg-danger/12 text-danger",
  warning: "bg-warning/12 text-warning",
  primary: "bg-primary/12 text-primary",
  muted: "bg-muted text-muted-foreground",
};

const TONE_VALUE: Record<StatTone, string> = {
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  primary: "text-primary",
  muted: "text-foreground",
};

const TONE_BAR: Record<StatTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  primary: "bg-primary",
  muted: "bg-border",
};

export function MetricDrawer({
  open,
  onClose,
  title,
  value,
  icon: Icon,
  description,
  sections,
  chart,
  actions,
  children,
  tone = "primary",
}: MetricDrawerProps) {
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 80 || info.velocity.y > 500) {
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={sheetRef}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.12}
            onDragEnd={handleDragEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute bottom-0 left-0 right-0 flex h-[80dvh] flex-col overflow-hidden rounded-t-3xl bg-background shadow-[0_-8px_40px_rgba(0,0,0,0.2)] pb-[env(safe-area-inset-bottom)] md:left-auto md:right-4 md:top-4 md:h-auto md:max-h-[calc(100vh-2rem)] md:w-[480px] md:rounded-3xl md:shadow-2xl md:pb-0"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className={cn("absolute inset-x-0 top-0 h-1", TONE_BAR[tone])} aria-hidden />

            <div
              className="flex w-full shrink-0 cursor-grab items-center justify-center pt-3 pb-1 active:cursor-grabbing md:hidden"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Meta fija: título, KPIs y evolución */}
            <div className="shrink-0 border-b border-border bg-background px-4 pb-3 pt-2 md:px-5 md:pb-4 md:pt-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl md:h-10 md:w-10",
                    TONE_ICON[tone],
                  )}
                >
                  <Icon className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{title}</p>
                  <p className={cn("text-xl font-bold tabular-nums tracking-tight md:text-2xl", TONE_VALUE[tone])}>
                    {value}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>

              {sections && sections.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {sections.map((section, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border/80 bg-primary/[0.03] px-3 py-2"
                    >
                      <p className="text-[11px] font-medium text-muted-foreground">{section.label}</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                        {section.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {chart && (
                <div className="mt-3 rounded-xl border border-border/80 bg-primary/[0.03] p-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Evolución en el período
                  </p>
                  {chart}
                </div>
              )}
            </div>

            {/* Solo las listas hacen scroll */}
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-3 md:px-5 md:py-4">
              {children ?? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin detalle adicional.</p>
              )}
            </div>

            {actions && <div className="shrink-0 border-t border-border bg-background p-3 md:p-4">{actions}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
