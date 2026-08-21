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

function NavButton({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-2 py-2 transition-colors",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
      <span className="text-[10px] font-medium leading-none">{item.label}</span>
    </Link>
  );
}

export function MobileBottomNav({ onMenuClick }: MobileBottomNavProps) {
  const pathname = usePathname();
  const isCashier = useIsCashier();
  const isWaiter = useIsWaiter();
  const cashierAllowedPaths = useCashierAllowedPaths();
  const waiterAllowedPaths = useWaiterAllowedPaths();
  const posEnabled = useIsModuleEnabledFromConfig("pos");

  const leftItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/sales", label: "Ventas", icon: ShoppingBag },
  ];

  const rightItems: NavItem[] = [
    ...(posEnabled ? [{ href: "/pos", label: "POS", icon: Receipt }] : []),
    ...(posEnabled ? [{ href: "/cash-register", label: "Caja", icon: Banknote }] : []),
  ];

  const filterByRole = (item: NavItem) => {
    if (isCashier) return isAllowed(item.href, cashierAllowedPaths);
    if (isWaiter) return isAllowed(item.href, waiterAllowedPaths);
    return true;
  };

  const visibleLeft = leftItems.filter(filterByRole);
  const visibleRight = rightItems.filter(filterByRole);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-20 items-end px-2 pb-2">
        <div className="flex flex-1 items-end justify-around">
          {visibleLeft.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <NavButton key={item.href} item={item} isActive={isActive} />;
          })}
        </div>

        <button
          type="button"
          onClick={onMenuClick}
          className="relative -top-3 mx-2 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="flex flex-1 items-end justify-around">
          {visibleRight.length > 0 ? (
            visibleRight.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return <NavButton key={item.href} item={item} isActive={isActive} />;
            })
          ) : (
            <span className="w-10" />
          )}
        </div>
      </div>
    </nav>
  );
}
