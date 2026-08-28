"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { m, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  LogOut,
  ChefHat,
  Search,
  PanelLeftClose,
  PanelLeft,
  Pin,
  PinOff,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { branchName } from "@/lib/types";
import {
  useSessionStore,
  useCurrentBranch,
  useIsCashier,
  useIsWaiter,
  useCanSwitchBranch,
  useIsModuleEnabledFromConfig,
  useCashierAllowedPaths,
  useWaiterAllowedPaths,
} from "@/lib/store/session";
import { useFrigMenu } from "@/lib/hooks/useFrigMenu";
import { useNavFavorites } from "@/lib/store/nav-favorites";
import { useSidebarStore } from "@/lib/store/sidebar";
import { logout } from "@/lib/api/auth";
import { clearToken } from "@/lib/api/session-storage";
import { fetchKitchenStations } from "@/lib/api/kitchen-stations";
import { fetchKitchenTickets } from "@/lib/api/kitchen";
import { BrandLogo } from "@/components/brand-logo";
import { CommandPalette, type CommandPaletteItem } from "@/components/command-palette/command-palette";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: "kitchenReady";
}

interface AppSidebarProps {
  onNavigate?: () => void;
  forceExpanded?: boolean;
  defaultOpenGroups?: "all";
}

export function AppSidebar({ onNavigate, forceExpanded, defaultOpenGroups }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const storeExpanded = useSidebarStore((s) => s.expanded);
  const toggleExpanded = useSidebarStore((s) => s.toggle);
  const expanded = forceExpanded ?? storeExpanded;
  const hovering = useSidebarStore((s) => s.hovering);
  const setHovering = useSidebarStore((s) => s.setHovering);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(defaultOpenGroups === "all" ? "all" : null);
  const effectivelyExpanded = expanded || hovering;

  const isGroupOpen = (title: string) => openGroup === "all" || openGroup === title;

  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);
  const theme = useSessionStore((s) => s.theme);
  const branch = useCurrentBranch();
  const menuGroups = useFrigMenu();
  const isCashier = useIsCashier();
  const isWaiter = useIsWaiter();
  const canSwitchBranch = useCanSwitchBranch();
  const appName = theme?.app_name ?? "FRIG";
  const { favorites, toggleFavorite, isFavorite } = useNavFavorites();

  const cashierAllowedPaths = useCashierAllowedPaths();
  const waiterAllowedPaths = useWaiterAllowedPaths();

  function isAllowedPath(href: string, allowedPaths: string[]): boolean {
    return allowedPaths.some((p) => href === p || href.startsWith(`${p}/`));
  }

  const visibleMenuGroups = menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (isCashier) return isAllowedPath(item.href, cashierAllowedPaths);
        if (isWaiter) {
          if (item.href === "/pos") return true;
          return isAllowedPath(item.href, waiterAllowedPaths);
        }
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  const branchId = branch?.id ? Number(branch.id) : null;
  const isProductionEnabled = useIsModuleEnabledFromConfig("production");
  const { data: kitchenStations = [] } = useQuery({
    queryKey: ["kitchen-stations"],
    queryFn: fetchKitchenStations,
    enabled: !!branchId && isProductionEnabled,
  });

  const { data: kitchenTickets = [] } = useQuery({
    queryKey: ["kitchen-tickets", "READY"],
    queryFn: () => fetchKitchenTickets("READY"),
    refetchInterval: 15_000,
    enabled: !!branch && isProductionEnabled,
  });

  const badges = useMemo(() => {
    const readyCount = kitchenTickets.length;
    return { readyCount };
  }, [kitchenTickets]);

  const stationItems = useMemo(
    () =>
      kitchenStations.map((station) => ({
        href: `/kds/station/${station.id}`,
        label: station.name,
        icon: ChefHat,
        description: undefined as string | undefined,
      })),
    [kitchenStations]
  );

  const allItems = useMemo<CommandPaletteItem[]>(() => {
    const ops = visibleMenuGroups.flatMap((g) => g.title.toLowerCase() === "operaciones" ? g.items.map((i) => ({ href: i.href, label: i.label, group: "Operaciones" as const })) : []);
    const stations = kitchenStations.map((s) => ({
      href: `/kds/station/${s.id}`,
      label: s.name,
      group: "Estaciones de cocina",
    }));
    const admin = visibleMenuGroups
      .filter((g) => g.title.toLowerCase() !== "operaciones")
      .flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, group: g.title })));
    return [...ops, ...stations, ...admin];
  }, [visibleMenuGroups, kitchenStations]);

  const allNavHrefs = useMemo(
    () => [...visibleMenuGroups.flatMap((g) => g.items), ...stationItems],
    [visibleMenuGroups, stationItems]
  );

  function getBadgeValue(badge?: string) {
    if (badge === "kitchenReady") return badges.readyCount > 0 ? badges.readyCount : undefined;
    return undefined;
  }

  function getActiveHref(items: { href: string }[], path: string): string | null {
    const normalized = path.replace(/\/$/, "") || "/";
    const exact = items.find((i) => {
      const href = i.href.replace(/\/$/, "") || "/";
      return normalized === href;
    });
    if (exact) return exact.href;
    const matches = items.filter((i) => {
      const href = i.href.replace(/\/$/, "") || "/";
      return normalized.startsWith(`${href}/`);
    });
    if (matches.length === 0) return null;
    return matches.reduce((a, b) => (a.href.length >= b.href.length ? a : b)).href;
  }

  const activeHref = getActiveHref(allNavHrefs, pathname);
  const stationActiveHref = getActiveHref(stationItems, pathname);

  async function handleLogout() {
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

  useEffect(() => {
    function handleShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  if (!hasHydrated || !user) return null;

  // Sombra solo cuando el panel expandido flota como overlay (hover sin pin).
  const widthClass = effectivelyExpanded
    ? hovering && !expanded
      ? "w-60 shadow-xl"
      : "w-60"
    : "w-16";

  return (
    <>
      <CommandPalette items={allItems} open={searchOpen} onClose={() => setSearchOpen(false)} />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-border bg-card transition-all duration-300 ease-out",
          widthClass
        )}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="flex shrink-0 items-center gap-2 px-3 py-3">
          <BrandLogo src={theme?.logo} alt={appName} containerClassName="h-9 w-9 shrink-0" />
          <AnimatePresence>
            {effectivelyExpanded && (
              <m.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="min-w-0"
              >
                <p className="truncate text-sm font-semibold">{appName}</p>
                {branch && (
                  <p className="truncate text-xs text-muted-foreground">{branchName(branch)}</p>
                )}
              </m.div>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={toggleExpanded}
            className={cn(
              "ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              !effectivelyExpanded && "ml-0"
            )}
            title={expanded ? "Colapsar menú" : "Expandir menú"}
          >
            {expanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 py-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              !effectivelyExpanded && "justify-center px-0"
            )}
          >
            <Search className="h-4 w-4 shrink-0" />
            {effectivelyExpanded && (
              <>
                <span className="flex-1 text-left">Buscar...</span>
                <span className="rounded border border-border px-1 text-[10px]">⌘K</span>
              </>
            )}
          </button>

          {favorites.length > 0 && effectivelyExpanded && (
            <nav className="flex flex-col gap-1">
              <p className="px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Accesos directos
              </p>
              {favorites
                .map((href) => {
                  const item = allItems.find((i) => i.href === href);
                  const menuItem = menuGroups
                    .flatMap((g) => g.items)
                    .find((i) => i.href === href);
                  return item
                    ? { ...item, icon: menuItem?.icon ?? LayoutDashboard }
                    : null;
                })
                .filter(Boolean)
                .map((item) =>
                  item ? (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                      expanded
                      favorited
                      onToggleFavorite={() => toggleFavorite(item.href)}
                    />
                  ) : null
                )}
            </nav>
          )}

          {visibleMenuGroups.some((g) => g.title.toLowerCase() === "operaciones") && (
            <nav className="flex flex-col gap-1">
              {effectivelyExpanded && (
                <p className="px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Operaciones
                </p>
              )}
              {visibleMenuGroups
                .find((g) => g.title.toLowerCase() === "operaciones")
                ?.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={
                      (isCashier || isWaiter) && item.href === "/pos"
                        ? ("/pos/terminal" as string)
                        : item.href
                    }
                    label={item.label}
                    icon={item.icon}
                    active={activeHref === item.href}
                    expanded={effectivelyExpanded}
                    badge={getBadgeValue(item.badge)}
                    onToggleFavorite={() => toggleFavorite(item.href)}
                    favorited={isFavorite(item.href)}
                    onClick={onNavigate}
                    description={item.description}
                  />
                ))}
            </nav>
          )}

          {branchId && isProductionEnabled && stationItems.length > 0 && (
            <NavGroup
              title="Estaciones"
              expanded={effectivelyExpanded}
              isOpen={isGroupOpen("Estaciones") || !!stationActiveHref}
              onToggle={() =>
                !stationActiveHref &&
                setOpenGroup((prev) => (prev === "Estaciones" ? null : "Estaciones"))
              }
            >
              {stationItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={activeHref === item.href}
                  expanded={effectivelyExpanded}
                  onToggleFavorite={() => toggleFavorite(item.href)}
                  favorited={isFavorite(item.href)}
                  onClick={onNavigate}
                  description={item.description}
                />
              ))}
            </NavGroup>
          )}

          {visibleMenuGroups
            .filter((g) => g.title.toLowerCase() !== "operaciones")
            .map((group) => {
              const groupActiveHref = getActiveHref(group.items, pathname);
              const forceOpen = !!groupActiveHref;
              return (
                <NavGroup
                  key={group.title}
                  title={group.title}
                  expanded={effectivelyExpanded}
                  isOpen={isGroupOpen(group.title) || forceOpen}
                  onToggle={() =>
                    !forceOpen &&
                    setOpenGroup((prev) => (prev === group.title ? null : group.title))
                  }
                >
                  {group.items.map((item) => (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      active={groupActiveHref === item.href}
                      expanded={effectivelyExpanded}
                      onToggleFavorite={() => toggleFavorite(item.href)}
                      favorited={isFavorite(item.href)}
                      onClick={onNavigate}
                      description={item.description}
                    />
                  ))}
                </NavGroup>
              );
            })}
        </div>

        <div className="flex shrink-0 flex-col gap-1 border-t border-border p-2">
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
              pathname.startsWith("/profile")
                ? "bg-primary text-white"
                : "hover:bg-muted hover:text-foreground",
              !effectivelyExpanded && "justify-center px-0"
            )}
            title={!effectivelyExpanded ? "Perfil" : undefined}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
              <UserIcon className="h-4 w-4" />
            </div>
            {effectivelyExpanded && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.first_name ?? user?.email}</p>
                <p className="truncate text-xs opacity-80">{user?.email}</p>
              </div>
            )}
          </Link>
          {effectivelyExpanded && (
            <>
              {canSwitchBranch && (
                <Link
                  href="/select-branch"
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Cambiar sucursal
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </>
          )}
          {!effectivelyExpanded && (
            <button
              onClick={handleLogout}
              className="flex items-center justify-center rounded-lg px-0 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function NavGroup({
  title,
  children,
  expanded,
  isOpen,
  onToggle,
}: {
  title: string;
  children: ReactNode;
  expanded: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (!expanded) {
    return <div className="flex flex-col gap-1">{children}</div>;
  }

  return (
    <div className="flex flex-col gap-1 mt-3 pt-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        {title}
        {isOpen ? <ChevronDown className="h-3 w-3 opacity-60" /> : <ChevronRight className="h-3 w-3 opacity-60" />}
      </button>
      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="flex min-h-0 flex-col gap-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  expanded: boolean;
  badge?: string | number;
  favorited?: boolean;
  onToggleFavorite?: () => void;
  onClick?: () => void;
  description?: string;
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  expanded,
  badge,
  favorited,
  onToggleFavorite,
  onClick,
  description,
}: NavItemProps) {
  return (
    <div className={cn("group relative", !expanded && "flex justify-center")}>
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          !expanded && "h-9 w-9 justify-center p-0"
        )}
        title={description || (!expanded ? label : undefined)}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-foreground/80" />
        )}
        <Icon className="h-5 w-5 shrink-0" />
        {expanded && (
          <>
            <span className="flex-1 truncate">{label}</span>
            {badge !== undefined && (
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  typeof badge === "number"
                    ? "bg-danger text-white"
                    : "border border-border bg-background text-muted-foreground"
                )}
              >
                {badge}
              </span>
            )}
          </>
        )}
        {!expanded && badge !== undefined && typeof badge === "number" && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </Link>
      {expanded && onToggleFavorite && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onToggleFavorite();
          }}
          className={cn(
            "absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100",
            favorited ? "text-primary opacity-100" : "text-muted-foreground hover:text-primary"
          )}
          title={favorited ? "Quitar de favoritos" : "Añadir a favoritos"}
        >
          {favorited ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}
