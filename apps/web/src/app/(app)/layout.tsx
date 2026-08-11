"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  RotateCcw,
  LogOut,
  Package,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { branchName } from "@/lib/types";
import { useSessionStore, useCurrentBranch } from "@/lib/store/session";
import { logout } from "@/lib/api/auth";
import { clearToken } from "@/lib/api/session-storage";
import { BrandLogo } from "@/components/brand-logo";

const NAV = [
  { href: "/pos", label: "POS", icon: Receipt },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/kds", label: "Cocina", icon: RotateCcw },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const clearSession = useSessionStore((s) => s.clearSession);
  const theme = useSessionStore((s) => s.theme);
  const branch = useCurrentBranch();
  const appName = theme?.app_name ?? "FRIG";

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) router.replace("/login");
    else if (!currentBranchId) router.replace("/select-branch");
  }, [hasHydrated, user, currentBranchId, router]);

  if (!hasHydrated || !user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // ignora errores de red en logout; se limpia sesión local igual
    }
    clearToken();
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-full">
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-border bg-card">
        <div className="flex items-center gap-2 px-4 py-4">
          <BrandLogo src={theme?.logo} alt={appName} containerClassName="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{appName}</p>
            {branch && (
              <p className="truncate text-xs text-muted-foreground">{branchName(branch)}</p>
            )}
          </div>
        </div>

        <nav className="mt-2 flex flex-col gap-1 px-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color] duration-150",
                  active
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-border p-2">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user?.first_name ?? user?.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Cambiar sucursal
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-[background-color,color] duration-150 hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="ml-56 flex min-h-full flex-1 flex-col">{children}</main>
    </div>
  );
}