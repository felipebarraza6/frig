"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m, LazyMotion, domAnimation } from "framer-motion";
import { ArrowRightLeft, Check, Loader2, MapPin, Search, X } from "lucide-react";
import { useSessionStore, useCurrentBranch } from "@/lib/store/session";
import { activateBranch } from "@/lib/branch-session";
import { BrandLogo } from "@/components/brand-logo";
import { branchName } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Branch } from "@/lib/types";

interface BranchSwitcherModalProps {
  open: boolean;
  onClose: () => void;
}

function planLabel(b: Branch): string | null {
  if (!b.plan_name) return null;
  const expiry = b.plan_expiration_date ? ` · vence ${b.plan_expiration_date.slice(0, 10).split("-").reverse().join("-")}` : "";
  return `${b.plan_name}${expiry}`;
}

function branchMeta(b: Branch): string {
  return [b.address, b.commune].filter(Boolean).join(", ");
}

/**
 * Selector de sucursal a pantalla completa (bloquea la app) con búsqueda y
 * tarjetas con información de cada sucursal: dirección, plan y rol. Estilo
 * ventana flotante, como la paleta de comandos (⌘K).
 */
export function BranchSwitcherModal({ open, onClose }: BranchSwitcherModalProps) {
  const queryClient = useQueryClient();
  const branches = useSessionStore((s) => s.branches);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const current = useCurrentBranch();
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) setQuery("");
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) =>
      [branchName(b), b.address, b.commune, b.plan_name, b.role_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [branches, query]);

  async function handleSelect(branchId: string) {
    if (branchId === currentBranchId || pendingId) return;
    setPendingId(branchId);
    try {
      await activateBranch(branchId, queryClient);
      onClose();
    } catch {
      // Si la activación falla, la sucursal activa queda como estaba.
    } finally {
      setPendingId(null);
    }
  }

  if (typeof window === "undefined") return null;

  return createPortal(
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
            role="dialog"
            aria-modal="true"
            aria-label="Cambiar sucursal"
          >
            <m.div
              key="bs-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <m.div
              key="bs-panel"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-white/30 bg-card/90 shadow-2xl shadow-primary/25 backdrop-blur-2xl dark:border-white/10"
            >
              <div className="flex items-center gap-2.5 px-4 py-3.5">
                <ArrowRightLeft className="h-4 w-4 shrink-0 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Cambiar sucursal</h2>
                {current && (
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    Ahora en <span className="font-medium">{branchName(current)}</span>
                  </p>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {branches.length > 4 && (
                <>
                  <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    <Search className="h-4 w-4 shrink-0 text-primary" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar por nombre, comuna o plan…"
                      className="h-7 flex-1 bg-transparent text-sm text-foreground caret-primary outline-none placeholder:text-muted-foreground/60"
                      autoFocus
                    />
                  </div>
                </>
              )}

              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <div className="max-h-[55vh] overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      Ninguna sucursal coincide con la búsqueda
                    </p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {filtered.map((b) => {
                      const id = String(b.branch_id);
                      const active = id === currentBranchId;
                      const pending = pendingId === id;
                      const meta = branchMeta(b);
                      const plan = planLabel(b);
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => handleSelect(id)}
                            disabled={pending || (active && !pending)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                              active
                                ? "border-primary/60 bg-primary/5"
                                : "border-transparent hover:border-primary/40 hover:bg-muted/60",
                              (pending || active) && "cursor-default",
                            )}
                          >
                            <BrandLogo
                              src={b.logo ?? b.theme_config?.logo ?? null}
                              name={branchName(b)}
                              fallbackColor={b.theme_config?.primary_color}
                              containerClassName="h-10 w-10 shrink-0 rounded-lg"
                              className="max-h-9 max-w-9 p-1"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-foreground">
                                  {branchName(b)}
                                </span>
                                {b.role_name && (
                                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    {b.role_name}
                                  </span>
                                )}
                              </span>
                              {(meta || plan) && (
                                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                                  {meta && (
                                    <span className="inline-flex min-w-0 items-center gap-1">
                                      <MapPin className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{meta}</span>
                                    </span>
                                  )}
                                  {plan && <span className="shrink-0">{plan}</span>}
                                </span>
                              )}
                            </span>
                            {pending ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                            ) : active ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                <Check className="h-3 w-3" />
                                Activa
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="border-t border-border/60 px-4 py-2">
                <p className="text-[11px] text-muted-foreground">
                  Todo lo que hagas en la app queda en la sucursal elegida: ventas, caja,
                  inventario y reportes. <kbd className="rounded border border-border bg-muted/50 px-1 font-mono text-[10px]">esc</kbd> para cerrar.
                </p>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>,
    document.body,
  );
}
