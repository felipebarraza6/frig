"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m, LazyMotion, domAnimation } from "framer-motion";
import { cn } from "@/lib/utils";

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

interface AnimatedOverlayProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  /** Classes for the outer overlay div */
  className?: string;
  /** Classes for the inner panel div */
  panelClassName?: string;
  /** z-index class, default "z-50" */
  zIndex?: string;
}

/** Devuelve (o crea) un div persistente en el body para montar portales.
 *  Usar un contenedor estable evita que React llame removeChild sobre un
 *  nodo que Turbopack ya reemplazó durante HMR. */
function getPortalRoot(id: string): HTMLElement {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Lightweight animated modal overlay.
 * Drop-in replacement for ad-hoc `fixed inset-0` modals.
 * Handles: fade-in overlay, slide-up panel, Escape to close, scroll lock.
 */
export function AnimatedOverlay({
  open,
  onClose,
  children,
  className,
  panelClassName,
  zIndex = "z-50",
}: AnimatedOverlayProps) {
  const [portalRoot] = useState<HTMLElement | null>(() =>
    typeof window !== "undefined" ? getPortalRoot("animated-overlay-root") : null
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Escape key
  useEffect(() => {
    if (!open || !onClose) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Foco inicial al abrir + restauración al cerrar
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (!panel) return;
    const first = getFocusable(panel)[0];
    if (first) {
      first.focus();
    } else {
      panel.setAttribute("tabindex", "-1");
      panel.focus();
    }
    return () => {
      const el = restoreFocusRef.current;
      restoreFocusRef.current = null;
      if (el && document.contains(el)) el.focus();
    };
  }, [open]);

  // Focus trap: Tab / Shift+Tab ciclan dentro del panel
  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = getFocusable(panel);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !panel.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !panel.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };

  // Scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!portalRoot) return null;

  return createPortal(
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {open && (
          <div
            className={cn("fixed inset-0", zIndex)}
            role="dialog"
            aria-modal="true"
          >
            {/* Overlay */}
            <m.div
              key="ao-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onClose}
              className={cn("absolute inset-0 bg-black/40", className)}
            />
            {/* Panel: los bottom sheets (items-end) suben su contenido por
                encima del home indicator gracias al safe-area. */}
            <m.div
              key="ao-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              ref={panelRef}
              onKeyDown={handlePanelKeyDown}
              className={cn(
                "relative z-10 h-full",
                panelClassName?.includes("items-end") && "pb-[env(safe-area-inset-bottom)]",
                panelClassName,
              )}
            >
              {children}
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>,
    portalRoot,
  );
}
