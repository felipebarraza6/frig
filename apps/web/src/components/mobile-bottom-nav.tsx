"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Receipt,
  Banknote,
  ShoppingBag,
  Menu,
  type LucideIcon,
} from "lucide-react";
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
  icon: LucideIcon;
  badge?: number;
  description?: string;
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
    { href: "/sales", label: "Ventas", icon: ShoppingBag, description: "Ventas y cuentas abiertas" },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="mx-3 mb-3 flex items-center justify-around rounded-2xl border border-border/60 bg-background/85 px-2 py-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl">
        {items.map((item) => {
          const isActive =
            item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          const isMenu = !item.href;

          const content = (
            <div
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
                isMenu && "text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-nav-pill"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <div className="relative">
                <item.icon
                  className="relative z-10 h-[22px] w-[22px]"
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow-sm"
                  >
                    {item.badge > 9 ? "9+" : item.badge}
                  </motion.span>
                )}
              </div>
              <span
                className={cn(
                  "relative z-10 max-w-full truncate px-0.5 text-[11px] font-medium leading-none",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </div>
          );

          if (item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className="relative flex min-w-0 flex-1 flex-col items-stretch justify-center"
                aria-label={item.label}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="relative flex min-w-0 flex-1 flex-col items-stretch justify-center"
              aria-label={item.label}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
