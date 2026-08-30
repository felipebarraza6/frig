"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  fetchBranchFinanceConfigs,
  updateBranchFinanceConfig,
  type BranchFinanceConfig,
} from "@/lib/api/branch-finance-config";
import { useToast } from "@/lib/store/toast";
import {
  fetchTaxTypes,
  createTaxType,
  updateTaxType,
  deleteTaxType,
  type TaxType,
  type CreateTaxTypeInput,
} from "@/lib/api/tax-types";
import { useCurrentBranch } from "@/lib/store/session";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      currency_symbol: currencySymbol,
      decimal_places: parseInt(decimalPlaces) || 0,
      thousand_separator: thousandSep,
      decimal_separator: decimalSep,
      default_tax_rate: "19",
      show_tax_breakdown: true,
    });
  };

  const preview = () => {
    const amount = 1234567.89;
    const intPart = Math.floor(amount).toLocaleString("es-CL").replace(/,/g, thousandSep);
    const decPart = (amount % 1).toFixed(parseInt(decimalPlaces)).slice(1).replace(".", decimalSep);
    return `${currencySymbol} ${intPart}${parseInt(decimalPlaces) > 0 ? decPart : ""}`;
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6">
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

      {/* Impuestos dinámicos */}
      <TaxTypesSection branchId={config.branch} />

      {/* Save */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Guardando...</> : <><Save className="mr-1.5 h-4 w-4" />Guardar configuración</>}
        </Button>
      </div>
    </form>
  );
}


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
                    {t.applies_to === "ALL" ? "Todos los productos" : t.applies_to}
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
        <TaxTypeForm
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

function TaxTypeForm({ taxType, branchId, onSubmit, onClose, isPending }: {
  taxType: TaxType | null;
  branchId: number;
  onSubmit: (payload: Partial<CreateTaxTypeInput>) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(taxType?.name ?? "");
  const [code, setCode] = useState(taxType?.code ?? "");
  const [description, setDescription] = useState(taxType?.description ?? "");
  const [taxCalc, setTaxCalc] = useState<"PERCENTAGE" | "FIXED">(taxType?.tax_calc ?? "PERCENTAGE");
  const [rate, setRate] = useState(String(taxType?.rate ?? ""));
  const [appliesTo, setAppliesTo] = useState(taxType?.applies_to ?? "ALL");
  const [isIncluded, setIsIncluded] = useState(taxType?.is_included_in_price ?? true);
  const [isDefault, setIsDefault] = useState(taxType?.is_default ?? false);
  const [isActive, setIsActive] = useState(taxType?.is_active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rate) return;
    onSubmit({
      name,
      code: code || undefined,
      description: description || undefined,
      tax_calc: taxCalc,
      rate: parseFloat(rate),
      applies_to: appliesTo,
      is_included_in_price: isIncluded,
      is_default: isDefault,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full rounded-t-xl border-x border-t border-border bg-card shadow-lg md:max-w-md md:rounded-xl md:border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{taxType ? "Editar impuesto" : "Nuevo impuesto"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
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
              <Select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)}>
                <option value="ALL">Todos los productos</option>
                <option value="FOOD">Alimentos</option>
                <option value="BEVERAGES">Bebidas</option>
                <option value="ALCOHOL">Bebidas alcohólicas</option>
                <option value="SERVICES">Servicios</option>
                <option value="PRODUCTS">Productos (no alimentos)</option>
              </Select>
            </div>
          </div>
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
            <Button type="submit" disabled={isPending || !name || !rate}>
              {isPending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Guardando...</> : "Guardar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
