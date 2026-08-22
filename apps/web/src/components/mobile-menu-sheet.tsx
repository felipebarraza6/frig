"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import {
  X,
  LogOut,
  User as UserIcon,
  ArrowRightLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { branchName } from "@/lib/types";
import {
  useSessionStore,
  useCurrentBranch,
  useCanSwitchBranch,
  useIsCashier,
  useIsWaiter,
} from "@/lib/store/session";
import { useFrigMenu } from "@/lib/hooks/useFrigMenu";
import { useNavFavorites } from "@/lib/store/nav-favorites";
import { logout } from "@/lib/api/auth";
import { clearToken } from "@/lib/api/session-storage";
import { BrandLogo } from "@/components/brand-logo";

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_ACCESS_LIMIT = 6;

export function MobileMenuSheet({ open, onClose }: MobileMenuSheetProps) {
  const pathname = usePathname();
  const router = useRouter();
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);

  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);
  const theme = useSessionStore((s) => s.theme);
  const branch = useCurrentBranch();
  const canSwitchBranch = useCanSwitchBranch();
  const appName = theme?.app_name ?? "FRIG";
  const menuGroups = useFrigMenu();
  const { favorites } = useNavFavorites();
  const isCashier = useIsCashier();
  const isWaiter = useIsWaiter();

  // Cierra con Escape.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function handleLogout() {
    onClose();
    try {
      await logout();
    } catch {
      // ignora errores de red en logout
    }
    clearToken();
    clearSession();
    router.replace("/login");
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 80 || info.velocity.y > 500) {
      onClose();
    }
  }

  const allItems = useMemo(
    () => menuGroups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title }))),
    [menuGroups]
  );

  const quickAccess = useMemo(() => {
    const starred = favorites
      .map((href) => allItems.find((i) => i.href === href))
      .filter(Boolean)
      .slice(0, QUICK_ACCESS_LIMIT);

    if (starred.length >= QUICK_ACCESS_LIMIT) return starred;

    const defaults = allItems.filter((i) => !starred.some((s) => s?.href === i.href));
    return [...starred, ...defaults].slice(0, QUICK_ACCESS_LIMIT);
  }, [allItems, favorites]);

  const isAllowed = useCallback(
    (href: string): boolean => {
      if (isCashier)
        return ["/pos", "/pos/terminal", "/cash-register", "/kds", "/sales", "/profile"].some(
          (p) => href === p || href.startsWith(`${p}/`)
        );
      if (isWaiter)
        return ["/pos", "/pos/terminal", "/tables", "/tables/map", "/sales", "/profile"].some(
          (p) => href === p || href.startsWith(`${p}/`)
        );
      return true;
    },
    [isCashier, isWaiter]
  );

  const visibleGroups = useMemo(
    () =>
      menuGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => isAllowed(item.href)),
        }))
        .filter((group) => group.items.length > 0),
    [menuGroups, isAllowed]
  );

  const displayName = branch ? branchName(branch) : appName;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            ref={sheetRef}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.2)]"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            {/* Handle de arrastre */}
            <div
              className="flex w-full cursor-grab items-center justify-center pt-3 pb-1 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="relative overflow-hidden border-b border-border px-5 pb-7 pt-4">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-3 z-10 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="relative flex flex-col items-center text-center">
                {theme?.logo ? (
                  <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-1 shadow-lg ring-4 ring-primary/10">
                    <BrandLogo
                      src={theme.logo}
                      alt={appName}
                      name={displayName}
                      containerClassName="h-20 w-20 rounded-xl bg-white"
                      className="h-full w-full p-1.5"
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl bg-primary p-1 shadow-lg ring-4 ring-primary/10">
                    <BrandLogo
                      src={null}
                      alt={appName}
                      name={displayName}
                      containerClassName="h-16 w-16 rounded-xl bg-primary text-lg text-white"
                    />
                  </div>
                )}
                {branch ? (
                  <p className="mt-3 text-lg font-bold">{branchName(branch)}</p>
                ) : (
                  <p className="mt-3 text-lg font-bold">{appName}</p>
                )}
                {user && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {user.first_name ?? user.email}
                  </p>
                )}
              </div>
            </div>

            {/* Contenido scrolleable */}
            <div className="scrollbar-hide flex-1 overflow-y-auto px-5 py-4">
              {/* Accesos rápidos */}
              {quickAccess.length > 0 && (
                <section className="mb-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Accesos rápidos
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {quickAccess.map((item) =>
                      item ? (
                        <QuickAccessButton
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                          onClick={onClose}
                        />
                      ) : null
                    )}
                  </div>
                </section>
              )}

              {/* Grupos como cuadrículas de acceso rápido */}
              <section className="flex flex-col gap-5">
                {visibleGroups.map((group) => (
                  <div key={group.title}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.title}
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                      {group.items.map((item) => (
                        <QuickAccessButton
                          key={item.href}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                          onClick={onClose}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-3 rounded-xl bg-muted p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <UserIcon className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user?.first_name ?? user?.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {canSwitchBranch && (
                  <Link
                    href="/select-branch"
                    onClick={onClose}
                    className="flex items-center justify-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Cambiar sucursal
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl bg-danger px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-danger/90",
                    !canSwitchBranch && "col-span-2"
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function QuickAccessButton({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-colors",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-background text-foreground hover:bg-muted"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 1.75} />
      <span className="max-w-full truncate text-[11px] font-medium leading-tight">{label}</span>
    </Link>
  );
}


