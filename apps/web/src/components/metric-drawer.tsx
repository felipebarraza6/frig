"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import { X, type LucideIcon } from "lucide-react";

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
}

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
        <div className="fixed inset-0 z-50">
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
            className="absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.2)] md:left-auto md:right-4 md:top-4 md:max-h-[calc(100vh-2rem)] md:w-96 md:rounded-3xl md:shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {/* Handle */}
            <div
              className="flex w-full cursor-grab items-center justify-center pt-3 pb-1 active:cursor-grabbing md:hidden"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-start gap-3 border-b border-border px-5 pb-4 pt-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
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

            {/* Body */}
            <div className="scrollbar-hide flex-1 overflow-y-auto px-5 py-4">
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>

              {sections && sections.length > 0 && (
                <div className="mt-5 grid gap-2">
                  {sections.map((section, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5"
                    >
                      <span className="text-xs font-medium text-muted-foreground">{section.label}</span>
                      <span className="text-sm font-semibold tabular-nums">{section.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {chart && (
                <div className="mt-5 rounded-xl border border-border bg-background p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Evolución en el período</p>
                  {chart}
                </div>
              )}

              {children && <div className="mt-5">{children}</div>}
            </div>

            {actions && (
              <div className="border-t border-border p-4">
                {actions}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
