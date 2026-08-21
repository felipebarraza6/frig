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
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
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

  const routeItems: NavItem[] = [
    { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
    { href: "/sales", label: "Ventas", icon: ShoppingBag },
    ...(posEnabled ? [{ href: "/pos", label: "POS", icon: Receipt }] : []),
    ...(posEnabled ? [{ href: "/cash-register", label: "Caja", icon: Banknote }] : []),
  ];

  const visibleRoutes = routeItems.filter((item) => {
    if (!item.href) return true;
    if (isCashier) return isAllowed(item.href, cashierAllowedPaths);
    if (isWaiter) return isAllowed(item.href, waiterAllowedPaths);
    return true;
  });

  const items: NavItem[] = [
    ...visibleRoutes.slice(0, 4),
    { label: "Menú", icon: Menu, onClick: onMenuClick },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16 items-center justify-around px-1">
        {items.map((item, idx) => {
          const isActive = item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          const className = cn(
            "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
          );
          const content = (
            <>
              <item.icon className={cn("h-[22px] w-[22px]", isActive && "stroke-[2.5px]")} />
              <span className="max-w-full truncate px-1 text-[11px] font-medium leading-none">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute top-1 h-1 w-1 rounded-full bg-primary" />
              )}
            </>
          );

          if (item.href) {
            return (
              <Link key={item.label + idx} href={item.href} className={className}>
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.label + idx}
              type="button"
              onClick={item.onClick}
              className={className}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
