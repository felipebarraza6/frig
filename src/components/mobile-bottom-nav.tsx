"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  LineChart,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useIsCashier,
  useIsWaiter,
  useCashierAllowedPaths,
  useWaiterAllowedPaths,
  useSessionStore,
} from "@/lib/store/session";
import { useFrigMenu } from "@/lib/hooks/useFrigMenu";
import { useNavFavorites } from "@/lib/store/nav-favorites";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  description?: string;
}

interface MobileBottomNavProps {
  onMenuClick: () => void;
}

function isAllowed(pathname: string, allowedPaths: string[]): boolean {
  return allowedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const BOTTOM_NAV_SLOTS = 4;

export function MobileBottomNav({ onMenuClick }: MobileBottomNavProps) {
  const pathname = usePathname();
  const isCashier = useIsCashier();
  const isWaiter = useIsWaiter();
  const cashierAllowedPaths = useCashierAllowedPaths();
  const waiterAllowedPaths = useWaiterAllowedPaths();
  const menuGroups = useFrigMenu();
  const { favorites } = useNavFavorites();

  const allMenuItems = useMemo(
    () => menuGroups.flatMap((g) => g.items),
    [menuGroups],
  );

  const visibleMenuItems = useMemo(() => {
    return allMenuItems.filter((item) => {
      if (isCashier) return isAllowed(item.href, cashierAllowedPaths);
      if (isWaiter) return isAllowed(item.href, waiterAllowedPaths);
      return true;
    });
  }, [allMenuItems, isCashier, isWaiter, cashierAllowedPaths, waiterAllowedPaths]);

  const navItems = useMemo<NavItem[]>(() => {
    // Favoritos que existan en el menú visible y estén permitidos.
    const starred = favorites
      .map((href) => visibleMenuItems.find((i) => i.href === href))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => {
        const icon = item.href === "/dashboard" ? LineChart : item.icon;
        return { ...item, icon, badge: item.badge };
      }) as NavItem[];

    // Si el usuario definió favoritos, se muestran SOLO esos (sin mezclar con defaults).
    if (starred.length > 0) return starred.slice(0, BOTTOM_NAV_SLOTS);

    const preferred = ["/dashboard", "/sales", "/pos", "/cash-register", "/tables", "/customers"];
    const defaults: NavItem[] = preferred
      .map((href) => visibleMenuItems.find((i) => i.href === href))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => {
        // Dashboard siempre usa LineChart (gráfico de barras) como ícono convencional
        const icon = item.href === "/dashboard" ? LineChart : item.icon;
        return { href: item.href, label: item.label, icon, badge: item.badge, description: item.description };
      });

    return defaults.slice(0, BOTTOM_NAV_SLOTS);
  }, [visibleMenuItems, favorites]);

  const items: (NavItem & { onClick?: () => void })[] = [
    ...navItems,
    { href: "", label: "Menú", icon: LayoutGrid, onClick: onMenuClick },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none">
      <div
        className="mx-3 flex items-center justify-around rounded-2xl border-2 border-primary/30 bg-card px-1.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.15)] pointer-events-auto min-h-[58px]"
      >
        {items.map((item) => {
          const isActive =
            item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          const isMenu = !item.href;

          const content = (
            <div
              className={cn(
                "relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 transition-all touch-manipulation active:scale-[0.93]",
                isActive ? "text-white font-semibold" : "text-foreground/60",
                isMenu && "text-foreground font-medium",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-nav-pill"
                  className="absolute inset-0 rounded-xl bg-primary shadow-md"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <div className="relative">
                {isMenu ? (
                  <LayoutGrid
                    className="relative z-10 h-[22px] w-[22px]"
                    strokeWidth={1.8}
                  />
                ) : (
                  <item.icon
                    className="relative z-10 h-[22px] w-[22px]"
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                )}
                {typeof item.badge === "number" && item.badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow-xs"
                  >
                    {item.badge > 9 ? "9+" : item.badge}
                  </motion.span>
                )}
              </div>
              {isActive && (
                <span className="relative z-10 max-w-full truncate px-0.5 text-[10.5px] font-semibold leading-tight text-white">
                  {item.label}
                </span>
              )}
            </div>
          );

          if (item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className="relative flex min-w-0 flex-1 flex-col items-stretch justify-center select-none"
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
              className="relative flex min-w-0 flex-1 flex-col items-stretch justify-center select-none"
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
