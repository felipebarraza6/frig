"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  LifeBuoy,
  CircleHelp,
  AlertTriangle,
  MessageSquareHeart,
  BookOpen,
  FolderKanban,
  MessageSquareWarning,
  X,
  MessageSquarePlus,
} from "lucide-react";
import { SupportCreateModal } from "@/components/support/support-create-modal";
import type { SupportInquiryKind } from "@/lib/api/support";
import { useProductName } from "@/lib/product-name";
import { SUPPORT_FEEDBACK_LABEL, SUPPORT_PATH } from "@/lib/support-access";
import { cn } from "@/lib/utils";

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
 * Acceso global a crear tickets / feedback.
 *
 * Antes era una tira de ~17px en el borde (casi invisible). Ahora:
 * - Desktop: chip fijo a la derecha con texto "Soporte".
 * - Móvil: FAB sobre el dock inferior con etiqueta clara.
 *
 * No se oculta por módulo, plan ni rol: cualquier usuario autenticado lo ve
 * (el layout solo lo monta dentro de la app autenticada).
 */
export function SupportLauncher() {
  const router = useRouter();
  const pathname = usePathname();
  const productName = useProductName();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SupportInquiryKind>("doubt");
  const [formOpen, setFormOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // En terminales densas el FAB estorba; el hub /support sigue disponible.
  const hideOnDense =
    pathname.startsWith("/pos/terminal") ||
    pathname.startsWith("/kds/terminal") ||
    pathname.startsWith("/kds/monitor") ||
    pathname.startsWith("/tables/map/full");

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const root = rootRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      if (target && !root.contains(target)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openKind(next: SupportInquiryKind) {
    setKind(next);
    setOpen(false);
    setFormOpen(true);
  }

  if (hideOnDense) return null;

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          "fixed z-40 flex flex-col items-end gap-2",
          // Móvil: sobre el dock (pb-24 del main). Desktop: centro-derecha.
          "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3",
          "md:bottom-auto md:right-3 md:top-1/2 md:-translate-y-1/2",
        )}
      >
        <AnimatePresence>
          {open && (
            <motion.div
              key="support-panel"
              role="dialog"
              aria-label={SUPPORT_FEEDBACK_LABEL}
              initial={
                reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 420, damping: 32, mass: 0.5 }
              }
              className="w-[min(18rem,calc(100vw-1.5rem))] origin-bottom-right md:origin-right"
            >
              <div className="rounded-2xl border border-border/80 bg-background/95 p-1.5 shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {SUPPORT_FEEDBACK_LABEL}
                  </p>
                  <button
                    type="button"
                    aria-label="Cerrar"
                    onClick={() => setOpen(false)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {QUICK.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.kind}
                      type="button"
                      onClick={() => openKind(item.kind)}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-primary/10"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
                  href={SUPPORT_PATH}
                  onClick={() => setOpen(false)}
                  className="mt-0.5 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <FolderKanban className="h-3.5 w-3.5" />
                  Ver tablero de casos
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          aria-expanded={open}
          aria-label={SUPPORT_FEEDBACK_LABEL}
          title={SUPPORT_FEEDBACK_LABEL}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex items-center gap-2 rounded-full border border-primary/30 bg-background/95 px-3.5 py-2.5 text-sm font-semibold text-primary shadow-lg backdrop-blur-md",
            "hover:bg-primary hover:text-primary-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "touch-manipulation",
            open && "bg-primary text-primary-foreground",
          )}
        >
          {open ? (
            <X className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          ) : (
            <MessageSquarePlus className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          )}
          <span className="max-w-[11rem] truncate">
            <span className="md:hidden">Soporte</span>
            <span className="hidden md:inline">{SUPPORT_FEEDBACK_LABEL}</span>
          </span>
          <LifeBuoy className="hidden h-3.5 w-3.5 shrink-0 opacity-80 sm:block" />
        </button>
      </div>

      <SupportCreateModal
        open={formOpen}
        initialKind={kind}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => {
          setFormOpen(false);
          router.push(`${SUPPORT_PATH}?id=${encodeURIComponent(id)}`);
        }}
      />
    </>
  );
}
