"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  LayoutDashboard,
  ShoppingCart,
  CreditCard,
  Receipt,
  Table,
  Users,
  UserCircle,
  Percent,
  Calendar,
  TrendingUp,
  Banknote,
  Landmark,
  Package,
  Warehouse,
  Boxes,
  Apple,
  Utensils,
  Leaf,
  Truck,
  QrCode,
  FileText,
  BoxesIcon,
  Settings,
  PackageCheck,
  Tags,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentBranch, useIsOwner, useIsSuperAdmin } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import {
  fetchBranchModules,
  toggleBranchModuleByName,
  updateSubmoduleConfig,
  syncBranchModules,
  parseSubmoduleConfig,
  type ModuleName,
  type SubmoduleConfig,
} from "@/lib/api/branch-modules";
import { ApiError } from "@/lib/api/client";
import type { YggdraSchemas } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import {
  CORE_UI_MODULES,
  isCompositeModule,
  getCompositeSubmodules,
  ALL_COMPOSITE_SUBMODULES,
} from "@/lib/modules";

type ModuleConfig = YggdraSchemas["BranchModuleConfiguration"];

/** Módulos que Frig muestra en esta pantalla (excluye verticalidades ajenas). */
const FRIG_MODULES: ModuleName[] = [
  "dashboard",
  "config",
  "sales",
  "pos",
  "tables",
  "customers",
  "promotions",
  "scheduling",
  "finance",
  "cash_register",
  "payment_methods",
  "bank_accounts",
  "inventory",
  "warehouse_management",
  "products",
  "stock_control",
  "product_catalog",
  "suppliers",
  "nutrition",
  "recipes",
  "ingredients",
  "public_catalog",
  "invoices",
];

const MODULE_META: Partial<
  Record<
    ModuleName,
    {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      color: string;
      bg: string;
    }
  >
> = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard, color: "text-blue-600", bg: "bg-blue-500/10" },
  config: { label: "Configuración", icon: Settings, color: "text-slate-600", bg: "bg-slate-500/10" },
  sales: { label: "Ventas", icon: ShoppingCart, color: "text-green-600", bg: "bg-green-500/10" },
  pos: { label: "Punto de venta", icon: Receipt, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  tables: { label: "Mesas", icon: Table, color: "text-amber-600", bg: "bg-amber-500/10" },
  customers: { label: "Clientes", icon: Users, color: "text-purple-600", bg: "bg-purple-500/10" },
  clients: { label: "Clientes", icon: UserCircle, color: "text-purple-600", bg: "bg-purple-500/10" },
  promotions: { label: "Promociones", icon: Percent, color: "text-pink-600", bg: "bg-pink-500/10" },
  scheduling: { label: "Agendamiento", icon: Calendar, color: "text-indigo-600", bg: "bg-indigo-500/10" },
  finance: { label: "Finanzas", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  cash_register: { label: "Arqueo de caja", icon: Banknote, color: "text-lime-600", bg: "bg-lime-500/10" },
  payment_methods: { label: "Métodos de pago", icon: CreditCard, color: "text-cyan-600", bg: "bg-cyan-500/10" },
  bank_accounts: { label: "Cuentas bancarias", icon: Landmark, color: "text-blue-600", bg: "bg-blue-500/10" },
  inventory: { label: "Inventario", icon: Package, color: "text-orange-600", bg: "bg-orange-500/10" },
  warehouse_management: { label: "Bodegas", icon: Warehouse, color: "text-stone-600", bg: "bg-stone-500/10" },
  products: { label: "Productos", icon: Boxes, color: "text-violet-600", bg: "bg-violet-500/10" },
  nutrition: { label: "Nutrición", icon: Apple, color: "text-red-600", bg: "bg-red-500/10" },
  recipes: { label: "Recetas", icon: Utensils, color: "text-orange-600", bg: "bg-orange-500/10" },
  ingredients: { label: "Ingredientes", icon: Leaf, color: "text-green-600", bg: "bg-green-500/10" },
  suppliers: { label: "Proveedores", icon: Truck, color: "text-amber-600", bg: "bg-amber-500/10" },
  public_catalog: { label: "Catálogo QR", icon: QrCode, color: "text-pink-600", bg: "bg-pink-500/10" },
  invoices: { label: "Facturas", icon: FileText, color: "text-sky-600", bg: "bg-sky-500/10" },
  stock_control: { label: "Control de stock", icon: PackageCheck, color: "text-lime-600", bg: "bg-lime-500/10" },
  product_catalog: { label: "Catálogo", icon: Tags, color: "text-violet-600", bg: "bg-violet-500/10" },
  product_gallery: { label: "Galería", icon: BoxesIcon, color: "text-fuchsia-600", bg: "bg-fuchsia-500/10" },
  raw_materials: { label: "Materias primas", icon: Package, color: "text-amber-600", bg: "bg-amber-500/10" },
  tariffs: { label: "Tarifarios", icon: Receipt, color: "text-cyan-600", bg: "bg-cyan-500/10" },
  equipment: { label: "Equipos", icon: Settings, color: "text-gray-600", bg: "bg-gray-500/10" },
  certificates: { label: "Certificados", icon: FileText, color: "text-emerald-600", bg: "bg-emerald-500/10" },
};

const MODULE_GROUPS: {
  title: string;
  modules: ModuleName[];
  gradient: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    title: "Operaciones",
    modules: ["dashboard", "sales", "pos", "tables", "scheduling"],
    gradient: "from-blue-500/5 to-transparent",
    icon: LayoutDashboard,
  },
  {
    title: "Clientes y promociones",
    modules: ["customers", "promotions", "public_catalog"],
    gradient: "from-purple-500/5 to-transparent",
    icon: Users,
  },
  {
    title: "Finanzas",
    modules: ["finance", "cash_register", "payment_methods", "bank_accounts", "invoices"],
    gradient: "from-emerald-500/5 to-transparent",
    icon: TrendingUp,
  },
  {
    title: "Inventario y productos",
    modules: [
      "inventory",
    ],
    gradient: "from-orange-500/5 to-transparent",
    icon: Package,
  },
  {
    title: "Nutrición",
    modules: ["nutrition"],
    gradient: "from-red-500/5 to-transparent",
    icon: Apple,
  },
];

function getModuleMeta(moduleName: ModuleName) {
  return (
    MODULE_META[moduleName] ?? {
      label: moduleName,
      icon: Package,
      color: "text-gray-600",
      bg: "bg-gray-500/10",
    }
  );
}

function isCore(moduleName: ModuleName): boolean {
  return CORE_UI_MODULES.includes(moduleName);
}

export default function BranchModulesPage() {
  const branch = useCurrentBranch();
  const isOwner = useIsOwner();
  const isSuperAdmin = useIsSuperAdmin();
  const toast = useToast();
  const queryClient = useQueryClient();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : null;
  const canManage = isOwner || isSuperAdmin;
  const [search, setSearch] = useState("");

  const { data: configs = [], isLoading, error } = useQuery({
    queryKey: ["branch-modules", branchId],
    queryFn: () => fetchBranchModules(branchId!),
    enabled: !!branchId,
  });

  const filtered = configs.filter((c) => FRIG_MODULES.includes(c.module_name));
  const configByName = useMemo(() => {
    const map = new Map<ModuleName, ModuleConfig>();
    filtered.forEach((c) => map.set(c.module_name, c));
    return map;
  }, [filtered]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((c) => c.is_enabled).length;
    const pending = filtered.filter((c) => c.validation_status === "pending").length;
    return { total, active, inactive: total - active, pending };
  }, [filtered]);

  const toggle = useMutation({
    mutationFn: toggleBranchModuleByName,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["branch-modules", branchId] });
      toast.success(vars.isEnabled ? "Módulo habilitado" : "Módulo deshabilitado");
    },
    onError: (err: Error, vars) => {
      queryClient.invalidateQueries({ queryKey: ["branch-modules", branchId] });
      if (err instanceof ApiError && err.status === 403) {
        toast.error(`El módulo "${getModuleMeta(vars.moduleName).label}" no está incluido en tu plan.`);
      } else {
        toast.error(err.message);
      }
    },
  });

  const updateSubmodules = useMutation({
    mutationFn: updateSubmoduleConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-modules", branchId] });
      toast.success("Submódulos actualizados");
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ["branch-modules", branchId] });
      toast.error(err.message);
    },
  });

  const sync = useMutation({
    mutationFn: syncBranchModules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-modules", branchId] });
      toast.success("Módulos sincronizados con el plan");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleToggle(moduleName: ModuleName) {
    if (!canManage) {
      toast.error("No tienes permisos para modificar módulos");
      return;
    }
    if (!branchId) return;
    const config = configByName.get(moduleName);
    if (!config) return;
    toggle.mutate({ branchId, moduleName, isEnabled: !config.is_enabled });
  }

  function handleSubmoduleToggle(
    compositeName: ModuleName,
    submoduleName: ModuleName,
    currentConfig: SubmoduleConfig,
    nextEnabled: boolean,
  ) {
    if (!canManage) {
      toast.error("No tienes permisos para modificar módulos");
      return;
    }
    const compositeConfig = configByName.get(compositeName);
    if (!compositeConfig) return;
    updateSubmodules.mutate({
      moduleConfigId: compositeConfig.id,
      submoduleConfig: { ...currentConfig, [submoduleName]: nextEnabled },
    });
  }

  const searchLower = search.toLowerCase().trim();

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Módulos</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {branch ? branch.business_name ?? branch.branch_name : "Esta sucursal"}
            </p>
          </div>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => branchId && sync.mutate(branchId)}
              disabled={sync.isPending || !branchId}
              className="gap-2"
            >
              {sync.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Sincronizar con plan
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-primary" />
            <span><strong className="text-foreground">{stats.active}</strong> activos</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-muted" />
            <span><strong className="text-foreground">{stats.inactive}</strong> inactivos</span>
          </div>
          {stats.pending > 0 && (
            <div className="flex items-center gap-1.5 text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span><strong>{stats.pending}</strong> pendientes</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar módulo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-6 p-6">
        {!canManage && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Solo el OWNER o superadmin pueden modificar módulos.
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p>No se pudieron cargar los módulos.</p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {MODULE_GROUPS.map((group) => {
              const GroupIcon = group.icon;
              const groupConfigs = group.modules
                .map((m) => configByName.get(m))
                .filter((c): c is ModuleConfig => {
                  if (!c) return false;
                  if (ALL_COMPOSITE_SUBMODULES.includes(c.module_name)) return false;
                  if (searchLower) {
                    const meta = getModuleMeta(c.module_name);
                    return meta.label.toLowerCase().includes(searchLower);
                  }
                  return true;
                });

              if (groupConfigs.length === 0) return null;

              return (
                <motion.section
                  key={group.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "overflow-hidden rounded-xl border border-border bg-card",
                    "bg-gradient-to-br",
                    group.gradient
                  )}
                >
                  <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                      <GroupIcon className="h-4 w-4 text-primary" />
                    </div>
                    <h2 className="text-sm font-semibold">{group.title}</h2>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {groupConfigs.filter((c) => c.is_enabled).length}/{groupConfigs.length}
                    </span>
                  </div>
                  <div className="p-2">
                    {groupConfigs.map((config) => {
                      if (isCompositeModule(config.module_name)) {
                        return (
                          <CompositeModuleCard
                            key={config.module_name}
                            config={config}
                            canManage={canManage}
                            isPending={toggle.isPending || updateSubmodules.isPending}
                            getConfig={(name) => configByName.get(name)}
                            onToggle={() => handleToggle(config.module_name)}
                            onSubmoduleToggle={(sub, next) =>
                              handleSubmoduleToggle(
                                config.module_name,
                                sub,
                                parseSubmoduleConfig(config.submodule_config),
                                next,
                              )
                            }
                          />
                        );
                      }
                      return (
                        <ModuleCard
                          key={config.module_name}
                          config={config}
                          canManage={canManage}
                          isPending={toggle.isPending}
                          onToggle={() => handleToggle(config.module_name)}
                        />
                      );
                    })}
                  </div>
                </motion.section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleCard({
  config,
  canManage,
  isPending,
  onToggle,
}: {
  config: ModuleConfig;
  canManage: boolean;
  isPending: boolean;
  onToggle: () => void;
}) {
  const core = isCore(config.module_name);
  const { label, icon: Icon, color, bg } = getModuleMeta(config.module_name);
  const enabled = !!config.is_enabled;

  return (
    <div
      className={cn(
        "group relative mx-2 my-1 flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-all duration-150",
        "hover:border-border hover:bg-accent/50",
        !enabled && "opacity-60"
      )}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", bg)}>
        <Icon className={cn("h-4.5 w-4.5", color)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-none">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {core ? (
            <span className="text-emerald-600">Core — siempre activo</span>
          ) : enabled ? (
            "Habilitado"
          ) : (
            "Deshabilitado"
          )}
        </p>
        {config.validation_status === "pending" && config.is_enabled && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            Pendiente
          </span>
        )}
      </div>
      {core ? (
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          Activo
        </span>
      ) : (
        <ToggleSwitch
          checked={enabled}
          onChange={onToggle}
          disabled={isPending || !canManage}
          label={enabled ? "Deshabilitar" : "Habilitar"}
        />
      )}
    </div>
  );
}

function CompositeModuleCard({
  config,
  canManage,
  isPending,
  getConfig,
  onToggle,
  onSubmoduleToggle,
}: {
  config: ModuleConfig;
  canManage: boolean;
  isPending: boolean;
  getConfig: (name: ModuleName) => ModuleConfig | undefined;
  onToggle: () => void;
  onSubmoduleToggle: (submoduleName: ModuleName, nextEnabled: boolean) => void;
}) {
  const core = isCore(config.module_name);
  const submodules = getCompositeSubmodules(config.module_name);
  const submoduleConfig = parseSubmoduleConfig(config.submodule_config);
  const compositeEnabled = !!config.is_enabled;
  const { label, icon: Icon, color, bg } = getModuleMeta(config.module_name);

  const enabledCount = submodules.filter((s) => submoduleConfig[s]).length;

  return (
    <div
      className={cn(
        "group mx-2 my-1 overflow-hidden rounded-lg border transition-all duration-150",
        compositeEnabled ? "border-transparent hover:border-border hover:bg-accent/30" : "border-transparent opacity-60"
      )}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", bg)}>
          <Icon className={cn("h-4.5 w-4.5", color)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium leading-none">{label}</p>
            {submodules.length > 0 && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {enabledCount}/{submodules.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {core ? (
              <span className="text-emerald-600">Core — siempre activo</span>
            ) : compositeEnabled ? (
              "Habilitado"
            ) : (
              "Deshabilitado"
            )}
          </p>
        </div>
        {core ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Activo
          </span>
        ) : (
          <ToggleSwitch
            checked={compositeEnabled}
            onChange={onToggle}
            disabled={isPending || !canManage}
            label={compositeEnabled ? "Deshabilitar" : "Habilitar"}
          />
        )}
      </div>

      <AnimatePresence>
        {submodules.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border bg-muted/20 px-3 py-2">
              {submodules.map((subName) => {
                const subConfig = getConfig(subName);
                const subEnabled = !!submoduleConfig[subName];
                const { label: subLabel, icon: SubIcon, color: subColor, bg: subBg } = getModuleMeta(subName);
                return (
                  <div
                    key={subName}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                      "hover:bg-accent/50",
                      !subEnabled && "opacity-50"
                    )}
                  >
                    <div className={cn("flex h-6 w-6 items-center justify-center rounded", subBg)}>
                      <SubIcon className={cn("h-3 w-3", subColor)} />
                    </div>
                    <span className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
                      {subLabel}
                    </span>
                    {subConfig && subConfig.validation_status === "pending" && subEnabled && (
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                    )}
                    <ToggleSwitch
                      checked={subEnabled}
                      onChange={() => onSubmoduleToggle(subName, !subEnabled)}
                      disabled={isPending || !canManage || !compositeEnabled}
                      label={subEnabled ? "Deshabilitar" : "Habilitar"}
                      size="sm"
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  label: string;
  size?: "sm" | "md";
}) {
  const sizes = {
    sm: { track: "h-5 w-9", thumb: "h-3.5 w-3.5", translate: checked ? "translate-x-[18px]" : "translate-x-[3px]" },
    md: { track: "h-6 w-11", thumb: "h-4 w-4", translate: checked ? "translate-x-6" : "translate-x-1" },
  };

  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        sizes[size].track,
        checked ? "bg-primary" : "bg-input",
        disabled && "cursor-not-allowed opacity-50"
      )}
      aria-label={label}
    >
      <span
        className={cn(
          "pointer-events-none rounded-full bg-white shadow-sm transition-transform duration-200",
          sizes[size].thumb,
          sizes[size].translate
        )}
      />
    </button>
  );
}
