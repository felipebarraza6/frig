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
  const [taxRate, setTaxRate] = useState(String(config.default_tax_rate ?? 19));
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(config.show_tax_breakdown ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      currency_symbol: currencySymbol,
      decimal_places: parseInt(decimalPlaces) || 0,
      thousand_separator: thousandSep,
      decimal_separator: decimalSep,
      default_tax_rate: taxRate,
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

      {/* Impuestos */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Impuestos</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">IVA por defecto (%)</label>
            <Input type="number" step="0.01" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <label className="text-sm font-medium">Mostrar desglose IVA</label>
            <button type="button" onClick={() => setShowTaxBreakdown(!showTaxBreakdown)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showTaxBreakdown ? "bg-primary" : "bg-muted"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showTaxBreakdown ? "translate-x-6" : "translate-x-1"}`} />
            </button>
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
