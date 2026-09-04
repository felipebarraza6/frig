"use client";

/* eslint-disable react-hooks/static-components */
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Monitor,
  Table,
  ChefHat,
  Boxes,
  Apple,
  QrCode,
  FileText,
  Banknote,
  Percent,
  Bike,
  type LucideIcon,
} from "lucide-react";
import { useCurrentBranch, useIsOwner, useIsSuperAdmin, useSessionStore } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import {
  fetchBranchModules,
  toggleBranchModule,
  parseSubmoduleConfig,
  type ModuleName,
} from "@/lib/api/branch-modules";
import { fetchFrontendConfig } from "@/lib/api/frontend-config";
import { ApiError } from "@/lib/api/client";
import type { YggdraSchemas } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import {
  useModuleCatalog,
  getModuleMetadata,
} from "@/lib/hooks/useModuleCatalog";
import type { ModuleCatalogMetadata } from "@/lib/api/types/modules";
import { FRIG_ALWAYS_ON_MODULES, FRIG_SETTINGS_MODULES } from "@/lib/modules";

type ModuleConfig = YggdraSchemas["BranchModuleConfiguration"];

function isCore(moduleName: ModuleName): boolean {
  return FRIG_ALWAYS_ON_MODULES.includes(moduleName);
}

/** Labels claros en castellano chileno para los módulos configurables. */
const MODULE_LABELS: Partial<Record<ModuleName, string>> = {
  pos: "Terminal de ventas rápidas",
  cash_register: "Caja y arqueo",
  tables: "Mesas y mapa del local",
  deliveries: "Delivery y retiro",
  production: "Cocina / KDS",
  inventory: "Bodegas y control de stock",
  nutrition: "Etiquetado nutricional",
  public_catalog: "Menús digitales con QR",
  invoices: "Documentos tributarios",
  promotions: "Promociones y descuentos",
};

/** Íconos únicos y minimalistas para cada módulo configurable. */
const MODULE_ICONS: Partial<Record<ModuleName, LucideIcon>> = {
  pos: Monitor,
  cash_register: Banknote,
  tables: Table,
  deliveries: Bike,
  production: ChefHat,
  inventory: Boxes,
  nutrition: Apple,
  public_catalog: QrCode,
  invoices: FileText,
  promotions: Percent,
};

/** Categoría en castellano por módulo visible en Frig. */
const MODULE_CATEGORY: Partial<Record<ModuleName, string>> = {
  pos: "Operación",
  cash_register: "Operación",
  tables: "Operación",
  deliveries: "Operación",
  production: "Operación",
  inventory: "Productos",
  nutrition: "Productos",
  recipes: "Productos",
  ingredients: "Productos",
  public_catalog: "Productos",
  invoices: "Finanzas",
  promotions: "Clientes",
};

/** Descripción breve por módulo para la card. */
const MODULE_DESCRIPTIONS: Partial<Record<ModuleName, string>> = {
  pos: "Activa el punto de venta para cobros rápidos, boletas y ventas presenciales. Sin él, la Caja tampoco está disponible.",
  cash_register: "Apertura y cierre de caja, arqueo y movimientos de efectivo. Requiere que el módulo POS esté activo.",
  tables: "Organiza el salón: mapa de mesas, asignación de garzones y cuentas por mesa.",
  deliveries: "Muestra los paneles de delivery y retiro en local en el POS, y las órdenes con despacho.",
  production: "Pantallas de cocina (KDS), estaciones y seguimiento de preparaciones.",
  inventory: "Controla bodegas, stock disponible, movimientos y alertas de inventario.",
  nutrition: "Muestra información nutricional en productos. Recetas e ingredientes siempre están disponibles.",
  public_catalog: "Menús digitales con QR para que tus clientes vean y compartan.",
  invoices: "Genera boletas, facturas y notas de crédito/débito electrónicas. Al activar, habilita la página de Documentos tributarios en el menú de Finanzas.",
  promotions: "Descuentos y códigos promocionales que el cajero aplica en el carrito del POS.",
};

/** Orden de las secciones en la vista. */
const CATEGORY_ORDER = ["Operación", "Productos", "Clientes", "Finanzas"];

/** Resuelve la categoría de un módulo: mapa propio → meta → General. */
function resolveCategory(moduleName: ModuleName, metaCategory?: string | null): string {
  const own = MODULE_CATEGORY[moduleName];
  if (own) return own;
  const cat = metaCategory?.trim();
  if (!cat) return "General";
  const slug = cat.toLowerCase();
  const translations: Record<string, string> = {
    pos: "Operación",
    tables: "Operación",
    production: "Operación",
    inventory: "Productos",
    nutrition: "Productos",
    public_catalog: "Clientes",
  };
  return translations[slug] ?? cat;
}

export default function BranchModulesPage() {
  const branch = useCurrentBranch();
  const isOwner = useIsOwner();
  const isSuperAdmin = useIsSuperAdmin();
  const toast = useToast();
  const setModuleState = useSessionStore((s) => s.setModuleState);
  const setFrontendConfig = useSessionStore((s) => s.setFrontendConfig);
  const sessionModules = useSessionStore((s) => s.modules);
  const queryClient = useQueryClient();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : null;
  const canManage = isOwner || isSuperAdmin;

  const { data: configs = [], isLoading, error } = useQuery({
    queryKey: ["branch-modules", branchId],
    queryFn: () => fetchBranchModules(branchId!),
    enabled: !!branchId,
  });

  const { catalog, metadataByName, isLoading: catalogLoading } = useModuleCatalog();

  const filtered = useMemo(() => {
    const existing = new Map<ModuleName, ModuleConfig>();
    for (const c of configs) {
      if (FRIG_SETTINGS_MODULES.includes(c.module_name) && !isCore(c.module_name)) {
        existing.set(c.module_name, c);
      }
    }
    // Si el backend no devolvió una fila de configuración para un módulo
    // configurable, la card se sintetiza. El estado real en ese caso lo entrega
    // frontend-config (session.modules): módulos activos por plan pueden no
    // tener fila en `by_branch`, y si aquí se asume `false` la card aparece
    // "Inactivo" mientras el módulo está activo en la app, y el toggle acciona
    // en dirección contraria (activa en vez de desactivar).
    return FRIG_SETTINGS_MODULES.filter((name) => !isCore(name)).map((name) => {
      const row = existing.get(name);
      if (row) return row;
      return {
        id: 0,
        branch: branchId ?? 0,
        module_name: name,
        is_enabled: sessionModules[name]?.is_enabled ?? false,
        submodule_config: sessionModules[name]?.submodule_config ?? {},
        created: "",
        modified: "",
      } as unknown as ModuleConfig;
    });
  }, [configs, branchId, sessionModules]);

  const configByName = useMemo(() => {
    const map = new Map<ModuleName, ModuleConfig>();
    filtered.forEach((c) => map.set(c.module_name, c));
    return map;
  }, [filtered]);

  const groups = useMemo(() => {
    const map = new Map<string, ModuleConfig[]>();
    filtered.forEach((config) => {
      const meta = getModuleMetadata(config.module_name, metadataByName);
      const category = resolveCategory(config.module_name, meta.category);
      if (!map.has(category)) map.set(category, []);
      map.get(category)!.push(config);
    });
    return Array.from(map.entries())
      .map(([title, modules]) => ({ title, modules }))
      .sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a.title);
        const ib = CATEGORY_ORDER.indexOf(b.title);
        if (ia === -1 && ib === -1) return a.title.localeCompare(b.title);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
  }, [filtered, metadataByName]);

  const stats = useMemo(() => {
    const active = filtered.filter((c) => c.is_enabled).length;
    const total = filtered.length;
    const pct = total > 0 ? Math.round((active / total) * 100) : 0;
    return { active, total, pct };
  }, [filtered]);

  const toggle = useMutation({
    mutationFn: toggleBranchModule,
    // Optimistic: actualizamos cache de query y session store antes del
    // round-trip. Si el backend rechaza, onError hace rollback desde el
    // contexto y muestra el toast correspondiente. Si acepta, onSuccess
    // reconcilia con la respuesta real del servidor.
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["branch-modules", branchId] });
      const previous = queryClient.getQueryData<ModuleConfig[]>([
        "branch-modules",
        branchId,
      ]);
      // Capturar antes de setQueryData: el updater corre sincrónicamente y no
      // puede leer una const declarada después (TDZ).
      const prevSession = sessionModules[vars.moduleName];
      queryClient.setQueryData<ModuleConfig[]>(
        ["branch-modules", branchId],
        (old = []) => {
          const base = old.map((c) =>
            c.module_name === vars.moduleName
              ? { ...c, is_enabled: vars.isEnabled }
              : c,
          );
          // El módulo puede no tener fila en `by_branch` (card sintetizada):
          // agregarla al cache para que el switch haga flip optimista también
          // en ese caso y no espere el refetch.
          if (!base.some((c) => c.module_name === vars.moduleName)) {
            base.push({
              id: 0,
              branch: branchId ?? 0,
              module_name: vars.moduleName,
              is_enabled: vars.isEnabled,
              submodule_config: prevSession?.submodule_config ?? {},
              created: "",
              modified: "",
            } as unknown as ModuleConfig);
          }
          return base;
        },
      );
      setModuleState(vars.moduleName, {
        is_enabled: vars.isEnabled,
        submodule_config: prevSession?.submodule_config ?? {},
      });
      return { previous, prevSession };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["branch-modules", branchId] });
      setModuleState(data.module_name, {
        is_enabled: !!data.is_enabled,
        submodule_config: parseSubmoduleConfig(data.submodule_config),
      });
      // Recargar frontend-config para que el menú use la fuente de verdad del backend
      if (branchId) {
        try {
          const config = await fetchFrontendConfig(branchId);
          setFrontendConfig(config, String(branchId));
        } catch (e) {
          console.error("[modules] failed to refresh frontend-config after toggle:", e);
        }
      }
    },
    onError: (
      err: Error,
      vars,
      context: { previous?: ModuleConfig[]; prevSession?: typeof sessionModules[string] } | undefined,
    ) => {
      // Rollback del cambio optimista.
      if (context?.previous) {
        queryClient.setQueryData(["branch-modules", branchId], context.previous);
      } else if (vars && context !== undefined) {
        // La card era sintetizada (sin fila en `by_branch`): el optimismo la
        // agregó al cache; al fallar se retira para no dejar un estado falso.
        queryClient.setQueryData<ModuleConfig[]>(["branch-modules", branchId], (old = []) =>
          old.filter((c) => c.module_name !== vars.moduleName),
        );
      }
      if (context?.prevSession !== undefined) {
        setModuleState(vars.moduleName, context.prevSession);
      }
      const meta = getModuleMetadata(vars.moduleName, metadataByName);
      const moduleLabel = MODULE_LABELS[vars.moduleName] ?? meta.label ?? vars.moduleName;

      console.error("[modules] toggle error:", err);

      const isPlanError = err instanceof ApiError && err.status === 403;
      const isPermissionMessage = /permiso|permission|no tiene/i.test(err.message);

      if (isPlanError || isPermissionMessage) {
        toast.error(
          `No se pudo cambiar "${moduleLabel}". El módulo no está incluido en el plan activo de esta sucursal o tu rol no tiene permisos.`,
          6000,
        );
      } else {
        toast.error(err.message);
      }
    },
  });

  function handleToggle(moduleName: ModuleName) {
    // Evita encolar mutaciones: mientras una está en vuelo, los clics se
    // ignoran (si no, cada clic encolaba un toggle y el módulo alternaba
    // activar/desactivar en un loop de peticiones).
    if (toggle.isPending) return;
    if (!canManage) {
      toast.error("No tienes permisos para modificar módulos");
      return;
    }
    if (!branchId) return;
    const config = configByName.get(moduleName);
    if (!config) return;
    toggle.mutate({
      branchId,
      moduleName,
      isEnabled: !config.is_enabled,
    });
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-5">
        <PageHeader
          title="Módulos"
          subtitle="Activa y desactiva las funciones de tu sucursal"
          icon={<Sparkles className="h-5 w-5" />}
          badge={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              {stats.active}/{stats.total}
            </span>
          }
          className="mb-0"
        />

        {/* Progress bar */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
            initial={{ width: 0 }}
            animate={{ width: `${stats.pct}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
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

        {(error || (catalog?.modules?.length ?? 0) === 0) && !isLoading && !catalogLoading && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm font-medium">No se pudieron cargar los módulos</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Revisa tu conexión e intenta recargar la página.
            </p>
          </div>
        )}

        {isLoading || catalogLoading ? (
          <div className="flex flex-col gap-8">
            {Array.from({ length: 2 }).map((_, g) => (
              <section key={g}>
                <div className="mb-3 flex items-center gap-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-10 rounded-full" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-lg" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="ml-auto h-5 w-9 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map((group) => (
              <motion.section
                key={group.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {group.modules.filter((c) => c.is_enabled).length}/{group.modules.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.modules.map((config) => (
                    <ModuleCard
                      key={config.module_name}
                      config={config}
                      canManage={canManage}
                      isPending={toggle.isPending}
                      metadataByName={metadataByName}
                      animKey={toggle.variables?.moduleName === config.module_name && toggle.isPending ? "pending" : undefined}
                      onToggle={() => handleToggle(config.module_name)}
                    />
                  ))}
                </div>
              </motion.section>
            ))}
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
  metadataByName,
  animKey,
  onToggle,
}: {
  config: ModuleConfig;
  canManage: boolean;
  isPending: boolean;
  metadataByName: Record<string, ModuleCatalogMetadata>;
  animKey?: string;
  onToggle: () => void;
}) {
  const core = isCore(config.module_name);
  const meta = getModuleMetadata(config.module_name, metadataByName);
  const enabled = !!config.is_enabled;
  const label = MODULE_LABELS[config.module_name] ?? meta.label;
  const description = MODULE_DESCRIPTIONS[config.module_name];
  const Icon = MODULE_ICONS[config.module_name] ?? getIcon(meta.icon);

  return (
    <div
      className={cn(
        "group relative rounded-2xl transition-all duration-200",
        enabled ? "p-[2px]" : "border border-border bg-muted/30 shadow-sm",
        !core && canManage && !isPending && "cursor-pointer",
        core && "cursor-default"
      )}
      onClick={core || isPending ? undefined : onToggle}
    >
      {/* Borde que parpadea al activar y luego queda estático */}
      <AnimatePresence>
        {enabled && (
          <motion.div
            key={animKey ?? config.module_name}
            aria-hidden
            initial={{ opacity: 0, boxShadow: "0 0 0 0px var(--brand-primary)" }}
            animate={{ opacity: 1, boxShadow: "0 0 0 1.5px var(--brand-primary)" }}
            exit={{ opacity: 0, boxShadow: "0 0 0 0px var(--brand-primary)" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 rounded-2xl"
          />
        )}
      </AnimatePresence>

      <div
        className={cn(
          "relative flex h-full flex-col gap-3 rounded-[14px] p-4 transition-all duration-200",
          enabled
            ? "bg-gradient-to-br from-primary/5 to-muted/30 shadow-sm ring-1 ring-primary/20"
            : "bg-muted/30 opacity-80 hover:opacity-100 hover:shadow-md",
          !core && canManage && "hover:shadow-md"
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors",
              enabled ? "bg-primary/15" : "bg-muted"
            )}
          >
            <Icon className={cn("h-5 w-5", enabled ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">{label}</p>
            {description && (
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium",
              enabled ? "text-primary" : "text-muted-foreground"
            )}
          >
            {enabled ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                Activo
              </>
            ) : core ? (
              "Core — siempre activo"
            ) : (
              "Inactivo"
            )}
          </span>
          {!core && (
            <ToggleSwitch
              checked={enabled}
              onChange={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              disabled={isPending || !canManage}
              label={enabled ? "Deshabilitar" : "Habilitar"}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (e: React.MouseEvent) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked ? "bg-primary" : "bg-input",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow-sm",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}


