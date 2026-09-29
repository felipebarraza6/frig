"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { PageShell, PageBody } from "@/components/page-shell";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Save,
  Loader2,
  AlertCircle,
  RotateCcw,
  DollarSign,
  Receipt,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  Cpu,
  X,
  Info,
  Upload,
  Search,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import {
  fetchTaxFolios,
  createTaxFolio,
  toggleTaxFolioActive,
  deleteTaxFolio,
} from "@/lib/api/tax-folios";
import { fetchBranches, updateBranchSiiConfig } from "@/lib/api/branches";
import { useToast } from "@/lib/store/toast";
import { useIsModuleEnabledFromConfig, useCurrentBranch } from "@/lib/store/session";
import {
  fetchBranchFinanceConfigs,
  fetchBranchFinanceConfigByBranch,
  updateBranchFinanceConfig,
  type BranchFinanceConfig,
  type SiiActionKey,
} from "@/lib/api/branch-finance-config";
import {
  fetchTaxTypes,
  createTaxType,
  updateTaxType,
  deleteTaxType,
  type TaxType,
  type CreateTaxTypeInput,
} from "@/lib/api/tax-types";
import { fetchCategoryList, type YggdraCategory } from "@/lib/api/categories";
import {
  fetchExternalAppInstallations,
  createExternalAppInstallation,
  updateExternalAppInstallation,
  fetchExternalApps,
  isSiiBillingApp,
  fetchExternalAppEndpoints,
  credentialKeysForApp,
  credentialFieldLabel,
  isSecretCredentialKey,
  authTypeHint,
  revealInstallationCredentials,
  testExternalAppInstallation,
  deleteExternalAppInstallation,
  type ExternalApp,
  type ExternalAppEndpoint,
  type ExternalAppInstallation,
} from "@/lib/api/external-app-installations";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { fetchExternalAppExecutionLogs } from "@/lib/api/external-app-execution-logs";
import { fetchProducts } from "@/lib/api/products";
import type { YggdraSchemas } from "@/lib/api/types";
import {
  fetchSiiDocumentTypes,
  SII_DOCUMENT_TYPES,
  SII_GROUP_LABELS,
  type SiiDocGroup,
  type SiiDocumentType,
} from "@/lib/sii-document-types";

const THOUSAND_SEP_OPTIONS = [
  { value: ".", label: "Punto (.)" },
  { value: ",", label: "Coma (,)" },
  { value: " ", label: "Espacio" },
  { value: "", label: "Sin separador" },
];

const DECIMAL_SEP_OPTIONS = [
  { value: ",", label: "Coma (,)" },
  { value: ".", label: "Punto (.)" },
];
type AppliesToValue = "ALL" | "CATEGORIES" | "PRODUCTS";

const APPLIES_TO_OPTIONS: { value: AppliesToValue; label: string }[] = [
  { value: "ALL", label: "Todos los productos" },
  { value: "CATEGORIES", label: "Categorías específicas" },
  { value: "PRODUCTS", label: "Productos específicos" },
];

const APPLIES_TO_LABELS: Record<AppliesToValue, string> = {
  ALL: "Todos los productos",
  CATEGORIES: "Categorías específicas",
  PRODUCTS: "Productos específicos",
};

/* ── Secciones de configuración ─────────────────────────────────────────── */

type SettingsTab = "general" | "taxes" | "sii";

function SectionHead({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function Surface({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("glass flex min-h-0 flex-col rounded-2xl p-5 sm:p-6", className)}>
      {children}
    </div>
  );
}

/** Etiqueta que agrupa campos relacionados dentro de una sección. */
function SubSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}


export default function FinanceSettingsPage() {
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const branchId = Number(branch?.branch_id ?? 0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [tab, setTab] = useState<SettingsTab>("general");

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash === "#fin-sii" || hash === "#fin-folios") setTab("sii");
    if (hash === "#fin-taxes") setTab("taxes");
  }, []);

  const { data: configs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["branch-finance-configs", branchId],
    queryFn: async () => {
      if (branchId) {
        try {
          const one = await fetchBranchFinanceConfigByBranch(branchId);
          return [one];
        } catch {
          /* listado como respaldo */
        }
      }
      return fetchBranchFinanceConfigs();
    },
  });

  const currentConfig = configs[selectedIdx] ?? configs[0] ?? null;

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Parameters<typeof updateBranchFinanceConfig>[1]) =>
      updateBranchFinanceConfig(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-finance-configs"] });
    },
  });

  if (isLoading) {
    return (
      <PageShell>
        <div className="h-16 animate-pulse border-b border-border bg-muted/40" />
        <PageBody>
          <div className="h-10 w-72 animate-pulse rounded-xl bg-muted" />
          <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
        </PageBody>
      </PageShell>
    );
  }

  if (isError) {
    return (
      <PageShell>
        <EmptyState
          icon={AlertCircle}
          title="No se pudo cargar la configuración"
          description={error instanceof Error ? error.message : "Revisa la sucursal activa y vuelve a intentar."}
          action={<Button variant="outline" size="sm" onClick={() => refetch()}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reintentar</Button>}
        />
      </PageShell>
    );
  }

  if (!currentConfig) {
    return (
      <PageShell>
        <EmptyState
          icon={Settings}
          title="No hay configuración financiera"
          description="Contacta al administrador para crear una configuración."
        />
      </PageShell>
    );
  }

  const save = (payload: Parameters<typeof updateBranchFinanceConfig>[1]) =>
    updateMut.mutate({ id: currentConfig.id, ...payload });

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "general", label: "Moneda" },
    { id: "taxes", label: "Impuestos" },
    { id: "sii", label: "Facturación SII" },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Configuración"
        icon={<Settings className="h-5 w-5" />}
        subtitle={currentConfig.branch_name ?? "Sucursal"}
        actions={configs.length > 1 ? (
          <Select value={String(selectedIdx)} onChange={(e) => setSelectedIdx(Number(e.target.value))} className="h-9 w-48 text-xs">
            {configs.map((c, idx) => (<option key={c.id} value={idx}>{c.branch_name ?? `Sucursal ${c.branch}`}</option>))}
          </Select>
        ) : undefined}
      />

      <div className="flex gap-1 overflow-x-auto border-b border-border px-4 sm:px-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <PageBody>
        {tab === "general" && (
          <ConfigForm config={currentConfig} onUpdate={save} isPending={updateMut.isPending} />
        )}
        {tab === "taxes" && <TaxTypesSection branchId={currentConfig.branch} />}
        {tab === "sii" && (
          <SiiSection config={currentConfig} onUpdate={save} isPending={updateMut.isPending} />
        )}
      </PageBody>
    </PageShell>
  );
}

function ConfigForm({ config, onUpdate, isPending }: {
  config: BranchFinanceConfig;
  onUpdate: (payload: Parameters<typeof updateBranchFinanceConfig>[1]) => void;
  isPending: boolean;
}) {
  const [currencySymbol, setCurrencySymbol] = useState(config.currency_symbol ?? "$");
  const [decimalPlaces, setDecimalPlaces] = useState(String(config.decimal_places ?? 0));
  const [thousandSep, setThousandSep] = useState<"." | "," | " " | "">(config.thousand_separator ?? ".");
  const [decimalSep, setDecimalSep] = useState<"," | ".">(config.decimal_separator ?? ",");
  const [taxRate, setTaxRate] = useState(String(config.default_tax_rate ?? "0"));
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(config.show_tax_breakdown ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      currency_symbol: currencySymbol,
      decimal_places: parseInt(decimalPlaces) || 0,
      thousand_separator: thousandSep,
      decimal_separator: decimalSep,
      default_tax_rate: taxRate || "0",
      show_tax_breakdown: showTaxBreakdown,
    });
  };

  const preview = () => {
    const amount = 1234567.89;
    const intPart = Math.floor(amount).toLocaleString("es-CL").replace(/,/g, thousandSep);
    const decPart = (amount % 1).toFixed(parseInt(decimalPlaces)).slice(1).replace(".", decimalSep);
    return `${currencySymbol} ${intPart}${parseInt(decimalPlaces) > 0 ? decPart : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionHead
        icon={DollarSign}
        title="Moneda"
        description="Formato de montos en POS y reportes de esta sucursal"
      />
      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <Surface className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Field label="Símbolo">
              <Input value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} />
            </Field>
            <Field label="Decimales">
              <Select value={decimalPlaces} onChange={(e) => setDecimalPlaces(e.target.value)}>
                <option value="0">0 (enteros)</option>
                <option value="2">2 (centavos)</option>
              </Select>
            </Field>
            <Field label="Separador de miles">
              <Select value={thousandSep} onChange={(e) => setThousandSep(e.target.value as typeof thousandSep)}>
                {THOUSAND_SEP_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </Field>
            <Field label="Separador decimal">
              <Select value={decimalSep} onChange={(e) => setDecimalSep(e.target.value as typeof decimalSep)}>
                {DECIMAL_SEP_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <Field label="Tasa de impuesto por defecto (%)" hint="Usa 0 para no aplicar impuesto.">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0"
              />
            </Field>
            <div className="flex items-center justify-between gap-3 sm:pt-6">
              <div>
                <p className="text-sm font-medium">Desglose en el carrito</p>
                <p className="text-sm text-muted-foreground">Mostrar el impuesto aparte del precio</p>
              </div>
              <Switch checked={showTaxBreakdown} onCheckedChange={setShowTaxBreakdown} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Guardando…</> : <><Save className="mr-1.5 h-4 w-4" />Guardar</>}
            </Button>
          </div>
        </Surface>
        <Surface className="flex flex-col justify-center gap-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vista previa</p>
          <p className="font-display text-2xl font-semibold tabular-nums tracking-tight">{preview()}</p>
          <p className="text-sm text-muted-foreground">Así se ven los montos en esta sucursal.</p>
        </Surface>
      </form>
    </div>
  );
}

/* ── TaxTypesSection: CRUD de impuestos por branch ── */

function TaxTypesSection({ branchId }: { branchId: number }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TaxType | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TaxType | null>(null);

  const { data: taxTypes = [], isLoading } = useQuery({
    queryKey: ["tax-types", branchId],
    queryFn: () => fetchTaxTypes({ branch: branchId }),
    enabled: !!branchId,
  });

  const createMut = useMutation({
    mutationFn: createTaxType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-types", branchId] });
      setAdding(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<CreateTaxTypeInput>) =>
      updateTaxType(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-types", branchId] });
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTaxType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-types", branchId] });
      setPendingDelete(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-6">
      <SectionHead
        icon={Receipt}
        title="Impuestos"
        description="IVA, ILA y otros sobre productos o categorías"
        action={
          <Button size="sm" onClick={() => { setAdding(true); setEditing(null); }}>
            <Plus className="mr-1 h-3.5 w-3.5" />Agregar
          </Button>
        }
      />
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/40" />)}
        </div>
      ) : taxTypes.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No hay impuestos"
          description="Agrega IVA u otro impuesto para usarlo en productos."
          action={
            <Button size="sm" onClick={() => { setAdding(true); setEditing(null); }}>
              <Plus className="mr-1 h-3.5 w-3.5" />Agregar impuesto
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {taxTypes.map((t) => (
            <li key={t.id} className="glass flex items-center justify-between gap-3 rounded-2xl p-4 text-sm">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary ${!t.is_active ? "opacity-50" : ""}`}>
                  {t.tax_calc === "PERCENTAGE" ? "%" : "$"}
                </div>
                <div>
                  <p className="font-medium">
                    {t.name}
                    {t.is_default && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <CheckCircle2 className="h-2.5 w-2.5" />Por defecto
                      </span>
                    )}
                    {t.is_included_in_price && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Incluido en precio
                      </span>
                    )}
                    {!t.is_active && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">
                        Inactivo
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.tax_calc === "PERCENTAGE" ? `${t.rate}%` : `$${t.rate}`}
                    {" · "}
                    {APPLIES_TO_LABELS[t.applies_to as AppliesToValue] ?? t.applies_to}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { setEditing(t); setAdding(false); }}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {!t.is_default && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(t)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(adding || editing) && (
        <TaxTypeModal
          taxType={editing}
          branchId={branchId}
          onSubmit={(payload) => {
            if (editing) updateMut.mutate({ id: editing.id, ...payload });
            else createMut.mutate({ branch: branchId, ...payload } as CreateTaxTypeInput);
          }}
          onClose={() => { setAdding(false); setEditing(null); }}
          isPending={createMut.isPending || updateMut.isPending}
        />
      )}
      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Eliminar impuesto"
        description={
          pendingDelete
            ? `Se quita “${pendingDelete.name}” de esta sucursal. Las ventas ya hechas no cambian.`
            : undefined
        }
        size="sm"
      >
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={() => setPendingDelete(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={deleteMut.isPending}
            onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
          >
            {deleteMut.isPending ? "Eliminando…" : "Eliminar"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function installationAppId(inst: ExternalAppInstallation): string {
  const app = inst.external_app;
  return typeof app === "string" ? app : app.id;
}

function endpointTitle(ep: { name?: string; slug?: string }): string {
  const name = (ep.name ?? "").trim();
  if (name) return name.replace(/\s+/g, " ").trim();
  return (ep.slug ?? "").replace(/_/g, " ") || "Función de la app";
}

function endpointPath(ep: ExternalAppEndpoint): string {
  const method = (ep.method ?? "POST").toUpperCase();
  const path = ep.path?.trim() || "";
  return path ? `${method}  ${path}` : method;
}

function placeholdersInSchema(schema: unknown): string[] {
  const found = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      for (const m of value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) found.add(m[1]);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(walk);
    }
  };
  walk(schema);
  return Array.from(found).sort();
}

function CredentialFields({
  app,
  values,
  onChange,
}: {
  app: ExternalApp | null;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const keys = app ? credentialKeysForApp(app) : Object.keys(values);
  const hint = authTypeHint(app);
  if (keys.length === 0) {
    return hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null;
  }
  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {keys.map((key) => (
          <Field key={key} label={credentialFieldLabel(key)}>
            <Input
              type={isSecretCredentialKey(key) ? "password" : "text"}
              value={values[key] ?? ""}
              onChange={(e) => onChange(key, e.target.value)}
              autoComplete="off"
            />
          </Field>
        ))}
      </div>
    </div>
  );
}

function guessActionEndpoints(
  endpoints: { id: string; slug?: string }[],
  catalog: SiiDocumentType[],
): Partial<Record<SiiActionKey, string>> {
  const out: Partial<Record<SiiActionKey, string>> = {};
  for (const action of catalog) {
    const match = endpoints.find((ep) => (ep.slug ?? "").toLowerCase() === action.slug);
    if (match) out[action.action] = match.id;
  }
  return out;
}

function ActionEndpointMap({
  endpoints,
  catalog,
  value,
  onChange,
}: {
  endpoints: ExternalAppEndpoint[];
  catalog: SiiDocumentType[];
  value: Partial<Record<SiiActionKey, string>>;
  onChange: (next: Partial<Record<SiiActionKey, string>>) => void;
}) {
  const [groupFilter, setGroupFilter] = useState<SiiDocGroup | "all" | "pending">("venta");
  const [pickFor, setPickFor] = useState<SiiDocumentType | null>(null);
  const list = endpoints.filter((ep) => ep.is_active !== false);
  const guessed = guessActionEndpoints(list, catalog);
  const assigned = catalog.filter((a) => value[a.action]).length;

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta app no declara funciones. Sin ellas no se puede conectar boleta ni factura.
      </p>
    );
  }

  const canApplyGuess =
    Object.keys(guessed).length > 0 &&
    catalog.some((a) => guessed[a.action] && guessed[a.action] !== value[a.action]);

  const groups = Array.from(new Set(catalog.map((a) => a.group)));
  const pendingCount = catalog.filter((a) => !value[a.action]).length;
  const visibleCatalog =
    groupFilter === "all"
      ? catalog
      : groupFilter === "pending"
        ? catalog.filter((a) => !value[a.action])
        : catalog.filter((a) => a.group === groupFilter);
  const visibleGroups = Array.from(new Set(visibleCatalog.map((a) => a.group)));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {assigned}/{catalog.length} funciones conectadas
            <span className="mt-0.5 block text-xs">Elige cuál. El mapeo de datos vive en la app.</span>
          </p>
          {canApplyGuess && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, ...guessed })}>
              Usar coincidencias
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "venta" as const, label: SII_GROUP_LABELS.venta },
              { id: "ajuste" as const, label: SII_GROUP_LABELS.ajuste },
              ...groups
                .filter((g) => g !== "venta" && g !== "ajuste")
                .map((g) => ({ id: g, label: SII_GROUP_LABELS[g] ?? g })),
              { id: "pending" as const, label: pendingCount ? `Pendientes (${pendingCount})` : "Pendientes" },
              { id: "all" as const, label: "Todas" },
            ] as { id: SiiDocGroup | "all" | "pending"; label: string }[]
          ).map((tag) => {
            const active = groupFilter === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => setGroupFilter(tag.id)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
      {visibleGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada en este filtro.</p>
      ) : visibleGroups.map((group) => (
        <div key={group} className="flex flex-col gap-2">
          <p className="sticky top-0 z-[1] bg-background/80 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
            {SII_GROUP_LABELS[group] ?? group}
          </p>
          <div className="grid gap-2">
            {visibleCatalog.filter((a) => a.group === group).map((action) => {
              const selectedId = value[action.action] ?? "";
              const selected = list.find((ep) => ep.id === selectedId) ?? null;
              return (
                <div key={action.action} className="grid min-w-0 grid-cols-1 items-center gap-2 rounded-xl bg-background/50 px-3 py-2.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto]">
                  <div className="min-w-0" title={action.hint}>
                    <p className="truncate text-sm font-medium">{action.label}</p>
                    {action.code && (
                      <p className="text-[10px] tabular-nums text-muted-foreground">Tipo {action.code}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickFor(action)}
                    className="flex h-9 min-w-0 w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 text-left text-sm shadow-sm transition-colors hover:bg-muted/60"
                  >
                    <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
                      {selected ? endpointTitle(selected) : "Elegir función…"}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                  <div className="flex items-center gap-1">
                    {selectedId ? (
                      <CheckCircle2 className="h-4 w-4 text-success" aria-label="Conectado" />
                    ) : (
                      <span className="h-4 w-4" />
                    )}
                    <button
                      type="button"
                      onClick={() => setPickFor(action)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Ver funciones de la app"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      </div>
      {pickFor && (
        <FunctionPickerModal
          action={pickFor}
          endpoints={list}
          selectedId={value[pickFor.action] ?? ""}
          suggestedId={guessed[pickFor.action]}
          onSelect={(id) => {
            onChange({ ...value, [pickFor.action]: id });
            setPickFor(null);
          }}
          onClose={() => setPickFor(null)}
        />
      )}
    </div>
  );
}

function FunctionPickerModal({
  action,
  endpoints,
  selectedId,
  suggestedId,
  onSelect,
  onClose,
}: {
  action: SiiDocumentType;
  endpoints: ExternalAppEndpoint[];
  selectedId: string;
  suggestedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openDetail, setOpenDetail] = useState<string | null>(selectedId || suggestedId || null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...endpoints].sort((a, b) => {
      if (a.id === suggestedId) return -1;
      if (b.id === suggestedId) return 1;
      if (a.id === selectedId) return -1;
      if (b.id === selectedId) return 1;
      return endpointTitle(a).localeCompare(endpointTitle(b), "es");
    });
    if (!q) return sorted;
    return sorted.filter((ep) => {
      const hay = `${endpointTitle(ep)} ${ep.slug ?? ""} ${endpointPath(ep)} ${ep.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [endpoints, query, suggestedId, selectedId]);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Función para ${action.label}`}
      description={
        action.code
          ? `${action.hint} · tipo SII ${action.code}`
          : action.hint
      }
      size="lg"
    >
      <ModalBody className="flex min-h-0 flex-col gap-3">
        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en las funciones de la app…"
            className="pl-9"
            autoFocus
          />
        </div>
        <ul className="min-h-0 max-h-[min(28rem,55vh)] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {filtered.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">Sin coincidencias</li>
          ) : (
            filtered.map((ep) => {
              const selected = ep.id === selectedId;
              const suggested = ep.id === suggestedId;
              const expanded = openDetail === ep.id;
              const placeholders = placeholdersInSchema(ep.body_schema);
              const schema = ep.body_schema;
              const hasSchema = schema && typeof schema === "object" && Object.keys(schema as object).length > 0;
              return (
                <li key={ep.id} className={cn("rounded-2xl border border-border bg-background/70 p-3", expanded && "ring-2 ring-primary/40")}>
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setOpenDetail(ep.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="font-medium">{endpointTitle(ep)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{endpointPath(ep)}</p>
                      {ep.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{ep.description}</p>
                      ) : null}
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {selected ? (
                          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">En uso</span>
                        ) : null}
                        {suggested ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Sugerida</span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenDetail(expanded ? null : ep.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={expanded ? "Ocultar detalle" : "Ver plantilla"}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </div>
                  {expanded ? (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      {placeholders.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {placeholders.map((p) => (
                            <span key={p} className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px]">
                              {p}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {hasSchema ? (
                        <pre className="max-h-40 overflow-auto rounded-xl bg-muted/50 p-3 text-[11px] leading-5">
                          {JSON.stringify(schema, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sin plantilla de cuerpo en el catálogo.</p>
                      )}
                      <div className="flex justify-end">
                        <Button type="button" size="sm" onClick={() => onSelect(ep.id)} disabled={selected}>
                          {selected ? "Ya está en uso" : "Usar esta función"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </ModalBody>
      <ModalFooter>
        {selectedId ? (
          <Button type="button" variant="ghost" className="mr-auto" onClick={() => onSelect("")}>
            Quitar conexión
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
        {openDetail && openDetail !== selectedId ? (
          <Button type="button" onClick={() => onSelect(openDetail)}>
            Usar esta función
          </Button>
        ) : null}
      </ModalFooter>
    </Modal>
  );
}

export function SiiSection({
  config,
  onUpdate,
  isPending,
  embedded = false,
  invoicesEnabled,
}: {
  config: BranchFinanceConfig;
  onUpdate: (payload: Parameters<typeof updateBranchFinanceConfig>[1]) => void;
  isPending: boolean;
  embedded?: boolean;
  invoicesEnabled?: boolean;
}) {
  const sessionInvoices = useIsModuleEnabledFromConfig("invoices");
  const isInvoicesEnabled = invoicesEnabled ?? sessionInvoices;
  const toast = useToast();
  const queryClient = useQueryClient();
  const [providerInstallation, setProviderInstallation] = useState<string | null>(
    config.sii_provider_installation ?? null,
  );
  const [installingApp, setInstallingApp] = useState<ExternalApp | null>(null);
  const [credDraft, setCredDraft] = useState<Record<string, string>>({});
  const [actionEndpoints, setActionEndpoints] = useState<Partial<Record<SiiActionKey, string>>>({});
  const [trigger, setTrigger] = useState(config.sii_generation_trigger ?? "MANUAL");
  const [docPref, setDocPref] = useState(config.sii_document_preference ?? "AUTO");
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const [changeApp, setChangeApp] = useState(false);

  const [syncedConfig, setSyncedConfig] = useState(config);
  if (syncedConfig !== config) {
    setSyncedConfig(config);
    setProviderInstallation(config.sii_provider_installation ?? null);
    setTrigger(config.sii_generation_trigger ?? "MANUAL");
    setDocPref(config.sii_document_preference ?? "AUTO");
    setActionEndpoints(config.sii_action_endpoints ?? {});
  }

  const { data: installations = [], isLoading } = useQuery({
    queryKey: ["external-app-installations", config.branch],
    queryFn: () => fetchExternalAppInstallations(config.branch, { category: "sii" }),
    enabled: !!config.branch,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["external-apps", "sii"],
    queryFn: async () => {
      const [byCat, byCtx] = await Promise.all([
        fetchExternalApps({ category: "sii" }),
        fetchExternalApps({ usage_context: "invoicing" }),
      ]);
      const byId = new Map<string, ExternalApp>();
      for (const a of [...byCat, ...byCtx]) {
        if (isSiiBillingApp(a)) byId.set(a.id, a);
      }
      return Array.from(byId.values());
    },
  });

  const siiApps = catalog;

  useEffect(() => {
    if (providerInstallation || installingApp) return;
    const wanted = config.sii_provider_installation;
    const match = installations.find((i) => i.id === wanted);
    if (match) {
      setProviderInstallation(match.id);
      return;
    }
    const siiInstalls = installations.filter((i) => {
      const app = siiApps.find((a) => a.id === installationAppId(i));
      return app ? isSiiBillingApp(app) : i.external_app_category === "sii";
    });
    if (siiInstalls.length === 1) setProviderInstallation(siiInstalls[0].id);
  }, [installations, config.sii_provider_installation, providerInstallation, installingApp, siiApps]);

  const activeInstall = installations.find((i) => i.id === providerInstallation) ?? null;
  const activeAppId = activeInstall ? installationAppId(activeInstall) : installingApp?.id ?? "";

  const { data: endpoints = [] } = useQuery({
    queryKey: ["external-app-endpoints", activeAppId],
    queryFn: () => fetchExternalAppEndpoints(activeAppId),
    enabled: Boolean(activeAppId),
  });

  const { data: siiCatalog = SII_DOCUMENT_TYPES } = useQuery({
    queryKey: ["sii-document-types"],
    queryFn: fetchSiiDocumentTypes,
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (endpoints.length === 0) return;
    if (Object.values(actionEndpoints).some(Boolean)) return;
    const guessed = guessActionEndpoints(endpoints, siiCatalog);
    if (Object.values(guessed).some(Boolean)) setActionEndpoints(guessed);
  }, [endpoints, actionEndpoints, siiCatalog]);

  const { data: branchPage } = useQuery({
    queryKey: ["branches"],
    queryFn: () => fetchBranches({}),
  });
  const branch = (branchPage?.results ?? []).find(
    (b) => Number(b.branch_id ?? b.id) === Number(config.branch),
  );

  const { data: logs = [] } = useQuery({
    queryKey: ["external-app-execution-logs", providerInstallation],
    queryFn: () => fetchExternalAppExecutionLogs(providerInstallation ?? undefined),
    enabled: !!providerInstallation,
  });

  const { data: revealedCreds } = useQuery({
    queryKey: ["external-app-creds", providerInstallation],
    queryFn: () => revealInstallationCredentials(providerInstallation as string),
    enabled: Boolean(providerInstallation) && !installingApp,
    staleTime: 10_000,
  });

  const activeApp = siiApps.find((a) => a.id === activeAppId) ?? null;

  useEffect(() => {
    if (!revealedCreds || installingApp) return;
    const keys = activeApp
      ? credentialKeysForApp(activeApp)
      : Object.keys(revealedCreds);
    const next: Record<string, string> = {};
    for (const k of keys) next[k] = revealedCreds[k] ?? "";
    for (const [k, v] of Object.entries(revealedCreds)) {
      if (!(k in next)) next[k] = v;
    }
    setCredDraft(next);
  }, [revealedCreds, installingApp, activeApp, providerInstallation]);

  const savedActions = {
    ...(activeInstall?.config_override as { action_endpoints?: Partial<Record<SiiActionKey, string>> } | undefined)
      ?.action_endpoints,
    ...(config.sii_action_endpoints ?? {}),
  };
  const hasAnyAction = Object.values(actionEndpoints).some(Boolean);
  if (!hasAnyAction && Object.values(savedActions).some(Boolean)) {
    setActionEndpoints(savedActions);
  }

  function startInstall(app: ExternalApp) {
    const existing = installations.find((i) => installationAppId(i) === app.id);
    if (existing) {
      setProviderInstallation(existing.id);
      setInstallingApp(null);
      return;
    }
    setInstallingApp(app);
    const keys = credentialKeysForApp(app);
    const blank: Record<string, string> = {};
    for (const k of keys) blank[k] = "";
    setCredDraft(blank);
  }

  const saveInstall = useMutation({
    mutationFn: async () => {
      if (!installingApp) throw new Error("Elige una app");
      const inst = await createExternalAppInstallation({
        external_app: installingApp.id,
        branch: config.branch,
        label: installingApp.name,
        description: installingApp.description,
        credentials: credDraft,
        config_override: { action_endpoints: actionEndpoints },
        is_active: true,
      });
      return inst;
    },
    onSuccess: (inst) => {
      queryClient.invalidateQueries({ queryKey: ["external-app-installations", config.branch] });
      setProviderInstallation(inst.id);
      setInstallingApp(null);
      onUpdate({
        sii_provider_installation: inst.id,
        sii_generation_trigger: trigger,
        sii_document_preference: docPref,
      });
      toast.success("App instalada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveActive = useMutation({
    mutationFn: async () => {
      if (!providerInstallation) return;
      await updateExternalAppInstallation(providerInstallation, {
        credentials: credDraft,
        config_override: { action_endpoints: actionEndpoints },
      });
      onUpdate({
        sii_provider_installation: providerInstallation,
        sii_generation_trigger: trigger,
        sii_document_preference: docPref,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-app-creds", providerInstallation] });
      queryClient.invalidateQueries({ queryKey: ["external-app-installations", config.branch] });
      toast.success("Credenciales guardadas");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testConn = useMutation({
    mutationFn: () => testExternalAppInstallation(providerInstallation as string),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["external-app-installations", config.branch] });
      if (res.success) toast.success(res.message || "Conexión correcta");
      else toast.error(res.message || "La conexión falló");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uninstall = useMutation({
    mutationFn: async () => {
      if (!providerInstallation) return;
      await deleteExternalAppInstallation(providerInstallation);
      onUpdate({ sii_provider_installation: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["external-app-installations", config.branch] });
      queryClient.removeQueries({ queryKey: ["external-app-creds", providerInstallation] });
      setProviderInstallation(null);
      setCredDraft({});
      setActionEndpoints({});
      setInstallingApp(null);
      setConfirmUninstall(false);
      toast.success("App desinstalada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const showCatalog = !activeInstall || changeApp || !!installingApp;

  return (
    <div id="fin-sii" className="flex flex-col gap-6">
      {!embedded ? (
      <SectionHead
        icon={Cpu}
        title="Facturación SII"
        description="Instalación de esta sucursal: app, funciones, resolución y CAF"
        action={
          !isInvoicesEnabled ? (
            <Link href="/settings/modules" className="text-sm font-medium text-primary hover:underline">
              Activar módulo
            </Link>
          ) : undefined
        }
      />
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-2xl bg-muted/30" />
          <div className="h-48 animate-pulse rounded-2xl bg-muted/30" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {showCatalog && (
            <Surface className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <SubSectionTitle>App de facturación</SubSectionTitle>
                {activeInstall && changeApp && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setChangeApp(false)}>
                    Cancelar
                  </Button>
                )}
              </div>
              {siiApps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay apps de facturación en el catálogo.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {siiApps.map((app) => {
                    const inst = installations.find((i) => installationAppId(i) === app.id);
                    const inUse = inst && inst.id === providerInstallation;
                    return (
                      <li key={app.id}>
                        <button
                          type="button"
                          onClick={() => {
                            startInstall(app);
                            setChangeApp(false);
                          }}
                          className={cn(
                            "flex w-full min-w-0 items-start gap-3 rounded-2xl border border-border bg-background/60 p-4 text-left transition hover:border-primary/40 hover:shadow-sm",
                            inUse && "ring-2 ring-primary/40",
                          )}
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Cpu className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-sm font-semibold">{app.name}</span>
                            {authTypeHint(app) ? (
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">{authTypeHint(app)}</span>
                            ) : null}
                            <span className={cn("text-xs font-medium", inUse ? "text-success" : "text-muted-foreground")}>
                              {inUse ? "En uso en esta sucursal" : inst ? "Instalada" : "Instalar"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Surface>
          )}

          {installingApp && (
            <form
              className="grid gap-6 lg:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveInstall.mutate();
              }}
            >
              <Surface className="h-full gap-5">
                <SubSectionTitle>Cuenta · {installingApp.name}</SubSectionTitle>
                <CredentialFields
                  app={installingApp}
                  values={credDraft}
                  onChange={(key, value) => setCredDraft((d) => ({ ...d, [key]: value }))}
                />
                <div className="mt-auto flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setInstallingApp(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saveInstall.isPending}>
                    {saveInstall.isPending ? "Instalando…" : "Instalar"}
                  </Button>
                </div>
              </Surface>
              <Surface className="h-auto max-h-[min(28rem,70vh)] gap-3 overflow-hidden lg:h-0 lg:min-h-full lg:max-h-none">
                <ActionEndpointMap
                  endpoints={endpoints}
                  catalog={siiCatalog}
                  value={Object.keys(actionEndpoints).length ? actionEndpoints : guessActionEndpoints(endpoints, siiCatalog)}
                  onChange={setActionEndpoints}
                />
              </Surface>
            </form>
          )}

          {activeInstall && !installingApp && (
            <form
              className="grid gap-6 lg:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveActive.mutate();
              }}
            >
              <Surface className="h-full gap-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold">{activeInstall.label}</p>
                    <p className="text-sm text-success">Instalada en esta sucursal</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setChangeApp(true)}>
                    Cambiar app
                  </Button>
                </div>
                {activeInstall.last_error && (
                  <p className="text-sm text-danger">{activeInstall.last_error}</p>
                )}
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <CredentialFields
                    app={activeApp}
                    values={credDraft}
                    onChange={(key, value) => setCredDraft((d) => ({ ...d, [key]: value }))}
                  />
                  <Field label="Cuándo emitir">
                    <Select value={trigger} onChange={(e) => setTrigger(e.target.value as typeof trigger)}>
                      <option value="MANUAL">Solo a mano</option>
                      <option value="ON_PAYMENT">Al pagar la orden</option>
                      <option value="ON_COMPLETION">Al completar la orden</option>
                      <option value="ON_CREATION">Al crear la orden</option>
                    </Select>
                  </Field>
                  <Field label="Documento por defecto">
                    <Select value={docPref} onChange={(e) => setDocPref(e.target.value as typeof docPref)}>
                      <option value="AUTO">Automático según el cliente</option>
                      <option value="BOLETA">Siempre boleta</option>
                      <option value="FACTURA">Siempre factura</option>
                    </Select>
                  </Field>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-danger hover:bg-danger/10 hover:text-danger"
                    disabled={uninstall.isPending}
                    onClick={() => setConfirmUninstall(true)}
                  >
                    {uninstall.isPending ? "Desinstalando…" : "Desinstalar"}
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!providerInstallation || testConn.isPending}
                      onClick={() => testConn.mutate()}
                    >
                      {testConn.isPending ? "Probando…" : "Probar conexión"}
                    </Button>
                    <Button type="submit" disabled={isPending || saveActive.isPending}>
                      {isPending || saveActive.isPending ? "Guardando…" : "Guardar cuenta"}
                    </Button>
                  </div>
                </div>
              </Surface>
              <Surface className="h-auto max-h-[min(28rem,70vh)] gap-3 overflow-hidden lg:h-0 lg:min-h-full lg:max-h-none">
                <ActionEndpointMap
                  endpoints={endpoints}
                  catalog={siiCatalog}
                  value={Object.keys(actionEndpoints).length ? actionEndpoints : guessActionEndpoints(endpoints, siiCatalog)}
                  onChange={setActionEndpoints}
                />
              </Surface>
            </form>
          )}

          {activeInstall && (
            <div className="grid gap-6 lg:grid-cols-2">
              {branch ? (
                <SiiLegalFields
                  branchId={Number(branch.branch_id ?? branch.id)}
                  enabled={branch.sii_config?.sii_enabled ?? false}
                  resolutionNumber={branch.sii_config?.sii_resolution_number ?? ""}
                  resolutionDate={branch.sii_config?.sii_resolution_date ?? ""}
                />
              ) : (
                <div />
              )}
              <FoliosSection branchId={config.branch} />
            </div>
          )}

          {providerInstallation && logs.length > 0 && (
            <details className="glass rounded-2xl p-5">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Últimas ejecuciones ({logs.length})
              </summary>
              <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                {logs.slice(0, 12).map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-3 rounded-xl bg-background/50 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{log.endpoint_name ?? log.request_method}</span>
                    <span className={log.success ? "text-success" : "text-danger"}>{log.success ? "OK" : "Error"}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <Modal
        open={confirmUninstall}
        onClose={() => setConfirmUninstall(false)}
        title="Desinstalar app"
        description={
          activeInstall
            ? `Se quita “${activeInstall.label}” de esta sucursal. Dejas de emitir con esa cuenta hasta que instales otra.`
            : "Se quita la app de esta sucursal."
        }
        size="sm"
      >
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={() => setConfirmUninstall(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={uninstall.isPending}
            onClick={() => uninstall.mutate()}
          >
            {uninstall.isPending ? "Desinstalando…" : "Desinstalar"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

function SiiLegalFields({
  branchId,
  enabled,
  resolutionNumber,
  resolutionDate,
}: {
  branchId: number;
  enabled: boolean;
  resolutionNumber: string;
  resolutionDate: string;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [siiEnabled, setSiiEnabled] = useState(enabled);
  const [resNumber, setResNumber] = useState(resolutionNumber);
  const [resDate, setResDate] = useState(resolutionDate);
  const [cert, setCert] = useState<File | null>(null);
  const [password, setPassword] = useState("");

  const save = useMutation({
    mutationFn: () =>
      updateBranchSiiConfig(branchId, {
        sii_enabled: siiEnabled,
        sii_resolution_number: resNumber.trim(),
        sii_resolution_date: resDate,
        digital_certificate: cert,
        certificate_password: password,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setPassword("");
      setCert(null);
      toast.success("Resolución y certificado guardados");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <form
      className="glass flex h-full min-h-0 flex-col gap-5 rounded-2xl p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <SubSectionTitle>Resolución y certificado</SubSectionTitle>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Emisión activa
          <Switch checked={siiEnabled} onCheckedChange={setSiiEnabled} />
        </label>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field label="N° de resolución">
          <Input value={resNumber} onChange={(e) => setResNumber(e.target.value)} />
        </Field>
        <Field label="Fecha de resolución">
          <Input type="date" value={resDate} onChange={(e) => setResDate(e.target.value)} />
        </Field>
        <Field label="Certificado digital">
          <Input type="file" onChange={(e) => setCert(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="Clave del certificado">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <div className="mt-auto flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar resolución"}
        </Button>
      </div>
    </form>
  );
}

function FoliosSection({ branchId }: { branchId: number }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [alertAt, setAlertAt] = useState("50");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: folios = [], isLoading } = useQuery({
    queryKey: ["tax-folios", branchId],
    queryFn: () => fetchTaxFolios(branchId),
    enabled: !!branchId,
  });

  const typesInUse = useMemo(() => {
    const seen = new Map<string, string>();
    for (const f of folios) {
      const code = String(f.document_type);
      if (!seen.has(code)) seen.set(code, f.document_type_display ?? code);
    }
    return Array.from(seen, ([code, label]) => ({ code, label }));
  }, [folios]);

  const visibleFolios = useMemo(() => {
    const list = typeFilter === "all" ? folios : folios.filter((f) => String(f.document_type) === typeFilter);
    return [...list].sort((a, b) => {
      const ta = String(a.document_type).localeCompare(String(b.document_type));
      if (ta !== 0) return ta;
      return a.range_from - b.range_from;
    });
  }, [folios, typeFilter]);

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Elige el XML del CAF");
      return createTaxFolio({
        branch: branchId,
        caf_file: file,
        alert_at: Number(alertAt) || 50,
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["tax-folios", branchId] });
      setFile(null);
      const kind = created.document_type_display ?? created.document_type;
      toast.success(`CAF de ${kind} ${created.range_from}–${created.range_to} cargado`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggle = useMutation({
    mutationFn: toggleTaxFolioActive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tax-folios", branchId] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: deleteTaxFolio,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-folios", branchId] });
      toast.success("Rango eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div id="fin-folios" className="glass flex h-auto max-h-[min(28rem,70vh)] min-h-0 flex-col gap-4 overflow-hidden rounded-2xl p-5 sm:p-6 lg:h-0 lg:min-h-full lg:max-h-none">
      <div>
        <SubSectionTitle>Folios CAF</SubSectionTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Puedes cargar varios. El tipo sale del XML. Se usa el rango más bajo primero; cuando se acaba, pasa al siguiente.
        </p>
      </div>
      <form
        className="flex shrink-0 flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          upload.mutate();
        }}
      >
        <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_7rem_auto]">
          <Field label="XML del SII">
            <Input
              type="file"
              accept=".xml,text/xml"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label="Alertar en">
            <Input type="number" min={1} value={alertAt} onChange={(e) => setAlertAt(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={!file || upload.isPending} className="w-full sm:w-auto">
              <Upload className="mr-1.5 h-4 w-4" />
              {upload.isPending ? "Subiendo…" : "Cargar CAF"}
            </Button>
          </div>
        </div>
        {file ? (
          <p className="truncate text-xs text-muted-foreground">{file.name}</p>
        ) : null}
      </form>

      {typesInUse.length > 1 ? (
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              typeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            Todas
          </button>
          {typesInUse.map((t) => (
            <button
              key={t.code}
              type="button"
              onClick={() => setTypeFilter(t.code)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                typeFilter === t.code ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <div className="h-16 animate-pulse rounded-xl bg-muted/30" />
      ) : visibleFolios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay rangos. Carga el XML que bajaste del SII.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {visibleFolios.map((f) => {
            const total = f.range_to - f.range_from + 1;
            const used = f.current_usage ?? 0;
            const available = Number(f.available_folios ?? Math.max(0, total - used));
            const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
            const exhausted = available <= 0;
            const low = !exhausted && available < (f.alert_at ?? 50);
            return (
              <li key={f.id} className="rounded-xl bg-background/50 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {f.document_type_display ?? f.document_type}
                      <span className="ml-1.5 font-mono text-xs font-normal text-muted-foreground">
                        {f.range_from}–{f.range_to}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {exhausted ? "Agotado" : `${available} disponibles · próximo ${f.next_folio ?? "—"}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      exhausted
                        ? "bg-muted text-muted-foreground"
                        : low
                          ? "bg-warning/15 text-warning"
                          : f.is_active
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground",
                    )}>
                      {exhausted ? "Agotado" : f.is_active ? (low ? "Bajo" : "En uso") : "Pausado"}
                    </span>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggle.mutate(f.id)}>
                      {f.is_active ? "Pausar" : "Activar"}
                    </Button>
                    {used === 0 && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-danger" onClick={() => remove.mutate(f.id)}>
                        Quitar
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", exhausted ? "bg-muted-foreground/40" : low ? "bg-warning" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── TaxTypeModal: se renderiza vía createPortal al body, fuera de cualquier <form> ── */

/** El backend entrega applicable_categories/applicable_products como string; se acepta
 *  también el formato antiguo (array de ids u objetos con id) por compatibilidad. */
function parseApplicableIds(raw: unknown): number[] {
  let items: unknown[] = [];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        items = Array.isArray(parsed) ? parsed : [];
      } catch {
        items = [];
      }
    } else if (trimmed) {
      items = trimmed.split(",");
    }
  } else if (Array.isArray(raw)) {
    items = raw;
  }
  return items
    .map((item) => (typeof item === "object" && item !== null ? (item as { id?: unknown }).id : item))
    .map((id) => (typeof id === "string" ? Number(id.trim()) : id))
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
}

function TaxTypeModal({ taxType, onSubmit, onClose, isPending, branchId }: {
  taxType: TaxType | null;
  onSubmit: (payload: Partial<CreateTaxTypeInput>) => void;
  onClose: () => void;
  isPending: boolean;
  branchId: number;
}) {
  const [name, setName] = useState(taxType?.name ?? "");
  const [code, setCode] = useState(taxType?.code ?? "");
  const [description, setDescription] = useState(taxType?.description ?? "");
  const [taxCalc, setTaxCalc] = useState<"PERCENTAGE" | "FIXED">(taxType?.tax_calc ?? "PERCENTAGE");
  const [rate, setRate] = useState(String(taxType?.rate ?? ""));
  const [appliesTo, setAppliesTo] = useState<AppliesToValue>((taxType?.applies_to as AppliesToValue) ?? "ALL");
  const [isIncluded, setIsIncluded] = useState(taxType?.is_included_in_price ?? true);
  const [isDefault, setIsDefault] = useState(taxType?.is_default ?? false);
  const [isActive, setIsActive] = useState(taxType?.is_active ?? true);

  const existingCategoryIds = useMemo(() =>
    new Set(parseApplicableIds(taxType?.applicable_categories)),
    [taxType?.applicable_categories]
  );
  const existingProductIds = useMemo(() =>
    new Set(parseApplicableIds(taxType?.applicable_products)),
    [taxType?.applicable_products]
  );

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
    Array.from(existingCategoryIds).filter((id): id is number => typeof id === "number")
  );
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>(
    Array.from(existingProductIds).filter((id): id is number => typeof id === "number")
  );

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-simple", branchId],
    queryFn: fetchCategoryList,
    enabled: appliesTo === "CATEGORIES",
  });

  const { data: productsData } = useQuery({
    queryKey: ["products-for-sale", branchId],
    queryFn: () => fetchProducts({ is_for_sale: true, page_size: 200 }),
    enabled: appliesTo === "PRODUCTS",
  });
  const products = useMemo(() => productsData?.results ?? [], [productsData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rate) return;
    const payload: Partial<CreateTaxTypeInput> = {
      name,
      code: code || undefined,
      description: description || undefined,
      tax_calc: taxCalc,
      rate: parseFloat(rate),
      applies_to: appliesTo,
      is_included_in_price: isIncluded,
      is_default: isDefault,
      is_active: isActive,
    };
    if (appliesTo === "CATEGORIES") {
      payload.applicable_category_ids = selectedCategoryIds;
    }
    if (appliesTo === "PRODUCTS") {
      payload.applicable_product_ids = selectedProductIds;
    }
    onSubmit(payload);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full rounded-t-xl border-x border-t border-border bg-background shadow-lg md:max-w-lg md:rounded-xl md:border max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{taxType ? "Editar impuesto" : "Nuevo impuesto"}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Nombre *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: IVA, ILA" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Código</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: IVA" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Tipo *</label>
              <Select value={taxCalc} onChange={(e) => setTaxCalc(e.target.value as typeof taxCalc)}>
                <option value="PERCENTAGE">Porcentual (%)</option>
                <option value="FIXED">Monto fijo ($)</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Tasa / Monto *</label>
              <Input type="number" step="0.01" min="0" max="100" value={rate} onChange={(e) => setRate(e.target.value)} required placeholder={taxCalc === "PERCENTAGE" ? "Ej: 19" : "Ej: 500"} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Aplica a</label>
              <Select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as AppliesToValue)}>
                {APPLIES_TO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          </div>

          {appliesTo === "CATEGORIES" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Categorías *</label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-2 space-y-1">
                {categories.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay categorías disponibles.</p>
                ) : (
                  categories.map((c: YggdraCategory) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.includes(c.id)}
                        onChange={(e) => {
                          setSelectedCategoryIds((prev) =>
                            e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                          );
                        }}
                        className="rounded"
                      />
                      {c.name}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {appliesTo === "PRODUCTS" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Productos *</label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-2 space-y-1">
                {products.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay productos disponibles.</p>
                ) : (
                  products.map((p: YggdraSchemas["ProductList"]) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(p.id)}
                        onChange={(e) => {
                          setSelectedProductIds((prev) =>
                            e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                          );
                        }}
                        className="rounded"
                      />
                      {p.name}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Descripción</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción del impuesto (opcional)" />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isIncluded} onChange={(e) => setIsIncluded(e.target.checked)} className="rounded" />
              Incluido en precio
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
              Por defecto
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
              Activo
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !name || !rate || (appliesTo === "CATEGORIES" && selectedCategoryIds.length === 0) || (appliesTo === "PRODUCTS" && selectedProductIds.length === 0)}>
              {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Guardando...</> : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
