"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, ViewTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  useSessionStore,
  useIsCashier,
  useIsWaiter,
  useIsCook,
  useCashierAllowedPaths,
  useWaiterAllowedPaths,
  useCookAllowedPaths,
  useBranchModulesState,
  useIsSuperAdmin,
} from "@/lib/store/session";
import { useIsRouteModuleEnabled } from "@/lib/hooks/useRouteModuleAccess";
import { useSubscriptionLock } from "@/lib/hooks/useSubscriptionLock";
import { isSubscriptionLockAllowedPath } from "@/lib/subscription";
import { fetchFrontendConfig } from "@/lib/api/frontend-config";
import { activateBranch, pickDefaultBranchId } from "@/lib/branch-session";
import { useSidebarStore } from "@/lib/store/sidebar";
import { AppSidebar } from "@/components/app-sidebar/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MobileMenuSheet } from "@/components/mobile-menu-sheet";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { Toaster } from "@/components/ui/toaster";
import { SupportLauncher } from "@/components/support/support-launcher";
import { ProductIdentity } from "@/components/product-identity";
import { ForbiddenListener } from "@/components/forbidden-listener";
import { HeroPlexus } from "@/components/landing/hero-plexus";
import { enabledModuleSet, firstEnabledAllowedPath } from "@/lib/modules";
import { SUPERADMIN_ALLOWED_PATHS as SUPERADMIN_MENU_PATHS } from "@/lib/hooks/useFrigMenu";
import { useToastStore } from "@/lib/store/toast";
import { ApiError } from "@/lib/api/client";

const HIDDEN_SIDEBAR_PATHS = ["/pos/terminal", "/kds/terminal", "/kds/monitor", "/tables/map/full"];

/** Tras un 5xx de frontend-config, no martillar el API: reintento mínimo. */
const FRONTEND_CONFIG_RETRY_MS = 30_000;

/**
 * Rutas operativas donde la capa cósmica NO se renderiza: en caja la
 * experiencia es densa y la animación en los huecos del layout estorba.
 */
/**
 * Rutas sin capa cósmica (HeroPlexus): terminales densas donde la animación
 * estorba. Caja sí la mantiene — forma parte de la atmósfera del módulo.
 */
const NO_COSMOS_PATHS = ["/pos/terminal", "/kds/terminal", "/kds/monitor"];

/**
 * Rutas permitidas para el super admin (menú + rutas neutrales como profile/dashboard).
 * El superadmin administra organizaciones y sucursales, no opera.
 */
const SUPERADMIN_ALLOWED_PATHS = new Set<string>([
  ...SUPERADMIN_MENU_PATHS,
  "/profile",
  "/dashboard",
  "/support",
  "/help",
]);

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
  const isCook = useIsCook();
  const isSuperAdmin = useIsSuperAdmin();
  const cashierAllowedPaths = useCashierAllowedPaths();
  const waiterAllowedPaths = useWaiterAllowedPaths();
  const cookAllowedPaths = useCookAllowedPaths();
  const sessionModules = useBranchModulesState();
  const enabledModules = useMemo(
    () => enabledModuleSet(sessionModules),
    [sessionModules]
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarExpanded = useSidebarStore((s) => s.expanded);
  const isRouteModuleEnabled = useIsRouteModuleEnabled(pathname);
  const { locked: subscriptionLocked } = useSubscriptionLock();
  const setFrontendConfig = useSessionStore((s) => s.setFrontendConfig);
  const branches = useSessionStore((s) => s.branches);
  const queryClient = useQueryClient();
  // Evita disparar la auto-selección dos veces (StrictMode re-ejecuta effects).
  const activatingBranchRef = useRef(false);

  // Re-sincroniza los módulos de la sesión con frontend-config al entrar a la
  // app. El store persiste `modules` en localStorage; sin este refresco quedan
  // stale si el backend cambió (por ejemplo, un toggle de módulo hecho en otra
  // ventana/dispositivo) y la UI seguiría mostrando secciones de módulos que ya
  // están desactivados (caso Nutrición en productos).
  //
  // IMPORTANTE: la dependencia usa `user?.id` (primitivo), no `user` (objeto).
  // `setFrontendConfig` reemplaza `user` con una referencia nueva en cada
  // respuesta; depender del objeto re-disparaba este efecto en un loop infinito
  // de GET /frontend-config.
  //
  // Tras un 5xx no reintentamos en cada remount (martillaba Postgres cuando
  // estaba sin cupo de conexiones). Marcamos el fallo y reintentamos a los
  // FRONTEND_CONFIG_RETRY_MS o al cambiar de sucursal.
  // inFlight evita doble fetch de StrictMode (toast/console duplicados).
  const refreshedBranchRef = useRef<string | null>(null);
  const failedBranchRef = useRef<{ branchId: string; at: number; toasted?: boolean } | null>(null);
  const inFlightBranchRef = useRef<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);
  const userId = user?.id;
  useEffect(() => {
    if (!hasHydrated || !userId || !currentBranchId) return;
    if (refreshedBranchRef.current === currentBranchId) return;
    if (inFlightBranchRef.current === currentBranchId) return;
    const failed = failedBranchRef.current;
    if (
      failed &&
      failed.branchId === currentBranchId &&
      Date.now() - failed.at < FRONTEND_CONFIG_RETRY_MS
    ) {
      return;
    }
    const branchIdNum = Number(currentBranchId);
    if (!Number.isFinite(branchIdNum) || branchIdNum <= 0) {
      console.warn("[layout] frontend-config: branch_id inválido:", currentBranchId);
      return;
    }
    let cancelled = false;
    inFlightBranchRef.current = currentBranchId;
    fetchFrontendConfig(branchIdNum)
      .then((config) => {
        if (cancelled) return;
        refreshedBranchRef.current = currentBranchId;
        failedBranchRef.current = null;
        setFrontendConfig(config, String(currentBranchId));
      })
      .catch((err) => {
        if (cancelled) return;
        const prev = failedBranchRef.current;
        const alreadyToasted =
          prev?.branchId === currentBranchId &&
          prev.toasted &&
          Date.now() - prev.at < FRONTEND_CONFIG_RETRY_MS;
        failedBranchRef.current = {
          branchId: currentBranchId,
          at: Date.now(),
          toasted: true,
        };
        const status = err instanceof ApiError ? err.status : undefined;
        // Un solo log por ventana de fallo (StrictMode / remounts).
        if (!alreadyToasted) {
          console.warn(
            "[layout] frontend-config no disponible:",
            status ? `HTTP ${status}` : err instanceof Error ? err.message : err,
          );
        }
        if (!alreadyToasted && status !== 401) {
          addToast({
            message:
              status && status >= 500
                ? "El servidor está saturado. Espera unos segundos y recarga."
                : err instanceof Error
                  ? err.message
                  : "No se pudo actualizar la configuración de la sucursal.",
            variant: "error",
          });
        }
      })
      .finally(() => {
        if (inFlightBranchRef.current === currentBranchId) {
          inFlightBranchRef.current = null;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasHydrated, userId, currentBranchId, setFrontendConfig, addToast]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!currentBranchId) {
      // Sin sucursal activa (login fresco o sesión sin branch): se activa la
      // por defecto en silencio. No hay pantalla bloqueante; el cambio de
      // sucursal dentro de la app lo hace el switcher del sidebar.
      const target = pickDefaultBranchId(user, branches);
      if (target && !activatingBranchRef.current) {
        activatingBranchRef.current = true;
        activateBranch(target, queryClient).catch((err) => {
          console.error("[layout] failed to activate default branch:", err);
        });
      }
      return;
    }

    // Sin plan activo en la sucursal: solo perfil/suscripción (superadmin exento).
    if (subscriptionLocked && !isSubscriptionLockAllowedPath(pathname)) {
      router.replace("/profile");
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

    if (isCook && !isAllowed(pathname, cookAllowedPaths)) {
      const target =
        firstEnabledAllowedPath(cookAllowedPaths, enabledModules) ?? "/profile";
      router.replace(target);
      return;
    }

    // Superadmin: solo administra organizaciones/sucursales, no opera.
    // Si intenta acceder a una ruta operativa, redirigir a /organization.
    if (
      isSuperAdmin &&
      !isAllowed(pathname, [...SUPERADMIN_ALLOWED_PATHS])
    ) {
      router.replace("/organization");
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

    // Cocinero: si production/KDS está apagado, fuera del hub; si no, se queda en /kds.
    if (isCook && pathname.startsWith("/kds") && !enabledModules.has("production")) {
      router.replace("/profile");
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
    isCook,
    isSuperAdmin,
    cashierAllowedPaths,
    waiterAllowedPaths,
    cookAllowedPaths,
    isRouteModuleEnabled,
    enabledModules,
    branches,
    queryClient,
    subscriptionLocked,
  ]);

  if (!hasHydrated || !user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  // Fail-closed solo en el contenido de `main`. El chrome (sidebar + dock
  // inferior) permanece montado para que el nav móvil no parpadee al cambiar
  // de ruta / mientras carga el candado de suscripción.
  const blockPageContent =
    (!isRouteModuleEnabled && pathname !== "/dashboard" && !subscriptionLocked) ||
    (isSuperAdmin && !isAllowed(pathname, [...SUPERADMIN_ALLOWED_PATHS])) ||
    (subscriptionLocked && !isSubscriptionLockAllowedPath(pathname));

  const showChrome = !shouldHideSidebar;

  return (
    <RealtimeProvider>
      <ProductIdentity />
      <ForbiddenListener />
      <div className="relative flex min-h-full">
        {/* Misma muralla de datos en todos los módulos (Ayuda incluida).
            z-0 sobre el body, debajo del contenido; main es transparente. */}
        {showChrome && !NO_COSMOS_PATHS.some((p) => pathname.startsWith(p)) && (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-0 hidden opacity-45 md:block"
          >
            <HeroPlexus className="h-full w-full" />
          </div>
        )}
        {showChrome && (
          <>
            <div className="hidden md:block">
              <AppSidebar />
            </div>
            <MobileMenuSheet open={mobileOpen} onClose={() => setMobileOpen(false)} />
          </>
        )}

        <main
          className={cn(
            "relative z-[1] flex min-h-full min-w-0 flex-1 flex-col overscroll-y-contain bg-transparent",
            showChrome && [
              // El pin reserva espacio; el hover expande como overlay sin mover el layout.
              sidebarExpanded ? "md:ml-60" : "md:ml-16",
              // Safe area superior (notch PWA) + espacio para el dock inferior.
              "pt-[env(safe-area-inset-top)] pb-24 md:pt-0 md:pb-0",
              // Transición para que el contenido acompañe el ancho del sidebar
              // sin saltos al fijar/soltar el pin.
              "transition-[margin] duration-300 ease-out",
            ],
          )}
        >
          {blockPageContent ? (
            <div className="flex flex-1 items-center justify-center bg-background">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : shouldHideSidebar ? (
            children
          ) : (
            // Crossfade solo del contenido; el dock inferior queda fuera.
            <ViewTransition default="none" update="nav-fade">
              {children}
            </ViewTransition>
          )}
        </main>

        {/* Dock global inmutable: no se desmonta al abrir el menú ni al
            cambiar de página (el sheet cubre por encima). */}
        {showChrome && (
          <MobileBottomNav onMenuClick={() => setMobileOpen(true)} />
        )}
        <SupportLauncher />
        <Toaster />
      </div>
    </RealtimeProvider>
  );
}
