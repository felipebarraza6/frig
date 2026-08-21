"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, Banknote, ShoppingBag, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useIsCashier,
  useIsWaiter,
  useCashierAllowedPaths,
  useWaiterAllowedPaths,
  useIsModuleEnabledFromConfig,
} from "@/lib/store/session";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MobileBottomNavProps {
  onMenuClick: () => void;
}

function isAllowed(pathname: string, allowedPaths: string[]): boolean {
  return allowedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function MobileBottomNav({ onMenuClick }: MobileBottomNavProps) {
  const pathname = usePathname();
  const isCashier = useIsCashier();
  const isWaiter = useIsWaiter();
  const cashierAllowedPaths = useCashierAllowedPaths();
  const waiterAllowedPaths = useWaiterAllowedPaths();
  const posEnabled = useIsModuleEnabledFromConfig("pos");

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(posEnabled ? [{ href: "/pos", label: "POS", icon: Receipt }] : []),
    ...(posEnabled ? [{ href: "/cash-register", label: "Caja", icon: Banknote }] : []),
    { href: "/sales", label: "Ventas", icon: ShoppingBag },
  ];

  const visibleItems = items.filter((item) => {
    if (isCashier) return isAllowed(item.href, cashierAllowedPaths);
    if (isWaiter) return isAllowed(item.href, waiterAllowedPaths);
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16 items-center">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Menú</span>
        </button>
      </div>
    </nav>
  );
}
