"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfilePanel } from "@/components/profile/profile-panel";
import { logout } from "@/lib/api/auth";
import { clearToken } from "@/lib/api/session-storage";
import { useSessionStore } from "@/lib/store/session";

/**
 * Botón de perfil del usuario para el header del terminal POS.
 * Abre un diálogo con el mismo panel de /profile (datos, sucursales y
 * seguridad) y el cierre de sesión, para que en equipos compartidos el
 * turno del cajero no quede autenticado al cerrar.
 */
export function PosProfileButton() {
  const [open, setOpen] = useState(false);
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);
  const queryClient = useQueryClient();
  const router = useRouter();

  const displayName =
    user?.full_name?.trim() ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    user?.email ||
    "Usuario";
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // ignora errores de red en logout
    }
    clearToken();
    clearSession();
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={displayName}
        aria-label="Perfil"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
          {initial}
        </span>
        <span className="hidden max-w-24 truncate lg:inline">{displayName}</span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Perfil"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
                <p className="text-sm font-semibold">Mi perfil</p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                  >
                    <LogOut className="mr-1.5 h-3.5 w-3.5" />
                    Cerrar sesión
                  </Button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar"
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <ProfilePanel />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
