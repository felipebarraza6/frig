"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import {
  X,
  LogOut,
  User as UserIcon,
  ArrowRightLeft,
  ChevronRight,
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
  useIsCook,
  useCashierAllowedPaths,
  useWaiterAllowedPaths,
  useCookAllowedPaths,
  useCanManageCustomers,
} from "@/lib/store/session";
import { BranchSwitcherModal } from "@/components/branch-switcher-modal";
import { useFrigMenu } from "@/lib/hooks/useFrigMenu";
import { useNavFavorites, MAX_NAV_FAVORITES } from "@/lib/store/nav-favorites";
import { filterNavItemsByRole, type NavRoleFilter } from "@/lib/nav-access";
import { logout } from "@/lib/api/auth";
import { logoutLocal } from "@/lib/logout-local";
import { BrandLogo } from "@/components/brand-logo";
import { useProductBrand } from "@/lib/product-name";

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_ACCESS_LIMIT = MAX_NAV_FAVORITES;

export function MobileMenuSheet({ open, onClose }: MobileMenuSheetProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);

  const user = useSessionStore((s) => s.user);
  const _theme = useSessionStore((s) => s.theme);
  const branch = useCurrentBranch();
  const canSwitchBranch = useCanSwitchBranch();
  const { name: appName, logo: brandLogo } = useProductBrand();
  const menuGroups = useFrigMenu();
  const { favorites, toggleFavorite, isFavorite } = useNavFavorites();
  const isCashier = useIsCashier();
  const isWaiter = useIsWaiter();
  const isCook = useIsCook();
  const cashierAllowedPaths = useCashierAllowedPaths();
  const waiterAllowedPaths = useWaiterAllowedPaths();
  const cookAllowedPaths = useCookAllowedPaths();
  const canManageCrm = useCanManageCustomers();
  const [editingQuickAccess, setEditingQuickAccess] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);

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

  const handleClose = useCallback(() => {
    setEditingQuickAccess(false);
    setBranchPickerOpen(false);
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

  // Al navegar (Link del sheet), cierra el menú; el dock inferior permanece.
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    if (open) handleClose();
  }

  async function handleLogout() {
    handleClose();
    try {
      await logout();
    } catch {
      // ignora errores de red en logout
    }
    await logoutLocal(queryClient);
    window.location.assign(window.location.origin + "/login");
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

  const quickAccess = useMemo(() => {
    // Solo favoritos reales del usuario, sin relleno con defaults (igual que el sidebar web).
    return favorites
      .map((href) => allItems.find((i) => i.href === href))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => filterNavItemsByRole([item], roleFilter).length > 0)
      .slice(0, QUICK_ACCESS_LIMIT);
  }, [allItems, favorites, roleFilter]);

  const visibleGroups = useMemo(
    () =>
      menuGroups
        .map((group) => ({
          ...group,
          items: filterNavItemsByRole(group.items, roleFilter),
        }))
        .filter((group) => group.items.length > 0),
    [menuGroups, roleFilter]
  );

  const _displayName = branch ? branchName(branch) : appName;

  return (
    <>
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
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.12}
            onDragEnd={handleDragEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute bottom-0 left-0 right-0 flex h-[min(92dvh,720px)] max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl bg-background shadow-[0_-8px_40px_rgba(0,0,0,0.2)]"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            {/* Handle: único punto de arrastre (el scroll del cuerpo queda libre). */}
            <div
              className="flex w-full shrink-0 cursor-grab items-center justify-center pt-3 pb-1 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Cabecera: logo + sucursal + usuario en fila, sin recortes. */}
            <div className="relative shrink-0 border-b border-border px-4 py-3">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent"
              />
              <div className="relative flex items-center gap-3 pr-10">
                <BrandLogo
                  src={brandLogo}
                  alt={appName}
                  name={appName}
                  containerClassName="h-14 w-14 shrink-0 rounded-2xl bg-card text-sm text-primary-foreground shadow-sm ring-1 ring-border"
                  className="h-full w-full object-contain p-1.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold leading-snug text-foreground">
                    {branch ? branchName(branch) : appName}
                  </p>
                  {user && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[user.first_name, user.last_name].filter(Boolean).join(" ") ||
                        user.email}
                    </p>
                  )}
                  {user?.email && user.first_name && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                      {user.email}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Cerrar menú"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Cuerpo scrolleable: min-h-0 evita que el footer se monte encima. */}
            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {editingQuickAccess ? (
                <section className="mb-2">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Accesos directos
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {favorites.length} de {QUICK_ACCESS_LIMIT}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Elige hasta {QUICK_ACCESS_LIMIT} atajos. Aparecen en la barra inferior y arriba en este menú.
                  </p>
                  <div className="grid grid-cols-4 gap-2.5">
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
                              "relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2 transition-all touch-manipulation active:scale-[0.96]",
                              favorited
                                ? "border-primary bg-primary text-primary-foreground shadow-md"
                                : "border-primary/20 bg-primary/[0.04] text-foreground hover:bg-primary/10 active:bg-primary/15",
                              disabled && "cursor-not-allowed opacity-40 active:scale-100",
                            )}
                          >
                            <div
                              className={cn(
                                "absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full",
                                favorited ? "bg-white/25" : "bg-black/40",
                              )}
                            >
                              {favorited ? (
                                <Pin className="h-3 w-3 fill-white text-white" strokeWidth={2.5} />
                              ) : (
                                <PinOff className="h-3 w-3 text-white" strokeWidth={2.5} />
                              )}
                            </div>
                            <item.icon
                              className={cn(
                                "h-5 w-5 shrink-0",
                                favorited ? "text-primary-foreground" : "text-primary",
                              )}
                              strokeWidth={favorited ? 2.5 : 2}
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
                  <section className="mb-5">
                    <div className="mb-3 flex items-center justify-between gap-2">
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
                      <div className="grid grid-cols-4 gap-2.5">
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

                  <section className="flex flex-col gap-5 pb-2">
                    {visibleGroups.map((group) => (
                      <div key={group.title}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.title}
                        </p>
                        <div className="grid grid-cols-4 gap-2.5">
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

            {/* Footer fijo: perfil + acciones; no compite con el scroll. */}
            <div className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Link
                href="/profile"
                prefetch
                onClick={handleClose}
                aria-label="Abrir mi perfil"
                className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/50 p-3 transition-colors hover:bg-muted active:bg-muted/80"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <UserIcon className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {user?.first_name ?? user?.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {canSwitchBranch && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setBranchPickerOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-muted px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
                  >
                    <ArrowRightLeft className="h-4 w-4 shrink-0" />
                    <span className="truncate">Sucursal</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl bg-danger px-3 py-3 text-sm font-medium text-white transition-colors hover:bg-danger/90",
                    !canSwitchBranch && "col-span-2",
                  )}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
      {/* Selector de sucursal a pantalla completa; el sheet se cierra al abrirlo. */}
      <BranchSwitcherModal
        open={branchPickerOpen}
        onClose={() => setBranchPickerOpen(false)}
      />
    </>
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
      prefetch
      onClick={onClick}
      className={cn(
        "flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all touch-manipulation active:scale-[0.96]",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-md font-semibold"
          : "border-primary/20 bg-primary/[0.04] text-foreground hover:bg-primary/10 active:bg-primary/15"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", active ? "text-primary-foreground" : "text-primary")} strokeWidth={active ? 2.5 : 2} />
      <span className="max-w-full truncate text-[11px] font-medium leading-tight">{label}</span>
    </Link>
  );
}


