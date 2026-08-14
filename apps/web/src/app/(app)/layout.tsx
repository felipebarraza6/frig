"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  RotateCcw,
  LogOut,
  Package,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { branchName } from "@/lib/types";
import {
  useSessionStore,
  useCurrentBranch,
  useCanManageUsers,
  useCanViewBranches,
  useCanManageInventory,
  useCanManageCustomers,
} from "@/lib/store/session";
import { logout } from "@/lib/api/auth";
import { clearToken } from "@/lib/api/session-storage";
import { BrandLogo } from "@/components/brand-logo";

const OPERATIONAL_NAV = [
  { href: "/pos", label: "POS", icon: Receipt },
  { href: "/kds", label: "Cocina", icon: RotateCcw },
  { href: "/sales", label: "Ventas", icon: ShoppingBag },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

interface AdminGroup {
  title: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    requiresManageUsers?: boolean;
    requiresViewBranches?: boolean;
    requiresInventory?: boolean;
    requiresManageCustomers?: boolean;
  }[];
}

const ADMIN_GROUPS: AdminGroup[] = [
  {
    title: "Productos",
    items: [
      { href: "/products", label: "Productos", icon: Package },
      { href: "/categories", label: "Categorías", icon: Tags, requiresInventory: true },
      { href: "/warehouses", label: "Bodegas", icon: Warehouse, requiresInventory: true },
      { href: "/inventory", label: "Inventario", icon: ClipboardList, requiresInventory: true },
    ],
  },
  {
    title: "CRM",
    items: [
      { href: "/customers", label: "Clientes", icon: UserCircle, requiresManageCustomers: true },
    ],
  },
  {
    title: "Finanzas",
    items: [
      { href: "/payment-methods", label: "Métodos de pago", icon: CreditCard },
      { href: "/bank-accounts", label: "Cuentas bancarias", icon: Landmark },
      { href: "/revenues", label: "Ingresos", icon: ArrowDownLeft },
      { href: "/expenses", label: "Egresos", icon: ArrowUpRight },
    ],
  },
  {
    title: "Compras",
    items: [
      { href: "/suppliers", label: "Proveedores", icon: Truck },
      { href: "/purchase-orders", label: "Órdenes de compra", icon: FileText },
    ],
  },
  {
    title: "Organización",
    items: [
      { href: "/users", label: "Usuarios", icon: UserIcon, requiresManageUsers: true },
      { href: "/branches", label: "Sucursales", icon: Store, requiresViewBranches: true },
    ],
  },
];

function AdminGroupNav({
  group,
  renderItem,
}: {
  group: AdminGroup;
  renderItem: (item: AdminGroup["items"][number]) => ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {group.title}
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>
      {open && group.items.map(renderItem)}
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const user = useSessionStore((s) => s.user);
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const clearSession = useSessionStore((s) => s.clearSession);
  const theme = useSessionStore((s) => s.theme);
  const branch = useCurrentBranch();
  const canManageUsers = useCanManageUsers();
  const canViewBranches = useCanViewBranches();
  const canManageInventory = useCanManageInventory();
  const canManageCustomers = useCanManageCustomers();
  const appName = theme?.app_name ?? "FRIG";

  const visibleOperationalNav = OPERATIONAL_NAV;

  const visibleAdminGroups = ADMIN_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.requiresManageUsers) return canManageUsers;
      if (item.requiresManageCustomers) return canManageCustomers;
      if (item.requiresViewBranches) return canViewBranches;
      if (item.requiresInventory) return canManageInventory;
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  const renderNavItem = (item: (typeof OPERATIONAL_NAV[number]) | AdminGroup["items"][number]) => {
    const active = pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,color] duration-150",
          active
            ? "bg-primary text-white"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  };

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) router.replace("/login");
    else if (!currentBranchId) router.replace("/select-branch");
  }, [hasHydrated, user, currentBranchId, router]);

  if (!hasHydrated || !user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // ignora errores de red en logout; se limpia sesión local igual
    }
    clearToken();
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-full">
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col overflow-hidden border-r border-border bg-card">
        <div className="flex shrink-0 items-center gap-2 px-4 py-4">
          <BrandLogo src={theme?.logo} alt={appName} containerClassName="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{appName}</p>
            {branch && (
              <p className="truncate text-xs text-muted-foreground">{branchName(branch)}</p>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 py-2">
          <nav className="flex flex-col gap-1">
            {visibleOperationalNav.map(renderNavItem)}
          </nav>

          {visibleAdminGroups.length > 0 && (
            <nav className="flex flex-col gap-3 border-t border-border pt-2">
              {visibleAdminGroups.map((group) => (
                <AdminGroupNav key={group.title} group={group} renderItem={renderNavItem} />
              ))}
            </nav>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1 border-t border-border p-2">
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-[background-color,color] duration-150",
              pathname.startsWith("/profile")
                ? "bg-primary text-white"
                : "hover:bg-muted hover:text-foreground",
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user?.first_name ?? user?.email}
              </p>
              <p className="truncate text-xs opacity-80">
                {user?.email}
              </p>
            </div>
          </Link>
          <Link
            href="/select-branch"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-[background-color,color] duration-150 hover:bg-muted hover:text-foreground"
          >
            Cambiar sucursal
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-[background-color,color] duration-150 hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="ml-56 flex min-h-full flex-1 flex-col">{children}</main>
    </div>
  );
}