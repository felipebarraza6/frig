"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LifeBuoy,
  CircleHelp,
  AlertTriangle,
  MessageSquareHeart,
  BookOpen,
  FolderKanban,
  MessageSquareWarning,
} from "lucide-react";
import { SupportCreateModal } from "@/components/support/support-create-modal";
import type { SupportInquiryKind } from "@/lib/api/support";
import { useProductName } from "@/lib/product-name";

const QUICK: {
  kind: SupportInquiryKind;
  label: string;
  hint: string;
  icon: typeof CircleHelp;
}[] = [
  {
    kind: "incident",
    label: "Incidencia",
    hint: "Algo no funciona",
    icon: AlertTriangle,
  },
  {
    kind: "claim",
    label: "Reclamo",
    hint: "Queja de un cliente",
    icon: MessageSquareWarning,
  },
  {
    kind: "doubt",
    label: "Duda",
    hint: "Cómo usar la app",
    icon: CircleHelp,
  },
  {
    kind: "feedback",
    label: "Feedback",
    hint: "Una idea o comentario",
    icon: MessageSquareHeart,
  },
  {
    kind: "manual",
    label: "Manual",
    hint: "Pedir una guía",
    icon: BookOpen,
  },
];

/**
 * Cachico fijo en el borde: el tab no cambia de tamaño.
 * El panel flota a la izquierda con opacity/x (sin animar width/maxHeight,
 * que dejaba una franja rota al abrir/cerrar).
 */
export function SupportLauncher() {
  const router = useRouter();
  const productName = useProductName();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SupportInquiryKind>("doubt");
  const [formOpen, setFormOpen] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const root = rootRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      if (target && !root.contains(target)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  function clearLeave() {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }

  function handleEnter() {
    clearLeave();
    setOpen(true);
  }

  function handleLeave() {
    clearLeave();
    leaveTimer.current = setTimeout(() => setOpen(false), 140);
  }

  function openKind(next: SupportInquiryKind) {
    setKind(next);
    setOpen(false);
    setFormOpen(true);
  }

  return (
    <>
      <div
        ref={rootRef}
        className="fixed right-0 top-[max(0.5rem,env(safe-area-inset-top))] z-40"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div className="relative flex justify-end">
          <AnimatePresence>
            {open && (
              <motion.div
                key="support-panel"
                initial={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 0, x: 10, scale: 0.98 }
                }
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: 10, scale: 0.98 }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 32, mass: 0.5 }
                }
                className="absolute right-[1.1rem] top-0 z-10 w-[13.25rem] origin-top-right"
              >
                <div className="rounded-2xl rounded-tr-md border border-border/80 bg-background/95 p-1.5 shadow-lg backdrop-blur-md">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Soporte
                  </p>
                  {QUICK.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.kind}
                        type="button"
                        onClick={() => openKind(item.kind)}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-primary/10"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold leading-tight">
                            {item.label}
                          </span>
                          <span className="block text-[11px] leading-tight text-muted-foreground">
                            {item.kind === "doubt"
                              ? `Cómo usar ${productName}`
                              : item.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  <Link
                    href="/support"
                    onClick={() => setOpen(false)}
                    className="mt-0.5 flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <FolderKanban className="h-3.5 w-3.5" />
                    Ver tablero
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            aria-expanded={open}
            aria-label="Soporte"
            title="Soporte"
            onClick={() => {
              clearLeave();
              setOpen((v) => !v);
            }}
            className="relative z-20 flex h-10 w-[1.1rem] shrink-0 items-center justify-center rounded-l-md border border-r-0 border-border/80 bg-background/90 text-primary shadow-sm backdrop-blur-md"
          >
            <LifeBuoy className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <SupportCreateModal
        open={formOpen}
        initialKind={kind}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => {
          setFormOpen(false);
          router.push(`/support?id=${encodeURIComponent(id)}`);
        }}
      />
    </>
  );
}
