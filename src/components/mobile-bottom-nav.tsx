"use client";

import Link from "next/link";
import { memo, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { LayoutGrid, LineChart, CreditCard, LifeBuoy, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useIsCashier,
  useIsWaiter,
  useIsCook,
  useCashierAllowedPaths,
  useWaiterAllowedPaths,
  useCookAllowedPaths,
  useCanManageCustomers,
} from "@/lib/store/session";
import { useFrigMenu } from "@/lib/hooks/useFrigMenu";
import { useNavFavorites } from "@/lib/store/nav-favorites";
import { useSubscriptionLock } from "@/lib/hooks/useSubscriptionLock";
import {
  BOTTOM_NAV_SLOTS,
  defaultBottomNavHrefs,
  filterNavItemsByRole,
  type NavRoleFilter,
} from "@/lib/nav-access";

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

/**
 * Dock inferior global. Debe permanecer montado entre rutas: el layout no lo
 * desmonta al navegar. Los ítems se estabilizan para no recrear el DOM en cada
 * render (keys por href, pill con layoutId fijo).
 */
export const MobileBottomNav = memo(function MobileBottomNav({
  onMenuClick,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const isCashier = useIsCashier();
  const isWaiter = useIsWaiter();
  const isCook = useIsCook();
  const cashierAllowedPaths = useCashierAllowedPaths();
  const waiterAllowedPaths = useWaiterAllowedPaths();
  const cookAllowedPaths = useCookAllowedPaths();
  const canManageCrm = useCanManageCustomers();
  const menuGroups = useFrigMenu();
  const { favorites } = useNavFavorites();
  const { locked: subscriptionLocked, isLoading: subscriptionLoading } =
    useSubscriptionLock();

  // Mientras carga el candado, no intercambiar el set de tabs (evita un flash
  // de Suscripción/Soporte al entrar a cualquier página).
  const lockedRef = useRef(false);
  if (!subscriptionLoading) lockedRef.current = subscriptionLocked;
  const lockedStable = subscriptionLoading ? lockedRef.current : subscriptionLocked;

  const roleFilter: NavRoleFilter = useMemo(
    () => ({
      isCashier,
      isWaiter,
      isCook,
      canManageCrm,
      cashierAllowedPaths,
      waiterAllowedPaths,
      cookAllowedPaths,
    }),
    [
      isCashier,
      isWaiter,
      isCook,
      canManageCrm,
      cashierAllowedPaths,
      waiterAllowedPaths,
      cookAllowedPaths,
    ],
  );

  const allMenuItems = useMemo(
    () => menuGroups.flatMap((g) => g.items),
    [menuGroups],
  );

  const visibleMenuItems = useMemo(
    () => filterNavItemsByRole(allMenuItems, roleFilter),
    [allMenuItems, roleFilter],
  );

  const navItems = useMemo<NavItem[]>(() => {
    if (lockedStable) {
      return [
        {
          href: "/profile",
          label: "Suscripción",
          icon: CreditCard,
          description: "Activa el plan de la sucursal",
        },
        {
          href: "/help",
          label: "Ayuda",
          icon: LifeBuoy,
          description: "Documentación y contrato API",
        },
        {
          href: "/support",
          label: "Soporte",
          icon: LifeBuoy,
          description: "Casos, dudas e ideas al equipo",
        },
      ];
    }

    const toNavItem = (item: (typeof visibleMenuItems)[number]): NavItem => {
      const icon = item.href === "/dashboard" ? LineChart : item.icon;
      return {
        href: item.href,
        label: item.label,
        icon,
        badge: item.badge,
        description: item.description,
      };
    };

    const starred = favorites
      .map((href) => visibleMenuItems.find((i) => i.href === href))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map(toNavItem);

    if (starred.length > 0) return starred.slice(0, BOTTOM_NAV_SLOTS);

    const preferred = defaultBottomNavHrefs({ isCashier, isWaiter, isCook });
    return preferred
      .map((href) => visibleMenuItems.find((i) => i.href === href))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map(toNavItem)
      .slice(0, BOTTOM_NAV_SLOTS);
  }, [visibleMenuItems, favorites, isCashier, isWaiter, isCook, lockedStable]);

  // Prefetch de tabs + perfil para navegación instantánea en la PWA.
  useEffect(() => {
    const hrefs = new Set([
      ...navItems.map((i) => i.href),
      "/profile",
      ...(isCashier || isWaiter ? ["/pos/terminal"] : []),
      ...(isCook ? ["/kds"] : []),
    ]);
    hrefs.forEach((href) => {
      try {
        router.prefetch(href);
      } catch {
        /* prefetch best-effort */
      }
    });
  }, [navItems, router, isCashier, isWaiter, isCook]);

  const items: (NavItem & { onClick?: () => void; keyId: string })[] = [
    ...navItems.map((item) => ({ ...item, keyId: item.href })),
    { href: "", label: "Menú", icon: LayoutGrid, onClick: onMenuClick, keyId: "__menu__" },
  ];

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="glass-strong pointer-events-auto mx-3 flex min-h-[58px] items-center justify-around rounded-2xl border border-primary/25 px-1.5 py-1 shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
        {items.map((item) => {
          const isActive =
            !!item.href &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`));
          const isMenu = !item.href;

          const content = (
            <div
              className={cn(
                "relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 touch-manipulation",
                // Sin transition-all: evita repaint del dock entero al cambiar ruta.
                isActive
                  ? "font-semibold text-primary-foreground"
                  : "text-foreground/55",
                isMenu && !isActive && "font-medium text-foreground",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId={reduceMotion ? undefined : "frig-mobile-nav-pill"}
                  className="absolute inset-0 rounded-xl bg-primary shadow-md"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 420, damping: 34 }
                  }
                />
              )}
              <div className="relative">
                {isMenu ? (
                  <LayoutGrid
                    className="relative z-10 h-[20px] w-[20px]"
                    strokeWidth={1.8}
                  />
                ) : (
                  <item.icon
                    className="relative z-10 h-[20px] w-[20px]"
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                )}
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow-xs">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "relative z-10 max-w-full truncate px-0.5 text-[10px] leading-tight",
                  isActive
                    ? "font-semibold text-primary-foreground"
                    : "font-medium text-foreground/60",
                  isMenu && !isActive && "text-foreground/80",
                )}
              >
                {item.label}
              </span>
            </div>
          );

          if (item.href) {
            return (
              <Link
                key={item.keyId}
                href={item.href}
                prefetch
                scroll={false}
                className="relative flex min-w-0 flex-1 flex-col items-stretch justify-center select-none"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.keyId}
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
});
