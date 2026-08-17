"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentBranch, useIsOwner, useIsSuperAdmin, useSessionStore } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import {
  fetchBranchModules,
  enableBranchModule,
  disableBranchModule,
  syncBranchModules,
  type ModuleName,
} from "@/lib/api/branch-modules";
import type { YggdraSchemas } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type ModuleConfig = YggdraSchemas["BranchModuleConfiguration"];

const RESTAURANT_MODULES: ModuleName[] = [
  "dashboard",
  "sales",
  "pos",
  "tables",
  "customers",
  "clients",
  "promotions",
  "scheduling",
  "finance",
  "cash_register",
  "payment_methods",
  "bank_accounts",
  "inventory",
  "warehouse_management",
  "stock_control",
  "products",
  "recipes",
  "ingredients",
  "nutrition",
  "suppliers",
  "employees",
  "analytics",
  "public_catalog",
];

const CORE_MODULES: ModuleName[] = [
  "dashboard",
  "config",
  "sales",
  "finance",
  "customers",
  "inventory",
];

const MODULE_LABELS: Partial<Record<ModuleName, string>> = {
  dashboard: "Dashboard",
  sales: "Ventas",
  pos: "Punto de venta (POS)",
  tables: "Mesas",
  customers: "Clientes",
  clients: "Clientes",
  promotions: "Promociones y descuentos",
  scheduling: "Agendamiento / reservas",
  finance: "Finanzas",
  cash_register: "Arqueo de caja",
  payment_methods: "Métodos de pago",
  bank_accounts: "Cuentas bancarias",
  inventory: "Inventario",
  warehouse_management: "Gestión de bodegas",
  stock_control: "Control de stock",
  products: "Productos",
  recipes: "Recetas",
  ingredients: "Ingredientes nutricionales",
  nutrition: "Etiquetado nutricional",
  suppliers: "Proveedores",
  employees: "Empleados",
  analytics: "Analítica",
  public_catalog: "Catálogo público / Menús QR",
};

const MODULE_GROUPS: { title: string; modules: ModuleName[] }[] = [
  {
    title: "Operaciones",
    modules: ["dashboard", "sales", "pos", "tables", "scheduling"],
  },
  {
    title: "Clientes y promociones",
    modules: ["customers", "clients", "promotions", "public_catalog"],
  },
  {
    title: "Finanzas",
    modules: ["finance", "cash_register", "payment_methods", "bank_accounts"],
  },
  {
    title: "Inventario y productos",
    modules: ["inventory", "warehouse_management", "stock_control", "products", "suppliers"],
  },
  {
    title: "Nutrición",
    modules: ["nutrition", "recipes", "ingredients"],
  },
  {
    title: "Organización",
    modules: ["employees", "analytics"],
  },
];

function isCore(moduleName: ModuleName): boolean {
  return CORE_MODULES.includes(moduleName);
}

export default function BranchModulesPage() {
  const branch = useCurrentBranch();
  const isOwner = useIsOwner();
  const isSuperAdmin = useIsSuperAdmin();
  const toast = useToast();
  const queryClient = useQueryClient();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : null;
  const canManage = isOwner || isSuperAdmin;
  const enabledApps = useSessionStore((s) => s.permissions?.enabled_apps ?? []);
  const setEnabledApps = useSessionStore((s) => s.setEnabledApps);

  const { data: configs = [], isLoading, error } = useQuery({
    queryKey: ["branch-modules", branchId],
    queryFn: () => fetchBranchModules(branchId!),
    enabled: !!branchId,
  });

  const filtered = configs.filter((c) => RESTAURANT_MODULES.includes(c.module_name));
  const configByName = new Map<ModuleName, ModuleConfig>();
  filtered.forEach((c) => configByName.set(c.module_name, c));

  const enable = useMutation({
    mutationFn: enableBranchModule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-modules", branchId] });
      toast.success("Módulo habilitado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disable = useMutation({
    mutationFn: disableBranchModule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-modules", branchId] });
      toast.success("Módulo deshabilitado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sync = useMutation({
    mutationFn: syncBranchModules,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-modules", branchId] });
      toast.success("Módulos sincronizados con el plan");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleToggle(config: ModuleConfig) {
    if (!canManage) {
      toast.error("No tienes permisos para modificar módulos");
      return;
    }
    const nextApps = new Set(enabledApps);
    if (config.is_enabled) {
      nextApps.delete(config.module_name);
      disable.mutate(config.id);
    } else {
      nextApps.add(config.module_name);
      enable.mutate(config.id);
    }
    setEnabledApps(Array.from(nextApps));
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Módulos de la sucursal</h1>
          <p className="text-xs text-muted-foreground">
            Activa o desactiva funcionalidades para {branch ? branch.business_name ?? branch.branch_name : "esta sucursal"}
          </p>
        </div>
        {canManage && (
          <Button
            variant="outline"
            onClick={() => branchId && sync.mutate(branchId)}
            disabled={sync.isPending || !branchId}
          >
            {sync.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Sincronizar con plan
          </Button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6">
        {!canManage && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            Solo el OWNER o superadmin pueden habilitar/deshabilitar módulos.
          </div>
        )}

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar los módulos.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {MODULE_GROUPS.map((group) => {
              const groupConfigs = group.modules
                .map((m) => configByName.get(m))
                .filter(Boolean) as ModuleConfig[];
              if (groupConfigs.length === 0) return null;
              return (
                <section key={group.title} className="rounded-xl border border-border bg-card p-4">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {groupConfigs.map((config) => {
                      const core = isCore(config.module_name);
                      const toggling = enable.isPending || disable.isPending;
                      return (
                        <div
                          key={config.id}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5",
                            config.is_enabled ? "bg-background" : "bg-muted/30"
                          )}
                        >
                          <div className="min-w-0">
                            <p className={cn("text-sm font-medium", !config.is_enabled && "text-muted-foreground")}>
                              {MODULE_LABELS[config.module_name] ?? config.module_display_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {core ? "Core — siempre activo" : config.is_enabled ? "Habilitado" : "Deshabilitado"}
                            </p>
                            {config.validation_status === "invalid" && config.validation_message && (
                              <p className="mt-1 text-xs text-danger">{config.validation_message}</p>
                            )}
                          </div>
                          {core ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              Activo
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggle(config)}
                              disabled={toggling || !canManage}
                              className={cn(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                config.is_enabled ? "bg-primary" : "bg-muted",
                                (toggling || !canManage) && "opacity-50 cursor-not-allowed"
                              )}
                              aria-label={config.is_enabled ? "Deshabilitar" : "Habilitar"}
                            >
                              <span
                                className={cn(
                                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                  config.is_enabled ? "translate-x-6" : "translate-x-1"
                                )}
                              />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
