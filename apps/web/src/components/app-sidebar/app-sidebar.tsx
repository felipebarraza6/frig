"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Receipt,
  LogOut,
  Package,
  Boxes,
  User as UserIcon,
  UserCircle,
  Store,
  Tags,
  Warehouse,
  ClipboardList,
  CreditCard,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  ShoppingBag,
  Truck,
  FileText,
  ChevronDown,
  ChevronRight,
  Banknote,
  Percent,
  QrCode,
  Monitor,
  ChefHat,
  Search,
  PanelLeftClose,
  PanelLeft,
  Pin,
  PinOff,
  Table,
  Settings,
  Apple,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { branchName } from "@/lib/types";
import {
  useSessionStore,
  useCurrentBranch,
  useCanManageUsers,
  useCanManageInventory,
  useCanManageCustomers,
  useCanManageBranches,
  useIsCashier,
  useIsWaiter,
  useIsOwner,
  useIsAdminLocal,
  useCanViewTables,
  useCanSwitchBranch,
} from "@/lib/store/session";
import { useBranchModules } from "@/lib/hooks/useBranchModules";
import type { ModuleName } from "@/lib/api/branch-modules";
import { isModuleEnabled, isSubmoduleEnabled } from "@/lib/modules";
import { useNavFavorites } from "@/lib/store/nav-favorites";
import { useSidebarStore } from "@/lib/store/sidebar";
import { logout } from "@/lib/api/auth";
import { clearToken } from "@/lib/api/session-storage";
import { fetchKitchenStations } from "@/lib/api/kitchen-stations";
import { fetchKitchenTickets } from "@/lib/api/kitchen";
import { fetchOrders } from "@/lib/api/orders";
import { getCurrentCashRegister } from "@/lib/api/cash-register";
import { BrandLogo } from "@/components/brand-logo";
import { CommandPalette, type CommandPaletteItem } from "@/components/command-palette/command-palette";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module: ModuleName | null;
  /** Si este ítem depende de un submódulo específico, indica el padre compuesto. */
  submoduleParent?: ModuleName;
  badge?: "ordersPending" | "cashOpen" | "kitchenReady";
  requiresManageUsers?: boolean;
  requiresViewBranches?: boolean;
  requiresInventory?: boolean;
  requiresManageCustomers?: boolean;
  requiresViewTables?: boolean;
  requiresOwner?: boolean;
}

const OPERATIONAL_NAV: NavItem[] = [
  { href: "/pos", label: "POS", icon: Receipt, module: "pos", badge: "ordersPending" },
  { href: "/cash-register", label: "Caja", icon: Banknote, module: "cash_register", badge: "cashOpen" },
  { href: "/kds", label: "Cocina", icon: ChefHat, module: "pos", badge: "kitchenReady" },
  { href: "/sales", label: "Ventas", icon: ShoppingBag, module: "sales", badge: "ordersPending" },
  { href: "/quotations", label: "Cotizaciones", icon: FileText, module: "sales" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" },
];

interface AdminGroup {
  title: string;
  items: NavItem[];
}

const ADMIN_GROUPS: AdminGroup[] = [
  {
    title: "Productos",
    items: [
      { href: "/products", label: "Productos", icon: Package, module: "products" },
      { href: "/products/combos", label: "Combos", icon: Boxes, module: "products" },
      { href: "/products/menus", label: "Menús", icon: QrCode, module: "public_catalog" },
      { href: "/products/nutrition", label: "Etiquetado nutricional", icon: Apple, module: "nutrition" },
      { href: "/categories", label: "Categorías", icon: Tags, module: "products" },
      { href: "/warehouses", label: "Bodegas", icon: Warehouse, module: "warehouse_management" },
      { href: "/inventory", label: "Inventario", icon: ClipboardList, module: "inventory" },
    ],
  },
  {
    title: "Sala",
    items: [
      { href: "/tables", label: "Mesas", icon: Table, module: "tables", requiresViewTables: true },
      { href: "/tables/map", label: "Mapa de mesas", icon: Table, module: "tables", requiresViewTables: true },
    ],
  },
  {
    title: "CRM",
    items: [
      { href: "/customers", label: "Clientes", icon: UserCircle, module: "customers", requiresManageCustomers: true },
    ],
  },
  {
    title: "Promociones",
    items: [{ href: "/promotions/discounts", label: "Descuentos", icon: Percent, module: "promotions" }],
  },
  {
    title: "Finanzas",
    items: [
      { href: "/cash-register/stations", label: "Estaciones POS", icon: Monitor, module: "cash_register" },
      { href: "/payment-methods", label: "Métodos de pago", icon: CreditCard, module: "payment_methods" },
      { href: "/bank-accounts", label: "Cuentas bancarias", icon: Landmark, module: "bank_accounts" },
      { href: "/revenues", label: "Ingresos", icon: ArrowDownLeft, module: "finance" },
      { href: "/expenses", label: "Egresos", icon: ArrowUpRight, module: "finance" },
    ],
  },
  {
    title: "Compras",
    items: [
      { href: "/suppliers", label: "Proveedores", icon: Truck, module: "suppliers" },
      { href: "/purchase-orders", label: "Órdenes de compra", icon: FileText, module: "suppliers" },
    ],
  },
  {
    title: "Configuración",
    items: [
      { href: "/users", label: "Usuarios", icon: UserIcon, module: "config", requiresManageUsers: true },
      { href: "/branches", label: "Sucursales", icon: Store, module: "config", requiresViewBranches: true },
      { href: "/settings/modules", label: "Módulos", icon: Settings, module: "config", requiresOwner: true },
    ],
  },
];

interface AppSidebarProps {
  onNavigate?: () => void;
  forceExpanded?: boolean;
}

export function AppSidebar({ onNavigate, forceExpanded }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const storeExpanded = useSidebarStore((s) => s.expanded);
  const toggleExpanded = useSidebarStore((s) => s.toggle);
  const expanded = forceExpanded ?? storeExpanded;
  const hovering = useSidebarStore((s) => s.hovering);
  const setHovering = useSidebarStore((s) => s.setHovering);
  const [searchOpen, setSearchOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const effectivelyExpanded = expanded || hovering;

  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);
  const theme = useSessionStore((s) => s.theme);
  const branch = useCurrentBranch();
  const canManageUsers = useCanManageUsers();
  const canManageBranches = useCanManageBranches();
  const canManageInventory = useCanManageInventory();
  const canManageCustomers = useCanManageCustomers();
  const canViewTables = useCanViewTables();
  const { enabledModules, submoduleConfigs, isLoading: modulesLoading } = useBranchModules();
  const isCashier = useIsCashier();
  const isWaiter = useIsWaiter();
  const isOwner = useIsOwner();
  const isAdminLocal = useIsAdminLocal();
  const canSwitchBranch = useCanSwitchBranch();
  const appName = theme?.app_name ?? "FRIG";
  const { favorites, toggleFavorite, isFavorite } = useNavFavorites();

  const isGlobalAdmin = Boolean(user?.is_superuser || user?.type_user === "ADM");

  const visibleOperationalNav = useMemo(
    () =>
      OPERATIONAL_NAV.map((item) =>
        (isCashier || isWaiter) && item.href === "/pos"
          ? { ...item, href: "/pos/terminal" as const }
          : item
      )
        .filter((item) => {
          if (modulesLoading) return true;
          if (!isModuleEnabled(item.module, enabledModules)) return false;
          if (item.requiresViewTables) return canViewTables;
          if (isCashier) {
            return ["/pos/terminal", "/cash-register", "/kds", "/sales"].includes(item.href);
          }
          if (isWaiter) {
            return ["/pos/terminal", "/tables/map", "/sales"].includes(item.href);
          }
          return true;
        })
        .sort((a, b) => {
          if (isCashier || isWaiter) return 0;
          if (isOwner || isGlobalAdmin) {
            if (a.href === "/dashboard") return -1;
            if (b.href === "/dashboard") return 1;
            return 0;
          }
          if (a.href === "/pos") return -1;
          if (b.href === "/pos") return 1;
          return 0;
        }),
    [isCashier, isWaiter, isOwner, isGlobalAdmin, canViewTables, modulesLoading, enabledModules]
  );

  const visibleAdminGroups = useMemo(
    () =>
      ADMIN_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (isWaiter) return item.requiresViewTables && canViewTables;
          if (item.requiresOwner) return (isOwner || isGlobalAdmin) && isModuleEnabled(item.module, enabledModules);
          if (item.requiresManageUsers) return canManageUsers && isModuleEnabled(item.module, enabledModules);
          if (item.requiresManageCustomers) return canManageCustomers && isModuleEnabled(item.module, enabledModules);
          if (item.requiresViewBranches) return canManageBranches && isModuleEnabled(item.module, enabledModules);
          if (item.requiresInventory) return canManageInventory && isModuleEnabled(item.module, enabledModules);
          if (item.requiresViewTables) {
            if (!isModuleEnabled(item.module, enabledModules)) return false;
            if (isOwner || isGlobalAdmin || isAdminLocal) return canViewTables;
            return canViewTables;
          }
          // Si el ítem depende de un submódulo, verificar que el submódulo esté habilitado.
          if (item.submoduleParent && item.module) {
            const parentConfig = submoduleConfigs.get(item.submoduleParent) ?? {};
            if (!isSubmoduleEnabled(item.submoduleParent, item.module, parentConfig)) return false;
          }
          return isModuleEnabled(item.module, enabledModules);
        }),
      })).filter((group) => group.items.length > 0),
    [
      canManageUsers,
      canManageCustomers,
      canManageBranches,
      canManageInventory,
      canViewTables,
      enabledModules,
      isOwner,
      isGlobalAdmin,
      isAdminLocal,
      isWaiter,
      submoduleConfigs,
    ]
  );

  const branchId = branch?.id ? Number(branch.id) : null;
  const { data: kitchenStations = [] } = useQuery({
    queryKey: ["kitchen-stations"],
    queryFn: fetchKitchenStations,
    enabled: !!branchId,
  });

  const { data: kitchenTickets = [] } = useQuery({
    queryKey: ["kitchen-tickets", "READY"],
    queryFn: () => fetchKitchenTickets("READY"),
    refetchInterval: 15_000,
    enabled: !!branch,
  });

  const { data: pendingOrders } = useQuery({
    queryKey: ["orders", "pending"],
    queryFn: () => fetchOrders({ payment_status: "PENDING" }),
    refetchInterval: 30_000,
    enabled: !!branch,
  });

  const { data: currentCashRegister } = useQuery({
    queryKey: ["cash-register", "current"],
    queryFn: () => getCurrentCashRegister(),
    staleTime: 30_000,
    retry: false,
    enabled: !!branch,
  });

  const badges = useMemo(() => {
    const readyCount = kitchenTickets.length;
    const pendingCount = pendingOrders?.count ?? 0;
    const cashOpen = Boolean(currentCashRegister);
    return { readyCount, pendingCount, cashOpen };
  }, [kitchenTickets, pendingOrders, currentCashRegister]);

  const stationItems = useMemo(
    () =>
      kitchenStations.map((station) => ({
        href: `/kds/station/${station.id}`,
        label: station.name,
        icon: ChefHat,
      })),
    [kitchenStations]
  );

  const allItems = useMemo<CommandPaletteItem[]>(() => {
    const ops = visibleOperationalNav.map((i) => ({ href: i.href, label: i.label, group: "Operaciones" }));
    const stations = kitchenStations.map((s) => ({
      href: `/kds/station/${s.id}`,
      label: s.name,
      group: "Estaciones de cocina",
    }));
    const admin = visibleAdminGroups.flatMap((g) =>
      g.items.map((i) => ({ href: i.href, label: i.label, group: g.title }))
    );
    return [...ops, ...stations, ...admin];
  }, [visibleOperationalNav, kitchenStations, visibleAdminGroups]);

  const allNavHrefs = useMemo(
    () => [...visibleOperationalNav, ...stationItems, ...visibleAdminGroups.flatMap((g) => g.items)],
    [visibleOperationalNav, stationItems, visibleAdminGroups]
  );

  function getBadgeValue(badge?: string) {
    if (badge === "kitchenReady") return badges.readyCount > 0 ? badges.readyCount : undefined;
    if (badge === "ordersPending") return badges.pendingCount > 0 ? badges.pendingCount : undefined;
    if (badge === "cashOpen") return badges.cashOpen ? undefined : "cerrada";
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

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // ignora errores de red en logout
    }
    clearToken();
    clearSession();
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

  const widthClass = effectivelyExpanded ? "w-60" : "w-16";

  return (
    <>
      <CommandPalette items={allItems} open={searchOpen} onClose={() => setSearchOpen(false)} />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-border bg-card transition-all duration-300 ease-out",
          widthClass
        )}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="flex shrink-0 items-center gap-2 px-3 py-3">
          <BrandLogo src={theme?.logo} alt={appName} containerClassName="h-9 w-9 shrink-0" />
          <AnimatePresence>
            {effectivelyExpanded && (
              <motion.div
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
              </motion.div>
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
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Favoritos
              </p>
              {favorites
                .map((href) => {
                  const item = allItems.find((i) => i.href === href);
                  return item
                    ? { ...item, icon: OPERATIONAL_NAV.find((o) => o.href === href)?.icon }
                    : null;
                })
                .filter(Boolean)
                .map((item) =>
                  item ? (
                    <NavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      icon={item.icon || LayoutDashboard}
                      active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                      expanded
                      favorited
                      onToggleFavorite={() => toggleFavorite(item.href)}
                    />
                  ) : null
                )}
            </nav>
          )}

          <nav className="flex flex-col gap-1">
            {effectivelyExpanded && (
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Operaciones
              </p>
            )}
            {visibleOperationalNav.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={activeHref === item.href}
                expanded={effectivelyExpanded}
                badge={getBadgeValue(item.badge)}
                onToggleFavorite={() => toggleFavorite(item.href)}
                favorited={isFavorite(item.href)}
                onClick={onNavigate}
              />
            ))}
          </nav>

          {branchId && stationItems.length > 0 && (
            <NavGroup
              title="Estaciones"
              expanded={effectivelyExpanded}
              isOpen={openGroup === "Estaciones"}
              onToggle={() =>
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
                />
              ))}
            </NavGroup>
          )}

          {visibleAdminGroups.length > 0 &&
            visibleAdminGroups.map((group) => {
              const activeHref = getActiveHref(group.items, pathname);
              return (
                <NavGroup
                  key={group.title}
                  title={group.title}
                  expanded={effectivelyExpanded}
                  isOpen={openGroup === group.title}
                  onToggle={() =>
                    setOpenGroup((prev) => (prev === group.title ? null : group.title))
                  }
                >
                  {group.items.map((item) => (
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
    <div className="flex flex-col gap-1 border-t border-border pt-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {title}
        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-1 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
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
}: NavItemProps) {
  return (
    <div className={cn("group relative", !expanded && "flex justify-center")}>
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary text-white"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          !expanded && "h-9 w-9 justify-center p-0"
        )}
        title={!expanded ? label : undefined}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/80" />
        )}
        <Icon className="h-4 w-4 shrink-0" />
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
