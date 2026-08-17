"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSessionStore,
  useIsCashier,
  useIsWaiter,
  useCashierAllowedPaths,
  useWaiterAllowedPaths,
} from "@/lib/store/session";
import { useSidebarStore } from "@/lib/store/sidebar";
import { useIsRouteModuleEnabled } from "@/lib/hooks/useBranchModules";
import { AppSidebar } from "@/components/app-sidebar/app-sidebar";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { useState } from "react";

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
      <div className="flex min-h-full">
        {!shouldHideSidebar && (
          <>
            <div className="hidden md:block">
              <AppSidebar />
            </div>
            {mobileOpen && (
              <div className="fixed inset-0 z-50 md:hidden">
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setMobileOpen(false)}
                />
                <div className="absolute left-0 top-0 h-full w-60 bg-card shadow-2xl">
                  <AppSidebar onNavigate={() => setMobileOpen(false)} forceExpanded />
                </div>
              </div>
            )}
          </>
        )}

        <main
          className={cn(
            "flex min-h-full flex-1 flex-col",
            !shouldHideSidebar && (effectivelyExpanded ? "md:ml-60" : "md:ml-16")
          )}
        >
          {!shouldHideSidebar && (
            <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-2 backdrop-blur md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menú"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </header>
          )}
          {children}
        </main>
        <Toaster />
      </div>
    </RealtimeProvider>
  );
}
