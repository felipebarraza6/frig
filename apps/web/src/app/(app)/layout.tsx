"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  useSessionStore,
  useIsCashier,
  useIsWaiter,
  useCashierAllowedPaths,
  useWaiterAllowedPaths,
  useBranchModulesState,
} from "@/lib/store/session";
import { useIsRouteModuleEnabled } from "@/lib/hooks/useRouteModuleAccess";
import { fetchFrontendConfig } from "@/lib/api/frontend-config";
import { useSidebarStore } from "@/lib/store/sidebar";
import { AppSidebar } from "@/components/app-sidebar/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MobileMenuSheet } from "@/components/mobile-menu-sheet";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { Toaster } from "@/components/ui/toaster";
import { ForbiddenListener } from "@/components/forbidden-listener";
import { enabledModuleSet, firstEnabledAllowedPath } from "@/lib/modules";

const HIDDEN_SIDEBAR_PATHS = ["/pos/terminal", "/kds/terminal", "/kds/monitor"];

function isAllowed(pathname: string, allowedPaths: string[]): boolean {
  return allowedPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const shouldHideSidebar = HIDDEN_SIDEBAR_PATHS.includes(pathname);
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const isCashier = useIsCashier();
  const isWaiter = useIsWaiter();
  const cashierAllowedPaths = useCashierAllowedPaths();
  const waiterAllowedPaths = useWaiterAllowedPaths();
  const sessionModules = useBranchModulesState();
  const enabledModules = useMemo(
    () => enabledModuleSet(sessionModules),
    [sessionModules]
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarExpanded = useSidebarStore((s) => s.expanded);
  const isRouteModuleEnabled = useIsRouteModuleEnabled(pathname);
  const setFrontendConfig = useSessionStore((s) => s.setFrontendConfig);

  // Re-sincroniza los módulos de la sesión con frontend-config al entrar a la
  // app. El store persiste `modules` en localStorage; sin este refresco quedan
  // stale si el backend cambió (por ejemplo, un toggle de módulo hecho en otra
  // ventana/dispositivo) y la UI seguiría mostrando secciones de módulos que ya
  // están desactivados (caso Nutrición en productos).
  //
  // IMPORTANTE: la dependencia usa `user?.id` (primitivo), no `user` (objeto).
  // `setFrontendConfig` reemplaza `user` con una referencia nueva en cada
  // respuesta; depender del objeto re-disparaba este efecto en un loop infinito
  // de GET /frontend-config. El ref además limita el refresco a una vez por
  // sucursal en cada sesión de navegación.
  const refreshedBranchRef = useRef<string | null>(null);
  const userId = user?.id;
  useEffect(() => {
    if (!hasHydrated || !userId || !currentBranchId) return;
    if (refreshedBranchRef.current === currentBranchId) return;
    refreshedBranchRef.current = currentBranchId;
    fetchFrontendConfig(Number(currentBranchId))
      .then((config) => setFrontendConfig(config, String(currentBranchId)))
      .catch((err) => {
        console.error("[layout] failed to refresh frontend-config:", err);
      });
  }, [hasHydrated, userId, currentBranchId, setFrontendConfig]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!currentBranchId) {
      router.replace("/select-branch");
      return;
    }

    // Roles operativos: si la ruta actual no está permitida para su rol,
    // los mandamos al primer path permitido cuyo módulo siga activo. Si
    // todos los paths habilitados cayeron (caso degenerado), caemos a
    // `/profile`, que es libre de módulo y siempre seguro.
    if (isCashier && !isAllowed(pathname, cashierAllowedPaths)) {
      const target =
        firstEnabledAllowedPath(cashierAllowedPaths, enabledModules) ?? "/profile";
      router.replace(target);
      return;
    }

    if (isWaiter && !isAllowed(pathname, waiterAllowedPaths)) {
      const target =
        firstEnabledAllowedPath(waiterAllowedPaths, enabledModules) ?? "/profile";
      router.replace(target);
      return;
    }

    // Cajero/mesero no necesitan ver el hub de estaciones; entran directo al terminal.
    if ((isCashier || isWaiter) && pathname === "/pos") {
      // Si por algún motivo el módulo POS quedó deshabilitado, los mandamos
      // a otra ruta operativa permitida antes que dejarlos en un hub que
      // no pueden usar.
      if (!enabledModules.has("pos")) {
        const fallback =
          (isCashier
            ? firstEnabledAllowedPath(cashierAllowedPaths, enabledModules)
            : firstEnabledAllowedPath(waiterAllowedPaths, enabledModules)) ?? "/profile";
        router.replace(fallback);
        return;
      }
      router.replace("/pos/terminal");
      return;
    }

    // Rutas no operativas: si el módulo de la ruta está deshabilitado,
    // redirigir a /dashboard (always-on y siempre disponible para admins).
    // Para roles operativos este chequeo ya pasó arriba; no llega acá.
    if (!isRouteModuleEnabled && pathname !== "/dashboard") {
      router.replace("/dashboard");
    }
  }, [
    hasHydrated,
    user,
    currentBranchId,
    pathname,
    router,
    isCashier,
    isWaiter,
    cashierAllowedPaths,
    waiterAllowedPaths,
    isRouteModuleEnabled,
    enabledModules,
  ]);

  if (!hasHydrated || !user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <RealtimeProvider>
      <ForbiddenListener />
      <div className="flex min-h-full">
        {!shouldHideSidebar && (
          <>
            <div className="hidden md:block">
              <AppSidebar />
            </div>
            <MobileMenuSheet open={mobileOpen} onClose={() => setMobileOpen(false)} />
          </>
        )}

        <main
          className={cn(
            "flex min-h-full flex-1 flex-col min-w-0",
            !shouldHideSidebar && [
              // El pin reserva espacio; el hover expande como overlay sin mover el layout.
              sidebarExpanded ? "md:ml-60" : "md:ml-16",
              "pb-24 md:pb-0",
            ]
          )}
        >
          {children}
        </main>

        {!shouldHideSidebar && <MobileBottomNav onMenuClick={() => setMobileOpen(true)} />}
        <Toaster />
      </div>
    </RealtimeProvider>
  );
}
