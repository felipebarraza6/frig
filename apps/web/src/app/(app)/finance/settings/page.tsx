"use client";

import { useEffect, useMemo, useState } from "react";
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
  Percent,
  CheckCircle2,
  Cpu,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  fetchBranchFinanceConfigs,
  updateBranchFinanceConfig,
  type BranchFinanceConfig,
  type BranchFinanceConfigRequest,
} from "@/lib/api/branch-finance-config";
import { useToast } from "@/lib/store/toast";
import { useIsModuleEnabledFromConfig } from "@/lib/store/session";
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
  fetchExternalApps,
  type ExternalAppInstallation,
  type CreateExternalAppInstallationInput,
} from "@/lib/api/external-app-installations";
import { fetchExternalAppExecutionLogs } from "@/lib/api/external-app-execution-logs";
import { fetchProducts } from "@/lib/api/products";
import type { YggdraSchemas } from "@/lib/api/types";

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


export default function FinanceSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedIdx, setSelectedIdx] = useState(0);

  const { data: configs = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["branch-finance-configs"],
    queryFn: fetchBranchFinanceConfigs,
  });

  const currentConfig = configs[selectedIdx] ?? configs[0] ?? null;

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Parameters<typeof updateBranchFinanceConfig>[1]) =>
      updateBranchFinanceConfig(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branch-finance-configs"] });
      toast.success("Configuración guardada");
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col p-4 sm:p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (<div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-muted/30" />))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertCircle className="h-7 w-7 text-danger" />
        <p className="text-sm font-medium">No se pudo cargar la configuración</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reintentar</Button>
      </div>
    );
  }

  if (!currentConfig) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <Settings className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">No hay configuración financiera</p>
        <p className="text-xs text-muted-foreground">Contacta al administrador para crear una configuración.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Configuración financiera</h1>
          <p className="text-xs text-muted-foreground">{currentConfig.branch_name ?? "Sucursal"}</p>
        </div>
        {configs.length > 1 && (
          <Select value={String(selectedIdx)} onChange={(e) => setSelectedIdx(Number(e.target.value))} className="h-9 w-48 text-xs">
            {configs.map((c, idx) => (<option key={c.id} value={idx}>{c.branch_name ?? `Sucursal ${c.branch}`}</option>))}
          </Select>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <ConfigForm config={currentConfig} onUpdate={(payload) => updateMut.mutate({ id: currentConfig.id, ...payload })} isPending={updateMut.isPending} />
        <TaxTypesSection branchId={currentConfig.branch} />
        <SiiSection config={currentConfig} onUpdate={(payload) => updateMut.mutate({ id: currentConfig.id, ...payload })} isPending={updateMut.isPending} />
      </div>
    </div>
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Moneda */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Formato de moneda</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Símbolo</label>
            <Input value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Decimales</label>
            <Select value={decimalPlaces} onChange={(e) => setDecimalPlaces(e.target.value)} className="h-9 text-sm">
              <option value="0">0 (enteros)</option>
              <option value="2">2 (centavos)</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Separador miles</label>
            <Select value={thousandSep} onChange={(e) => setThousandSep(e.target.value as typeof thousandSep)} className="h-9 text-sm">
              {THOUSAND_SEP_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Separador decimal</label>
            <Select value={decimalSep} onChange={(e) => setDecimalSep(e.target.value as typeof decimalSep)} className="h-9 text-sm">
              {DECIMAL_SEP_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </Select>
          </div>
        </div>
        <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Vista previa: <span className="font-semibold text-foreground">{preview()}</span>
        </div>
      </section>

      {/* Impuestos */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Percent className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Impuestos en POS</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Tasa de impuesto por defecto (%)</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="0"
              className="h-9 text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Usa 0 para no aplicar impuesto.</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <input
              id="show-tax-breakdown"
              type="checkbox"
              checked={showTaxBreakdown}
              onChange={(e) => setShowTaxBreakdown(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="show-tax-breakdown" className="text-xs text-muted-foreground">
              Mostrar desglose de impuesto en el carrito
            </label>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Guardando...</> : <><Save className="mr-1.5 h-4 w-4" />Guardar configuración</>}
        </Button>
      </div>
    </form>
  );
}

/* ── TaxTypesSection: CRUD de impuestos por branch ── */

function TaxTypesSection({ branchId }: { branchId: number }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TaxType | null>(null);

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
      toast.success("Impuesto creado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<CreateTaxTypeInput>) =>
      updateTaxType(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-types", branchId] });
      setEditing(null);
      toast.success("Impuesto actualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTaxType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-types", branchId] });
      toast.success("Impuesto eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Impuestos configurados</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditing(null); }}>
          <Plus className="mr-1 h-3.5 w-3.5" />Agregar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/30" />)}
        </div>
      ) : taxTypes.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No hay impuestos configurados. Agrega uno para comenzar.</p>
      ) : (
        <div className="space-y-2">
          {taxTypes.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${t.is_active ? "bg-primary/10" : "bg-muted"}`}>
                  <Percent className={`h-4 w-4 ${t.is_active ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="font-medium">
                    {t.name}
                    {t.is_default && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <CheckCircle2 className="h-2.5 w-2.5" />Por defecto
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.tax_calc === "PERCENTAGE" ? `${t.rate}%` : `$${t.rate}`}
                    {" · "}
                    {APPLIES_TO_LABELS[t.applies_to as AppliesToValue] ?? t.applies_to}
                    {" · "}
                    {t.is_included_in_price ? "Incluido en precio" : "Se agrega al precio"}
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
                    onClick={() => { if (confirm(`¿Eliminar impuesto "${t.name}"?`)) deleteMut.mutate(t.id); }}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
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
    </section>
  );
}

const SII_TRIGGER_OPTIONS = [
  { value: "MANUAL", label: "Manual (desde el detalle de orden)" },
  { value: "ON_CREATION", label: "Al crear la orden" },
  { value: "ON_COMPLETION", label: "Al completar la orden" },
  { value: "ON_PAYMENT", label: "Al pagar la orden" },
] as const;

type SiiTrigger = (typeof SII_TRIGGER_OPTIONS)[number]["value"];

const SII_DOCUMENT_OPTIONS = [
  { value: "AUTO", label: "Automático según total" },
  { value: "BOLETA", label: "Boleta electrónica (39)" },
  { value: "FACTURA", label: "Factura electrónica (33)" },
] as const;

type SiiDocumentPreference = (typeof SII_DOCUMENT_OPTIONS)[number]["value"];

function SiiSection({
  config,
  onUpdate,
  isPending,
}: {
  config: BranchFinanceConfig;
  onUpdate: (payload: Parameters<typeof updateBranchFinanceConfig>[1]) => void;
  isPending: boolean;
}) {
  const isInvoicesEnabled = useIsModuleEnabledFromConfig("invoices");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [providerInstallation, setProviderInstallation] = useState<string | null>(
    config.sii_provider_installation ?? null,
  );
  const [trigger, setTrigger] = useState<SiiTrigger>(
    config.sii_generation_trigger ?? "MANUAL",
  );
  const [documentPreference, setDocumentPreference] = useState<SiiDocumentPreference>(
    config.sii_document_preference ?? "AUTO",
  );

  useEffect(() => {
    setProviderInstallation(config.sii_provider_installation ?? null);
    setTrigger(config.sii_generation_trigger ?? "MANUAL");
    setDocumentPreference(config.sii_document_preference ?? "AUTO");
  }, [config.sii_provider_installation, config.sii_generation_trigger, config.sii_document_preference]);

  const {
    data: installations = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["external-app-installations", config.branch],
    queryFn: () => fetchExternalAppInstallations(config.branch),
    enabled: !!config.branch,
  });

  const { data: externalApps = [] } = useQuery({
    queryKey: ["external-apps"],
    queryFn: fetchExternalApps,
  });

  const simpleApiAppId = externalApps.find((a) => a.slug === "simpleapi-sii")?.id;

  const { data: logs = [] } = useQuery({
    queryKey: ["external-app-execution-logs", providerInstallation],
    queryFn: () =>
      fetchExternalAppExecutionLogs(providerInstallation ?? undefined),
    enabled: !!providerInstallation,
  });

  const createInstallationMut = useMutation({
    mutationFn: createExternalAppInstallation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["external-app-installations", config.branch] });
      setProviderInstallation(data.id);
      onUpdate({
        sii_provider_installation: data.id,
        sii_generation_trigger: trigger,
        sii_document_preference: documentPreference,
      });
      toast.success("Proveedor SII configurado y seleccionado");
      setIsEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      sii_provider_installation: providerInstallation,
      sii_generation_trigger: trigger as BranchFinanceConfigRequest["sii_generation_trigger"],
      sii_document_preference: documentPreference as BranchFinanceConfigRequest["sii_document_preference"],
    });
  };

  const simpleApiInstallation = installations.find(
    (i) =>
      i.external_app_name === "SimpleAPI" ||
      i.external_app_name?.toLowerCase().includes("simpleapi"),
  );

  if (!isInvoicesEnabled) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Configuración SII / DTE</h2>
        </div>
        {!isEditing && (
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />Editar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-12 animate-pulse rounded-lg bg-muted/30" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {!providerInstallation && installations.length > 0 && (
            <div className="rounded-lg bg-muted/80 p-3 text-xs text-foreground">
              <p>Hay {installations.length} proveedor(es) disponible(s). Edita la configuración para seleccionar uno.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />Seleccionar proveedor
              </Button>
            </div>
          )}

          {!simpleApiInstallation && installations.length === 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p>No hay un proveedor SII configurado para esta sucursal.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={createInstallationMut.isPending || !simpleApiAppId}
                onClick={() =>
                  simpleApiAppId &&
                  createInstallationMut.mutate({
                    external_app: simpleApiAppId,
                    branch: config.branch,
                    label: "SimpleAPI SII",
                    description: "Proveedor SII por defecto",
                    credentials: {},
                    config_override: {},
                    is_active: true,
                  })
                }
              >
                {createInstallationMut.isPending ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Configurando...</>
                ) : (
                  <><Plus className="mr-1.5 h-3.5 w-3.5" />Configurar SimpleAPI SII</>
                )}
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Proveedor SII</label>
              {isEditing ? (
                <Select
                  value={providerInstallation ?? ""}
                  onChange={(e) =>
                    setProviderInstallation(e.target.value || null)
                  }
                  className="h-9 text-sm"
                >
                  <option value="">Sin proveedor (módulo oculto)</option>
                  {installations.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label} {i.external_app_name ? `(${i.external_app_name})` : ""}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-sm">
                  {installations.find((i) => i.id === providerInstallation)?.label ??
                    "Sin proveedor"}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Disparador de emisión</label>
              {isEditing ? (
                <Select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value as SiiTrigger)}
                  className="h-9 text-sm"
                >
                  {SII_TRIGGER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-sm">
                  {SII_TRIGGER_OPTIONS.find((o) => o.value === trigger)?.label ?? trigger}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Tipo de documento preferido</label>
              {isEditing ? (
                <Select
                  value={documentPreference}
                  onChange={(e) => setDocumentPreference(e.target.value as SiiDocumentPreference)}
                  className="h-9 text-sm"
                >
                  {SII_DOCUMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-sm">
                  {SII_DOCUMENT_OPTIONS.find((o) => o.value === documentPreference)?.label ??
                    documentPreference}
                </p>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setProviderInstallation(config.sii_provider_installation ?? null);
                  setTrigger(config.sii_generation_trigger ?? "MANUAL");
                  setDocumentPreference(config.sii_document_preference ?? "AUTO");
                  setIsEditing(false);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Guardando...</>
                ) : (
                  <><Save className="mr-1.5 h-3.5 w-3.5" />Guardar SII</>
                )}
              </Button>
            </div>
          )}

          {providerInstallation && logs.length > 0 && (
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-medium">Últimas ejecuciones</h3>
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {logs.slice(0, 20).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between rounded-md border border-border p-2 text-xs"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">
                        {log.endpoint_name ?? log.request_method}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(log.created).toLocaleString("es-CL")}
                      </span>
                      {log.error_message && (
                        <span className="text-danger">{log.error_message}</span>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        log.success
                          ? "bg-success/10 text-success"
                          : "bg-danger/10 text-danger"
                      }`}
                    >
                      {log.success ? "OK" : "Error"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

/* ── TaxTypeModal: se renderiza vía createPortal al body, fuera de cualquier <form> ── */

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
    new Set((taxType?.applicable_categories ?? []).map((c) => typeof c === "object" ? c.id : c)),
    [taxType?.applicable_categories]
  );
  const existingProductIds = useMemo(() =>
    new Set((taxType?.applicable_products ?? []).map((p) => typeof p === "object" ? p.id : p)),
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
      <div className="w-full rounded-t-xl border-x border-t border-border bg-card shadow-lg md:max-w-lg md:rounded-xl md:border max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{taxType ? "Editar impuesto" : "Nuevo impuesto"}</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
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
