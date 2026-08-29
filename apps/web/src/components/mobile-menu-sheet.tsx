"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import {
  X,
  LogOut,
  User as UserIcon,
  ArrowRightLeft,
  Pin,
  PinOff,
  Settings2,
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
  useCashierAllowedPaths,
  useWaiterAllowedPaths,
} from "@/lib/store/session";
import { useFrigMenu } from "@/lib/hooks/useFrigMenu";
import { useNavFavorites, MAX_NAV_FAVORITES } from "@/lib/store/nav-favorites";
import { logout } from "@/lib/api/auth";
import { clearToken } from "@/lib/api/session-storage";
import { BrandLogo } from "@/components/brand-logo";

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_ACCESS_LIMIT = MAX_NAV_FAVORITES;

export function MobileMenuSheet({ open, onClose }: MobileMenuSheetProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);

  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);
  const theme = useSessionStore((s) => s.theme);
  const branch = useCurrentBranch();
  const canSwitchBranch = useCanSwitchBranch();
  const appName = theme?.app_name ?? "FRIG";
  const menuGroups = useFrigMenu();
  const { favorites, toggleFavorite, isFavorite } = useNavFavorites();
  const isCashier = useIsCashier();
  const isWaiter = useIsWaiter();
  const cashierAllowedPaths = useCashierAllowedPaths();
  const waiterAllowedPaths = useWaiterAllowedPaths();
  const [editingQuickAccess, setEditingQuickAccess] = useState(false);

  const handleClose = useCallback(() => {
    setEditingQuickAccess(false);
    onClose();
  }, [onClose]);

  // Cierra con Escape.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleClose]);

  async function handleLogout() {
    handleClose();
    try {
      await logout();
    } catch {
      // ignora errores de red en logout
    }
    clearToken();
    clearSession();
    queryClient.clear();
    router.replace("/login");
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 80 || info.velocity.y > 500) {
      handleClose();
    }
  }

  const allItems = useMemo(
    () => menuGroups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title }))),
    [menuGroups]
  );

  const isAllowed = useCallback(
    (href: string): boolean => {
      if (isCashier)
        return cashierAllowedPaths.some(
          (p) => href === p || href.startsWith(`${p}/`),
        );
      if (isWaiter)
        return waiterAllowedPaths.some(
          (p) => href === p || href.startsWith(`${p}/`),
        );
      return true;
    },
    [isCashier, isWaiter, cashierAllowedPaths, waiterAllowedPaths]
  );

  const quickAccess = useMemo(() => {
    // Solo favoritos reales del usuario, sin relleno con defaults (igual que el sidebar web).
    return favorites
      .map((href) => allItems.find((i) => i.href === href))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => isAllowed(item.href))
      .slice(0, QUICK_ACCESS_LIMIT);
  }, [allItems, favorites, isAllowed]);

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
            onClick={handleClose}
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
                onClick={handleClose}
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
                      containerClassName="h-16 w-16 rounded-xl bg-primary text-lg text-primary-foreground"
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
              {editingQuickAccess ? (
                /* Modo edición de accesos directos */
                <section className="mb-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Accesos directos
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {favorites.length} de {QUICK_ACCESS_LIMIT}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Selecciona los accesos que quieres ver primero en el menú y la barra inferior.
                  </p>
                  <div className="grid grid-cols-4 gap-3">
                    {visibleGroups.flatMap((group) =>
                      group.items.map((item) => {
                        const favorited = isFavorite(item.href);
                        const disabled = !favorited && favorites.length >= QUICK_ACCESS_LIMIT;
                        return (
                          <button
                            key={item.href}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleFavorite(item.href)}
                            className={cn(
                              "relative flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all touch-manipulation active:scale-[0.96]",
                              favorited
                                ? "border-primary/40 bg-primary/10 text-primary shadow-xs"
                                : "border-border/80 bg-background text-foreground hover:bg-muted active:bg-muted/80",
                              disabled && "cursor-not-allowed opacity-40 active:scale-100",
                            )}
                          >
                            <div className="absolute right-1.5 top-1.5">
                              {favorited ? (
                                <Pin className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <PinOff className="h-3.5 w-3.5 text-muted-foreground/60" />
                              )}
                            </div>
                            <item.icon
                              className={cn(
                                "h-5 w-5 shrink-0",
                                favorited ? "text-primary" : "text-muted-foreground",
                              )}
                              strokeWidth={favorited ? 2.5 : 1.75}
                            />
                            <span className="max-w-full truncate text-[11px] font-medium leading-tight">
                              {item.label}
                            </span>
                          </button>
                        );
                      }),
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingQuickAccess(false)}
                    className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Listo
                  </button>
                </section>
              ) : (
                <>
                  {/* Accesos directos */}
                  <section className="mb-5">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Accesos directos
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditingQuickAccess(true)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <Settings2 className="h-3 w-3" />
                        Editar
                      </button>
                    </div>
                    {quickAccess.length > 0 ? (
                      <div className="grid grid-cols-4 gap-3">
                        {quickAccess.map((item) => (
                          <QuickAccessButton
                            key={item.href}
                            href={item.href}
                            label={item.label}
                            icon={item.icon}
                            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                            onClick={handleClose}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
                        Sin accesos todavía. Toca “Editar” para elegir tus atajos.
                      </p>
                    )}
                  </section>

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
                              onClick={handleClose}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </section>
                </>
              )}
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
                    onClick={handleClose}
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
        "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all touch-manipulation active:scale-[0.96]",
        active
          ? "border-primary/40 bg-primary/10 text-primary shadow-xs font-semibold"
          : "border-border/80 bg-background text-foreground hover:bg-muted active:bg-muted/80"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 1.75} />
      <span className="max-w-full truncate text-[11px] font-medium leading-tight">{label}</span>
    </Link>
  );
}


