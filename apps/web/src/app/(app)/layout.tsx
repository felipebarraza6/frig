"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  useSessionStore,
  useIsCashier,
  useIsWaiter,
  useCashierAllowedPaths,
  useWaiterAllowedPaths,
} from "@/lib/store/session";
import { useSidebarStore } from "@/lib/store/sidebar";
import { useIsRouteModuleEnabled } from "@/lib/hooks/useRouteModuleAccess";
import { AppSidebar } from "@/components/app-sidebar/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MobileMenuSheet } from "@/components/mobile-menu-sheet";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { Toaster } from "@/components/ui/toaster";
import { ForbiddenListener } from "@/components/forbidden-listener";

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
  const sidebarExpanded = useSidebarStore((s) => s.expanded);
  const sidebarHovering = useSidebarStore((s) => s.hovering);
  const effectivelyExpanded = sidebarExpanded || sidebarHovering;
  const [mobileOpen, setMobileOpen] = useState(false);
  const isRouteModuleEnabled = useIsRouteModuleEnabled(pathname);

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

    if (isCashier && !isAllowed(pathname, cashierAllowedPaths)) {
      router.replace("/pos/terminal");
      return;
    }

    if (isWaiter && !isAllowed(pathname, waiterAllowedPaths)) {
      router.replace("/pos/terminal");
      return;
    }

    // Cajero/mesero no necesitan ver el hub de estaciones; entran directo al terminal.
    if ((isCashier || isWaiter) && pathname === "/pos") {
      router.replace("/pos/terminal");
      return;
    }

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
            "flex min-h-full flex-1 flex-col",
            !shouldHideSidebar && [
              effectivelyExpanded ? "md:ml-60" : "md:ml-16",
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
